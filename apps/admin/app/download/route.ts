import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, apiRaw } from '@/lib/api';

/**
 * Proxies authenticated downloads so the access token never reaches the browser:
 *  - /download?path=/v1/staff/documents/<id>   → short-lived signed URL (audited by the API)
 *  - /download?path=/v1/admin/exports/x.csv    → CSV passthrough
 *  - /download?path=/v1/receipts/... or /v1/statements/... → printable HTML
 */
const ALLOWED = [/^\/v1\/staff\/documents\/[\w-]+$/, /^\/v1\/admin\/exports\/[\w.-]+\.csv(\?.*)?$/, /^\/v1\/receipts\/rent\/[\w-]+$/, /^\/v1\/statements\/owner\/[\w-]+$/];

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') ?? '';
  if (!ALLOWED.some((re) => re.test(path))) return new NextResponse('Not allowed', { status: 400 });
  if (path.startsWith('/v1/staff/documents/')) {
    const { url } = await apiFetch<{ url: string }>(path);
    return NextResponse.redirect(url);
  }
  const res = await apiRaw(path);
  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
      ...(res.headers.get('content-disposition') ? { 'Content-Disposition': res.headers.get('content-disposition')! } : {}),
      'Cache-Control': 'no-store',
    },
  });
}
