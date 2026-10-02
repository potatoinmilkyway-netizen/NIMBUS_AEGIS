import { NextResponse } from "next/server";
import { hasRemoteBackend, proxyToBackend } from "@/lib/backend";
import { buildGridState } from "@/lib/relief-core";

export const dynamic = "force-dynamic";

export async function GET() {
  if (hasRemoteBackend()) {
    try {
      const { status, body } = await proxyToBackend("/api/grid_state");
      return NextResponse.json({ ...body, engine: "fastapi" }, { status });
    } catch {
      return NextResponse.json({ detail: "FastAPI backend unreachable." }, { status: 502 });
    }
  }
  return NextResponse.json(buildGridState());
}
