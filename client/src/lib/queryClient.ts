import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Session token lives in memory only (storage APIs are unavailable inside the sandboxed preview iframe).
let authToken: string | null = null;
export const setAuthToken = (t: string | null) => { authToken = t; };
export const getAuthToken = () => authToken;
export const mediaUrl = (p: string) => `${API_BASE}${p}`;
/** Download an authenticated file via fetch + Blob so the session token never appears in a URL. */
export async function downloadFile(p: string, filename: string) {
  const res = await fetch(`${API_BASE}${p}`, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}, credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.message || msg; } catch { /* not json */ }
    throw new ApiError(res.status, msg || "Request failed");
  }
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${url}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
  await throwIfResNotOk(res);
  return res;
}
export async function api<T = any>(method: string, url: string, data?: unknown): Promise<T> {
  const r = await apiRequest(method, url, data);
  return r.json();
}

export const getQueryFn: <T>(options: { on401: "returnNull" | "throw" }) => QueryFunction<T> =
  ({ on401 }) => async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { headers });
    if (on401 === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { queryFn: getQueryFn({ on401: "throw" }), refetchInterval: false, refetchOnWindowFocus: false, staleTime: 30_000, retry: false },
    mutations: { retry: false },
  },
});

// report unexpected client errors to the backend log
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => { fetch(`${API_BASE}/api/errors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: e.message, stack: e.error?.stack, url: location.hash }) }).catch(() => {}); });
}
