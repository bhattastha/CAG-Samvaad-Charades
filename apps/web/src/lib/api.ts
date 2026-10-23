export class ApiError extends Error {
  constructor(public status: number, public code: string, public body?: any) { super(code); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    signal: opts.signal,
  });
  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as any)?.error ?? String(res.status), data);
  return data as T;
}

/** Stable per-tab id for the one-live-window rule (§15.5). */
export const clientId: string = (() => {
  try {
    const k = "hc.clientId";
    const v = sessionStorage.getItem(k) ?? `c-${crypto.randomUUID()}`;
    sessionStorage.setItem(k, v);
    return v;
  } catch {
    return `c-${Math.random().toString(36).slice(2)}${Date.now()}`;
  }
})();
