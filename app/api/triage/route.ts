import { NextResponse } from "next/server";
import { hasRemoteBackend, proxyToBackend } from "@/lib/backend";
import { runTriage } from "@/lib/relief-core";

const MAX_TEXT_LENGTH = 10_000;

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  const team = typeof payload?.team === "string" ? payload.team.trim().slice(0, 120) : undefined;

  if (!text) return NextResponse.json({ detail: "text is required." }, { status: 422 });
  if (text.length > MAX_TEXT_LENGTH)
    return NextResponse.json({ detail: `text must be under ${MAX_TEXT_LENGTH} characters.` }, { status: 422 });

  if (hasRemoteBackend()) {
    try {
      const { status, body } = await proxyToBackend("/api/triage", {
        method: "POST",
        body: JSON.stringify({ text, team: team || null }),
      });
      return NextResponse.json(body, { status });
    } catch {
      return NextResponse.json({ detail: "FastAPI backend unreachable." }, { status: 502 });
    }
  }
  return NextResponse.json(runTriage(text, team));
}
