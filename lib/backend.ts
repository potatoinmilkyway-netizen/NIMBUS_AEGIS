import "server-only";

const BACKEND_URL = process.env.RELIEFMATCH_API_URL?.replace(/\/$/, "");

export function hasRemoteBackend() {
  return Boolean(BACKEND_URL);
}

export async function proxyToBackend(path: string, init?: RequestInit) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({ detail: "Invalid response from FastAPI backend." }));
  return { status: res.status, body };
}
