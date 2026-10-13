import Constants from 'expo-constants';
import * as SecureStore from './secure-store';
import type { AuthTokens } from '@dar/shared';

/**
 * API client. Tokens are kept in the device keychain/keystore (SecureStore),
 * never in plain AsyncStorage. Access tokens are short-lived and refreshed
 * transparently; concurrent requests share a single refresh.
 */
export const API_URL: string = (Constants.expoConfig?.extra as any)?.apiUrl ?? 'http://localhost:4000';
const ACCESS = 'dar.at';
const REFRESH = 'dar.rt';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
  get offline() {
    return this.status === 0;
  }
}

let access: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: (() => void) | null = null;

export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

export async function loadTokens() {
  access = await SecureStore.getItemAsync(ACCESS);
  return !!(await SecureStore.getItemAsync(REFRESH));
}

export async function saveTokens(t: AuthTokens) {
  access = t.accessToken;
  await SecureStore.setItemAsync(ACCESS, t.accessToken);
  await SecureStore.setItemAsync(REFRESH, t.refreshToken);
}

export async function clearTokens() {
  access = null;
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const rt = await SecureStore.getItemAsync(REFRESH);
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
      if (!res.ok) {
        if (res.status === 401) {
          await clearTokens();
          onSignedOut?.();
        }
        return false;
      }
      await saveTokens(await res.json());
      return true;
    } catch {
      return false; // offline: keep tokens, try again later
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(access && init.auth !== false ? { Authorization: `Bearer ${access}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'Network unavailable');
  }
  if (res.status === 401 && !retried && access) {
    if (await refresh()) return api<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'GENERIC', json?.error?.message ?? 'Request failed', json?.error?.details);
  return json as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });
