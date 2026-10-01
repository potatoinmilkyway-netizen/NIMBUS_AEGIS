"""ReliefMatch orchestration engine (FastAPI)."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel, Field

from core import (
    apply_reallocation,
    calculate_gap,
    detect_clashes,
    load_state,
    singular,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("reliefmatch")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_HTML = STATIC_DIR / "index.html"

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "qwen/qwen-3-30b-a3b")
OPENROUTER_TIMEOUT = float(os.getenv("OPENROUTER_TIMEOUT", "30"))
_APP_TITLE = "ReliefMatch Triage"


class OpenRouterNotConfigured(RuntimeError):
    """Raised when the OpenRouter API key is missing or empty."""


_client: Optional[OpenAI] = None


def _get_openrouter_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        if not api_key:
            raise OpenRouterNotConfigured(
                "OPENROUTER_API_KEY is not set; offline regex fallback is active."
            )
        _client = OpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=api_key,
            timeout=OPENROUTER_TIMEOUT,
            default_headers={
                "HTTP-Referer": "https://reliefmatch.example",
                "X-Title": _APP_TITLE,
            },
        )
    return _client


_EXTRACT_SYSTEM_PROMPT = (
    "You are the extraction module of the ReliefMatch triage system.\n"
    "Your ONLY task is to read the provided offer text and extract the quantity "
    "of each distinct relief item being offered.\n\n"
    "STRICT OUTPUT RULES:\n"
    "- Return a SINGLE raw JSON object and nothing else: no prose, no markdown, "
    "no code fences, no explanations, no trailing commas.\n"
    "- The object maps item names to non-negative integers only.\n"
    "- Keys: the item name, lower-cased, with single spaces "
    '(e.g. "notebook", "hygiene kit").\n'
    "- Values: an integer quantity. Never a decimal, string, range, or unit word.\n"
    "- You must NOT compute or infer ANY metric. Do not output need, shortfall, "
    "gap, total, percentage, stock, pledged, or any comparison. "
    "You report ONLY the offered quantities.\n"
    "- If an item is mentioned without an explicit number, omit it.\n"
    "- If no quantities can be found, return exactly: {}\n"
)


def _call_qwen(text: str) -> str:
    client = _get_openrouter_client()
    response = client.chat.completions.create(
        model=OPENROUTER_MODEL,
        temperature=0.0,
        messages=[
            {"role": "system", "content": _EXTRACT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": "Extract the offered relief-item quantities from the text below:\n\n"
                + text,
            },
        ],
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("OpenRouter returned an empty completion.")
    return content


def _parse_llm_json(raw: str) -> Dict[str, int]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in LLM response.")
    data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("LLM JSON is not an object.")
    result: Dict[str, int] = {}
    for key, value in data.items():
        qty = int(value)
        if qty < 0:
            raise ValueError(f"Negative quantity for item {key!r}.")
        item = singular(str(key))
        result[item] = result.get(item, 0) + qty
    return result


_QUANTITY_RE = re.compile(
    r"(?P<qty>\d+)\s+"
    r"(?P<item>(?:hygiene\s+kits?|pencil\s+boxes?|notebooks?|jackets?|blankets?))\b",
    re.IGNORECASE,
)


def _regex_extract(text: str) -> Dict[str, int]:
    found: Dict[str, int] = {}
    for match in _QUANTITY_RE.finditer(text):
        qty = int(match.group("qty"))
        item = singular(match.group("item").lower())
        found[item] = found.get(item, 0) + qty
    return found


def extract_quantities(text: str) -> Tuple[Dict[str, int], str, str]:
    try:
        raw = _call_qwen(text)
        return _parse_llm_json(raw), "qwen", ""
    except OpenRouterNotConfigured as exc:
        logger.warning("OpenRouter not configured -> regex fallback: %s", exc)
        return _regex_extract(text), "regex-fallback", str(exc)
    except Exception as exc:
        logger.warning("OpenRouter/LLM failure -> regex fallback: %s", exc)
        return _regex_extract(text), "regex-fallback", f"LLM unavailable: {exc}"


def item_breakdown(
    item: str, state: Optional[Dict[str, Any]] = None
) -> Dict[str, int]:
    if state is None:
        state = load_state()
    key = singular(item)
    need = sum(
        needs.get(key, 0)
        for needs in state.get("community_needs", {}).values()
    )
    pledged = sum(
        p.get("qty", 0)
        for p in state.get("active_pledges", [])
        if singular(p.get("item", "")) == key
    )
    stock = state.get("warehouse_stock", {}).get(key, 0)
    return {
        "need": need,
        "pledged": pledged,
        "stock": stock,
        "gap": calculate_gap(item, state),
    }


def _all_items(state: Dict[str, Any]) -> List[str]:
    items = set(state.get("warehouse_stock", {}).keys())
    for needs in state.get("community_needs", {}).values():
        items.update(needs.keys())
    for p in state.get("active_pledges", []):
        items.add(singular(p.get("item", "")))
    return sorted(items)


def build_grid_state() -> Dict[str, Any]:
    state = load_state()
    breakdowns = {
        item: item_breakdown(item, state) for item in _all_items(state)
    }
    return {
        "warehouse_stock": state.get("warehouse_stock", {}),
        "community_needs": state.get("community_needs", {}),
        "active_pledges": state.get("active_pledges", []),
        "gaps": {item: breakdowns[item]["gap"] for item in breakdowns},
        "item_breakdown": breakdowns,
        "clashes": detect_clashes(state),
    }


def build_triage_email(
    quantities: Dict[str, int],
    source: str,
    reason: str,
    team: Optional[str] = None,
    state: Optional[Dict[str, Any]] = None,
) -> str:
    if state is None:
        state = load_state()
    addressee = team.strip() if (team and team.strip()) else "team"

    lines: List[str] = [
        "Subject: ReliefMatch Triage — Offer Review",
        "",
        f"Hello {addressee},",
        "",
        "We've reviewed your latest offer against live distribution requirements.",
    ]
    if source != "qwen":
        lines.extend(
            [
                "",
                f"Note: automated extraction ran on the offline fallback ({reason}). "
                "Please verify the quantities below.",
            ]
        )
    lines.append("")

    if not quantities:
        lines.extend(
            [
                "We could not confirm any specific item quantities in your message.",
                'Please reply with explicit counts, e.g. "200 notebooks, 50 jackets".',
                "",
                "— ReliefMatch Triage",
            ]
        )
        return "\n".join(lines)

    lines.extend(
        [
            "Offered quantities and current shortfall for each item you mentioned:",
            "",
        ]
    )
    for item, qty in quantities.items():
        b = item_breakdown(item, state)
        lines.append(
            f"  - {item}: offered {qty} · current shortfall {b['gap']} "
            f"(need {b['need']}, pledged {b['pledged']}, on hand {b['stock']})"
        )
    lines.append("")

    clashes = detect_clashes(state)
    if clashes:
        lines.extend(
            ["Distribution warnings detected on the current grid:", ""]
        )
        for c in clashes:
            rec = c.get("recommendation")
            rec_text = (
                f"Recommendation: move {rec['qty']} {c['item']} from {c['community']} "
                f"to {rec['to_community']}."
                if rec
                else "No safe reallocation is available for this item."
            )
            lines.append(
                f"  - {c['item']} @ {c['community']} is over-pledged by {c['overage']} "
                f"[{c['severity']}]. {rec_text}"
            )
        lines.append("")
    else:
        lines.extend(
            [
                "No distribution clashes are detected; all active pledges are within need.",
                "",
            ]
        )

    lines.extend(
        [
            "Please confirm these quantities so we can update the allocation grid.",
            "",
            "— ReliefMatch Triage",
        ]
    )
    return "\n".join(lines)


def run_triage(text: str, team: Optional[str] = None) -> Dict[str, Any]:
    state = load_state()
    quantities, source, reason = extract_quantities(text)
    gaps_per_item = {item: item_breakdown(item, state) for item in quantities}
    return {
        "extraction": quantities,
        "source": source,
        "fallback_reason": reason,
        "metrics": {
            "gaps": {item: b["gap"] for item, b in gaps_per_item.items()},
            "gaps_per_item": gaps_per_item,
            "clashes": detect_clashes(state),
        },
        "drafted_email": build_triage_email(
            quantities, source, reason, team=team, state=state
        ),
    }


def _summarize_reallocation(
    pledge_id: str,
    to_community: str,
    qty: int,
    source_pledge: Dict[str, Any],
    new_state: Dict[str, Any],
) -> str:
    item = source_pledge.get("item")
    if qty == source_pledge.get("qty"):
        return f"Shifted {qty} x {item} from pledge {pledge_id!r} to {to_community!r}."
    remaining = next(
        (
            p.get("qty")
            for p in new_state.get("active_pledges", [])
            if p.get("pledge_id") == pledge_id
        ),
        0,
    )
    return (
        f"Split pledge {pledge_id!r}: moved {qty} x {item} to {to_community!r}, "
        f"leaving {remaining} x {item} at the original destination."
    )


def run_reallocation(
    pledge_id: str, to_community: str, qty: int
) -> Dict[str, Any]:
    before = load_state()
    before_gaps = {
        i: item_breakdown(i, before)["gap"] for i in _all_items(before)
    }
    before_clashes = detect_clashes(before)

    source_pledge = next(
        (
            p
            for p in before.get("active_pledges", [])
            if p.get("pledge_id") == pledge_id
        ),
        None,
    )
    if source_pledge is None:
        raise ValueError(f"pledge_id {pledge_id!r} not found in active_pledges.")
    if not isinstance(qty, int) or isinstance(qty, bool) or qty <= 0:
        raise ValueError("qty must be a positive integer.")
    if qty > source_pledge.get("qty", 0):
        raise ValueError(
            f"cannot move {qty} units; pledge {pledge_id!r} only holds "
            f"{source_pledge.get('qty', 0)}."
        )
    if not str(to_community).strip():
        raise ValueError("to_community must be a non-empty string.")

    new_state = apply_reallocation(pledge_id, to_community, qty)

    after_gaps = {
        i: item_breakdown(i, new_state)["gap"] for i in _all_items(new_state)
    }
    after_clashes = detect_clashes(new_state)
    return {
        "applied": {
            "pledge_id": pledge_id,
            "to_community": to_community,
            "qty": qty,
        },
        "state_after": {
            "warehouse_stock": new_state.get("warehouse_stock", {}),
            "community_needs": new_state.get("community_needs", {}),
            "active_pledges": new_state.get("active_pledges", []),
        },
        "before": {"gaps": before_gaps, "clashes": before_clashes},
        "after": {
            "gaps": after_gaps,
            "clashes": after_clashes,
            "summary": _summarize_reallocation(
                pledge_id, to_community, qty, source_pledge, new_state
            ),
        },
    }


class TriageRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw offer text block to triage.")
    team: Optional[str] = Field(
        default=None, description="Optional team name for the email salutation."
    )
    donor: Optional[str] = Field(
        default=None, description="Optional donor alias from Bolt."
    )
    deadline: Optional[str] = Field(
        default=None, description="Optional deadline date from Bolt."
    )


class ReallocationRequest(BaseModel):
    pledge_id: str = Field(..., min_length=1, description="The pledge to relocate.")
    to_community: str = Field(..., min_length=1, description="Target community.")
    qty: int = Field(..., gt=0, description="Positive integer quantity to move.")


app = FastAPI(title="ReliefMatch Orchestration Engine", version="1.0.0")

# --- Enable CORS for Bolt.new and external frontend clients ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["ui"])
def root() -> FileResponse:
    if not INDEX_HTML.exists():
        raise HTTPException(status_code=503, detail="static/index.html is missing.")
    return FileResponse(INDEX_HTML)


@app.get("/api/grid_state", tags=["api"])
def api_grid_state() -> Dict[str, Any]:
    return build_grid_state()


@app.post("/api/triage", tags=["api"])
def api_triage(payload: TriageRequest) -> Dict[str, Any]:
    sender = payload.team or payload.donor
    return run_triage(payload.text, team=sender)


@app.post("/api/reallocate", tags=["api"])
def api_reallocate(payload: ReallocationRequest) -> Dict[str, Any]:
    try:
        return run_reallocation(payload.pledge_id, payload.to_community, payload.qty)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
