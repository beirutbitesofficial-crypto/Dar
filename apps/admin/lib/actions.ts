'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseMoneyInput } from '@dar/shared';
import { ACCESS_COOKIE, API_URL, ApiError, apiFetch, REFRESH_COOKIE } from './api';

/**
 * Server actions used by dashboard forms. Every action calls the API, which
 * performs the authorization check. Results are passed back through the URL
 * (?ok= / ?error=) so pages stay server-rendered and work without JavaScript.
 */
export type ActionState = { ok?: string; error?: string } | undefined;

const secure = process.env.COOKIE_SECURE === 'true';

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: form.get('email'), password: form.get('password'), device: 'admin' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body?.error?.code ?? 'INVALID_CREDENTIALS' };
  const jar = await cookies();
  const opts = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  jar.set(ACCESS_COOKIE, body.accessToken, { ...opts, maxAge: 60 * 60 });
  jar.set(REFRESH_COOKIE, body.refreshToken, { ...opts, maxAge: 12 * 60 * 60 });
  redirect('/');
}

export async function logout() {
  await apiFetch('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect('/login');
}

export async function toggleLocale() {
  const jar = await cookies();
  jar.set('dar_admin_locale', jar.get('dar_admin_locale')?.value === 'en' ? 'ar' : 'en', { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

/**
 * Generic form → API action. Hidden inputs:
 *   _method (POST|PUT), _path (API path), _back (page to return to),
 *   _idem=1 adds a fresh idempotency key; fields ending in "Usd" are parsed
 *   into integer cents ("Usd" suffix removed, "Cents" appended).
 *   Fields named "num:<name>" are sent as numbers, "bool:<name>" as booleans,
 *   "list:<name>" as an array of all values.
 */
export async function submit(form: FormData) {
  const method = String(form.get('_method') ?? 'POST');
  const path = String(form.get('_path'));
  const back = String(form.get('_back') ?? '/');
  const body: Record<string, unknown> = {};
  // "a.b" keys build nested objects, e.g. buyerAcceptance.acceptedAt
  const put = (key: string, value: unknown) => {
    const parts = key.split('.');
    let cur = body as Record<string, any>;
    for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
    cur[parts[parts.length - 1]!] = value;
  };
  const get = (key: string) => key.split('.').reduce<any>((o, p) => o?.[p], body);
  for (const [rawKey, value] of form.entries()) {
    if (rawKey.startsWith('_') || rawKey.startsWith('$ACTION')) continue;
    const v = String(value);
    if (rawKey.startsWith('list:')) {
      if (v === '') continue;
      const numeric = rawKey.startsWith('list:num:');
      const k = rawKey.slice(numeric ? 9 : 5);
      put(k, [...((get(k) as unknown[]) ?? []), numeric ? Number(v) : v]);
    } else if (v === '') continue;
    else if (rawKey.endsWith('AtLocal')) put(rawKey.slice(0, -5), beirutLocalToIso(v));
    else if (rawKey.startsWith('num:')) put(rawKey.slice(4), Number(v));
    else if (rawKey.startsWith('bool:')) put(rawKey.slice(5), v === 'true' || v === 'on');
    else if (rawKey.endsWith('Usd')) {
      const cents = parseMoneyInput(v);
      if (cents === null) redirect(`${back}${back.includes('?') ? '&' : '?'}error=MONEY_INVALID`);
      put(`${rawKey.slice(0, -3)}Cents`, cents);
    } else put(rawKey, v);
  }
  if (form.get('_idem')) body.idempotencyKey = randomUUID();
  let error: string | undefined;
  try {
    await apiFetch(path, { method, json: body });
  } catch (e) {
    if (e instanceof ApiError) error = e.details?.fields?.[0] ? `${e.code}:${e.details.fields[0].path}` : e.code;
    else throw e;
  }
  revalidatePath(back.split('?')[0]!);
  redirect(`${back.split('?')[0]}?${error ? `error=${encodeURIComponent(error)}` : 'ok=1'}`);
}

/** "2026-10-20T11:00" entered by staff in Beirut → "2026-10-20T08:00:00.000Z" (DST-aware). */
function beirutLocalToIso(local: string): string {
  const guess = Date.parse(`${local}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  return new Date(guess - (wall - guess)).toISOString();
}
