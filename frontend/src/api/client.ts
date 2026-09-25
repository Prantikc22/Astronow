import { storage } from "@/src/utils/storage";
import { isPreviewSession, previewRequest, previewStream } from "@/src/api/preview";
import { supabase } from "@/src/services/supabase";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export const TOKEN_KEY = "cc_access_token";
export const REFRESH_KEY = "cc_refresh_token";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function loadStoredToken(): Promise<string | null> {
  const t = await storage.secureGet(TOKEN_KEY, "");
  accessToken = t || null;
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, message: string, payload?: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      setAccessToken(data.session.access_token);
      return true;
    }
  }
  const refreshToken = await storage.secureGet(REFRESH_KEY, "");
  if (!refreshToken) return false;
  const refreshed = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!refreshed.ok) return false;
  const session = await refreshed.json();
  setAccessToken(session.access_token);
  await storage.secureSet(TOKEN_KEY, session.access_token);
  if (session.refresh_token) await storage.secureSet(REFRESH_KEY, session.refresh_token);
  return true;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  auth = true,
  retried = false,
): Promise<T> {
  if (isPreviewSession()) return previewRequest(method, path, body) as Promise<T>;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && auth && !retried) {
    if (await refreshAccessToken()) return request<T>(method, path, body, auth, true);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = data?.detail ?? data?.message ?? text ?? "Request failed";
    let parsedDetail = detail;
    if (typeof detail === "string" && detail.startsWith("{")) {
      try {
        parsedDetail = JSON.parse(detail);
      } catch {
        /* keep string */
      }
    }
    throw new ApiError(res.status, typeof parsedDetail === "string" ? parsedDetail : (parsedDetail?.reason ?? "Request failed"), parsedDetail);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, auth = true) => request<T>("GET", p, undefined, auth),
  post: <T = any>(p: string, body?: any, auth = true) => request<T>("POST", p, body, auth),
  patch: <T = any>(p: string, body?: any) => request<T>("PATCH", p, body),
  del: <T = any>(p: string) => request<T>("DELETE", p),
  base: BASE,
};

export async function streamChat(
  cid: string,
  content: string,
  onChunk: (t: string) => void,
  retried = false,
): Promise<void> {
  if (isPreviewSession()) return previewStream(content, onChunk);
  const res = await fetch(`${BASE}/ask/stream?cid=${cid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ content }),
  });
  if (res.status === 401 && !retried && await refreshAccessToken()) {
    return streamChat(cid, content, onChunk, true);
  }
  if (!res.ok) {
    const t = await res.text();
    let detail = t;
    try { detail = JSON.parse(t)?.detail || t; } catch { /* keep response text */ }
    throw new ApiError(res.status, detail || "Stream failed");
  }
  const reader = (res.body as any)?.getReader?.();
  if (!reader) {
    onChunk(await res.text());
    return;
  }
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
  const tail = decoder.decode();
  if (tail) onChunk(tail);
}
