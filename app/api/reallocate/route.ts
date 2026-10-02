import { NextResponse } from "next/server";
import { hasRemoteBackend, proxyToBackend } from "@/lib/backend";
import { ReallocationError, runReallocation } from "@/lib/relief-core";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const pledgeId = typeof payload?.pledge_id === "string" ? payload.pledge_id.trim() : "";
  const toCommunity = typeof payload?.to_community === "string" ? payload.to_community.trim() : "";
  const qty = payload?.qty;

  if (!pledgeId || !toCommunity)
    return NextResponse.json({ detail: "pledge_id and to_community are required." }, { status: 422 });
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0 || qty > 1_000_000)
    return NextResponse.json({ detail: "qty must be a positive integer." }, { status: 422 });

  if (hasRemoteBackend()) {
    try {
      const { status, body } = await proxyToBackend("/api/reallocate", {
        method: "POST",
        body: JSON.stringify({ pledge_id: pledgeId, to_community: toCommunity, qty }),
      });
      return NextResponse.json(body, { status });
    } catch {
      return NextResponse.json({ detail: "FastAPI backend unreachable." }, { status: 502 });
    }
  }

  try {
    return NextResponse.json(runReallocation(pledgeId, toCommunity, qty));
  } catch (error) {
    if (error instanceof ReallocationError) return NextResponse.json({ detail: error.message }, { status: 400 });
    throw error;
  }
}
