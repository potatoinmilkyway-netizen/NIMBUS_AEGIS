import useSWR from "swr";
import type { GridState, ReallocationResponse, Recommendation, TriageResponse } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return body as T;
}

export function useGridState() {
  return useSWR<GridState>("/api/grid_state", (url: string) => request<GridState>(url), {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}

export function postTriage(text: string, team?: string) {
  return request<TriageResponse>("/api/triage", {
    method: "POST",
    body: JSON.stringify({ text, team: team || undefined }),
  });
}

export function postReallocation(payload: Recommendation) {
  return request<ReallocationResponse>("/api/reallocate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
