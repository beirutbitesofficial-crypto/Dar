import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server-side API client. The access token lives in an httpOnly cookie and
 * never reaches browser JavaScript. Authorization is enforced by the API;
 * the dashboard only hides what the API would refuse anyway.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const ACCESS_COOKIE = 'dar_admin_at';
export const REFRESH_COOKIE = 'dar_admin_rt';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  if (res.status === 401) redirect('/login?expired=1');
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? res.statusText, body?.error?.details);
  return body as T;
}

export const apiGet = <T = any>(path: string) => apiFetch<T>(path);
export const apiPost = <T = any>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'POST', json: json ?? {} });
export const apiPut = <T = any>(path: string, json?: unknown) => apiFetch<T>(path, { method: 'PUT', json: json ?? {} });

/** Raw text/CSV/HTML passthrough for downloads and printables. */
export async function apiRaw(path: string) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return fetch(`${API_URL}${path}`, { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

export interface Me {
  id: string;
  fullName: string;
  roles: string[];
  canRecordCollections: boolean;
}

export async function me(): Promise<Me> {
  return apiGet<Me>('/v1/auth/me');
}

export const isAdmin = (m: Me) => m.roles.includes('ADMIN');
