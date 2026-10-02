import "server-only";
import type {
  Clash,
  GridState,
  ItemBreakdown,
  Recommendation,
  ReallocationResponse,
  ReliefState,
  TriageResponse,
} from "./types";

// TypeScript port of core.py + the orchestration helpers in app.py, used as the
// mock engine when RELIEFMATCH_API_URL is not configured.

const SEED_STATE: ReliefState = {
  warehouse_stock: {
    blanket: 120,
    "hygiene kit": 25,
    jacket: 900,
    notebook: 40,
    "pencil box": 0,
  },
  community_needs: {
    Riverside: { blanket: 60, "hygiene kit": 150, notebook: 400 },
    Hillcrest: { "hygiene kit": 80, notebook: 150, "pencil box": 200 },
  },
  active_pledges: [
    { pledge_id: "pledge_A", team: "Team Alpha", item: "notebook", qty: 400, to_community: "Riverside" },
    { pledge_id: "pledge_B", team: "Team Beta", item: "notebook", qty: 50, to_community: "Riverside" },
  ],
};

const globalStore = globalThis as unknown as { __reliefState?: ReliefState };

function getState(): ReliefState {
  if (!globalStore.__reliefState) {
    globalStore.__reliefState = structuredClone(SEED_STATE);
  }
  return structuredClone(globalStore.__reliefState);
}

function saveState(state: ReliefState) {
  globalStore.__reliefState = structuredClone(state);
}

export function resetState() {
  globalStore.__reliefState = structuredClone(SEED_STATE);
}

const PHRASE_MAP: Record<string, string> = {
  "hygiene kits": "hygiene kit",
  "hygiene kit": "hygiene kit",
  "pencil boxes": "pencil box",
  "pencil box": "pencil box",
  jackets: "jacket",
  jacket: "jacket",
  blankets: "blanket",
  blanket: "blanket",
  notebooks: "notebook",
  notebook: "notebook",
};

const WORD_MAP: Record<string, string> = {
  jackets: "jacket",
  jacket: "jacket",
  blankets: "blanket",
  blanket: "blanket",
  notebooks: "notebook",
  notebook: "notebook",
  boxes: "box",
  box: "box",
  kits: "kit",
  kit: "kit",
};

export function singular(itemName: string): string {
  const text = itemName.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
  if (!text) return "";
  if (PHRASE_MAP[text]) return PHRASE_MAP[text];
  const tokens = text.split(" ");
  const last = tokens[tokens.length - 1];
  if (WORD_MAP[last]) tokens[tokens.length - 1] = WORD_MAP[last];
  else if (last.endsWith("s") && !last.endsWith("ss")) tokens[tokens.length - 1] = last.slice(0, -1);
  return tokens.join(" ");
}

function itemBreakdown(item: string, state: ReliefState): ItemBreakdown {
  const key = singular(item);
  const need = Object.values(state.community_needs).reduce((sum, needs) => sum + (needs[key] ?? 0), 0);
  const pledged = state.active_pledges
    .filter((p) => singular(p.item) === key)
    .reduce((sum, p) => sum + p.qty, 0);
  const stock = state.warehouse_stock[key] ?? 0;
  return { need, pledged, stock, gap: Math.max(need - pledged - stock, 0) };
}

function allItems(state: ReliefState): string[] {
  const items = new Set(Object.keys(state.warehouse_stock));
  for (const needs of Object.values(state.community_needs)) Object.keys(needs).forEach((i) => items.add(i));
  for (const p of state.active_pledges) items.add(singular(p.item));
  return [...items].sort();
}

function pledgeSumBy(state: ReliefState, community: string, itemKey: string) {
  return state.active_pledges
    .filter((p) => p.to_community === community && singular(p.item) === itemKey)
    .reduce((sum, p) => sum + p.qty, 0);
}

function recommendRelocation(
  state: ReliefState,
  overCommunity: string,
  itemKey: string,
  overage: number,
): Recommendation | null {
  const candidates: [string, number][] = [];
  for (const [other, needs] of Object.entries(state.community_needs)) {
    if (other === overCommunity) continue;
    const capacity = (needs[itemKey] ?? 0) - pledgeSumBy(state, other, itemKey);
    if (capacity > 0) candidates.push([other, capacity]);
  }
  if (candidates.length === 0) return null;
  const [altCommunity, altCapacity] = candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const sources = state.active_pledges
    .filter((p) => p.to_community === overCommunity && singular(p.item) === itemKey)
    .sort((a, b) => b.qty - a.qty || a.pledge_id.localeCompare(b.pledge_id));
  if (sources.length === 0) return null;
  const source = sources[0];

  const qty = Math.min(overage, source.qty, altCapacity);
  if (qty <= 0) return null;
  return { pledge_id: source.pledge_id, to_community: altCommunity, qty };
}

function detectClashes(state: ReliefState): Clash[] {
  const clashes: Clash[] = [];
  for (const [community, needs] of Object.entries(state.community_needs)) {
    for (const [item, need] of Object.entries(needs)) {
      const itemKey = singular(item);
      const pledged = pledgeSumBy(state, community, itemKey);
      if (pledged <= need) continue;
      const overage = pledged - need;
      clashes.push({
        item: itemKey,
        community,
        need,
        pledged,
        overage,
        severity: overage > 30 ? "HIGH" : "MEDIUM",
        recommendation: recommendRelocation(state, community, itemKey, overage),
      });
    }
  }
  return clashes;
}

