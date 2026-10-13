import { NextRequest, NextResponse } from 'next/server';

const ACCESS = 'dar_admin_at';
const REFRESH = 'dar_admin_rt';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const secure = process.env.COOKIE_SECURE === 'true';

function expiresSoon(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 - Date.now() < 60_000;
  } catch {
    return true;
  }
}

/** Keeps the staff session alive by rotating tokens before the access token expires. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/p/') || pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();
  const access = req.cookies.get(ACCESS)?.value;
  const refresh = req.cookies.get(REFRESH)?.value;
  if (!refresh) return NextResponse.redirect(new URL('/login', req.url));
  // Tell the dashboard layout which section is being rendered (used to show a
  // clear "admins only" notice; the API enforces the actual permission).
  const pathHeaders = new Headers(req.headers);
  pathHeaders.set('x-dar-path', pathname);
  if (!expiresSoon(access)) return NextResponse.next({ request: { headers: pathHeaders } });

  const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
  if (!r.ok) {
    const res = NextResponse.redirect(new URL('/login?expired=1', req.url));
    res.cookies.delete(ACCESS);
    res.cookies.delete(REFRESH);
    return res;
  }
  const t = await r.json();
  // Make the new token visible to server components rendering this request.
  const headers = pathHeaders;
  const cookie = (req.headers.get('cookie') ?? '').split('; ').filter((c) => !c.startsWith(`${ACCESS}=`) && !c.startsWith(`${REFRESH}=`));
  cookie.push(`${ACCESS}=${t.accessToken}`, `${REFRESH}=${t.refreshToken}`);
  headers.set('cookie', cookie.join('; '));
  const res = NextResponse.next({ request: { headers } });
  const opts = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  res.cookies.set(ACCESS, t.accessToken, { ...opts, maxAge: 60 * 60 });
  res.cookies.set(REFRESH, t.refreshToken, { ...opts, maxAge: 12 * 60 * 60 });
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
