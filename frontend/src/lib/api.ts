// Typed fetch layer over the FastAPI backend. Base is the relative "/api" prefix so the
// same code works in dev (Vite proxies /api → :8001) and behind a single origin in prod.
// Web'de göreli "/api". Masaüstü/Android uygulamasında build sırasında VITE_API_BASE
// (örn. https://sunucun.onrender.com) verilir; çerez yerine Bearer token kullanılır.
const BASE = `${(import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? ""}/api`;

const TOKEN_KEY = "gymforyou_token";
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* yoksay */ }
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type JsonBody = unknown;

async function request<T>(
  method: string,
  path: string,
  body?: JsonBody,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (path === "/auth/logout") setToken(null);

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  if (path === "/auth/login" || path === "/auth/register") {
    const t = (data as { token?: unknown } | null)?.token;
    if (typeof t === "string") setToken(t);
  }
  return data;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: JsonBody) =>
  request<T>("POST", path, body ?? null);
export const apiPut = <T>(path: string, body?: JsonBody) =>
  request<T>("PUT", path, body ?? null);
export const apiPatch = <T>(path: string, body?: JsonBody) =>
  request<T>("PATCH", path, body ?? null);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);