export function buildGridState(): GridState {
  const state = getState();
  const breakdown = Object.fromEntries(allItems(state).map((i) => [i, itemBreakdown(i, state)]));
  return {
    ...state,
    gaps: Object.fromEntries(Object.entries(breakdown).map(([i, b]) => [i, b.gap])),
    item_breakdown: breakdown,
    clashes: detectClashes(state),
    engine: "mock",
  };
}

const QUANTITY_RE = /(\d+)\s+(hygiene\s+kits?|pencil\s+boxes?|notebooks?|jackets?|blankets?)\b/gi;

function regexExtract(text: string): Record<string, number> {
  const found: Record<string, number> = {};
  for (const match of text.matchAll(QUANTITY_RE)) {
    const item = singular(match[2]);
    found[item] = (found[item] ?? 0) + Number.parseInt(match[1], 10);
  }
  return found;
}

function buildTriageEmail(
  quantities: Record<string, number>,
  reason: string,
  team: string | undefined,
  state: ReliefState,
): string {
  const addressee = team?.trim() || "team";
  const lines: string[] = [
    "Subject: ReliefMatch Triage — Offer Review",
    "",
    `Hello ${addressee},`,
    "",
    "We've reviewed your latest offer against live distribution requirements.",
    "",
    `Note: automated extraction ran on the offline fallback (${reason}). Please verify the quantities below.`,
    "",
  ];

  if (Object.keys(quantities).length === 0) {
    lines.push(
      "We could not confirm any specific item quantities in your message.",
      'Please reply with explicit counts, e.g. "200 notebooks, 50 jackets".',
      "",
      "— ReliefMatch Triage",
    );
    return lines.join("\n");
  }

  lines.push("Offered quantities and current shortfall for each item you mentioned:", "");
  for (const [item, qty] of Object.entries(quantities)) {
    const b = itemBreakdown(item, state);
    lines.push(
      `  - ${item}: offered ${qty} · current shortfall ${b.gap} (need ${b.need}, pledged ${b.pledged}, on hand ${b.stock})`,
    );
  }
  lines.push("");

  const clashes = detectClashes(state);
  if (clashes.length > 0) {
    lines.push("Distribution warnings detected on the current grid:", "");
    for (const c of clashes) {
      const rec = c.recommendation;
      const recText = rec
        ? `Recommendation: move ${rec.qty} ${c.item} from ${c.community} to ${rec.to_community}.`
        : "No safe reallocation is available for this item.";
      lines.push(`  - ${c.item} @ ${c.community} is over-pledged by ${c.overage} [${c.severity}]. ${recText}`);
    }
    lines.push("");
  } else {
    lines.push("No distribution clashes are detected; all active pledges are within need.", "");
  }

  lines.push("Please confirm these quantities so we can update the allocation grid.", "", "— ReliefMatch Triage");
  return lines.join("\n");
}

export function runTriage(text: string, team?: string): TriageResponse {
  const state = getState();
  const quantities = regexExtract(text);
  const reason = "mock engine: deterministic regex extraction";
  const perItem = Object.fromEntries(Object.keys(quantities).map((i) => [i, itemBreakdown(i, state)]));
  return {
    extraction: quantities,
    source: "regex-fallback",
    fallback_reason: reason,
    metrics: {
      gaps: Object.fromEntries(Object.entries(perItem).map(([i, b]) => [i, b.gap])),
      gaps_per_item: perItem,
      clashes: detectClashes(state),
    },
    drafted_email: buildTriageEmail(quantities, reason, team, state),
  };
}

export class ReallocationError extends Error {}

export function runReallocation(pledgeId: string, toCommunity: string, qty: number): ReallocationResponse {
  const before = getState();
  const gapsOf = (s: ReliefState) => Object.fromEntries(allItems(s).map((i) => [i, itemBreakdown(i, s).gap]));
  const beforeGaps = gapsOf(before);
  const beforeClashes = detectClashes(before);

  const source = before.active_pledges.find((p) => p.pledge_id === pledgeId);
  if (!source) throw new ReallocationError(`pledge_id '${pledgeId}' not found in active_pledges.`);
  if (!Number.isInteger(qty) || qty <= 0) throw new ReallocationError("qty must be a positive integer.");
  if (qty > source.qty)
    throw new ReallocationError(`cannot move ${qty} units; pledge '${pledgeId}' only holds ${source.qty}.`);
  const target = toCommunity.trim();
  if (!target) throw new ReallocationError("to_community must be a non-empty string.");

  const next = structuredClone(before);
  const pledge = next.active_pledges.find((p) => p.pledge_id === pledgeId)!;
  let summary: string;

  if (target === pledge.to_community) {
    summary = `Pledge '${pledgeId}' already targets '${target}'; no change applied.`;
  } else if (qty === pledge.qty) {
    pledge.to_community = target;
    summary = `Shifted ${qty} x ${pledge.item} from pledge '${pledgeId}' to '${target}'.`;
  } else {
    pledge.qty -= qty;
    const taken = new Set(next.active_pledges.map((p) => p.pledge_id));
    let newId = `${pledgeId}_relocated`;
    for (let n = 2; taken.has(newId); n++) newId = `${pledgeId}_relocated_${n}`;
    next.active_pledges.push({ pledge_id: newId, team: pledge.team, item: pledge.item, qty, to_community: target });
    summary = `Split pledge '${pledgeId}': moved ${qty} x ${pledge.item} to '${target}', leaving ${pledge.qty} x ${pledge.item} at the original destination.`;
  }

  saveState(next);
  return {
    applied: { pledge_id: pledgeId, to_community: target, qty },
    state_after: next,
    before: { gaps: beforeGaps, clashes: beforeClashes },
    after: { gaps: gapsOf(next), clashes: detectClashes(next), summary },
  };
}
