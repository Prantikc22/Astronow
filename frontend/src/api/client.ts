import { storage } from "@/src/utils/storage";

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

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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
): Promise<void> {
  const res = await fetch(`${BASE}/ask/stream?cid=${cid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new ApiError(res.status, t || "Stream failed");
  }
  const reader = (res.body as any)?.getReader?.();
  if (!reader) {
    onChunk(await res.text());
    return;
  }
  const decoder = new TextDecoder();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
