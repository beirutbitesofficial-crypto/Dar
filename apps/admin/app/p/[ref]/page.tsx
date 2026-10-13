import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BRAND, formatUSD, type PublicListing } from '@dar/shared';

/**
 * Public share page (/p/DAR-1001). Uses ONLY the public listing endpoint, so it
 * can never show owner contacts, exact addresses or precise locations.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

async function load(ref: string): Promise<PublicListing | null> {
  const res = await fetch(`${API_URL}/v1/listings/${encodeURIComponent(ref)}`, { next: { revalidate: 300 } });
  return res.ok ? res.json() : null;
}

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const l = await load((await params).ref);
  return l ? { title: `${l.title.ar} · ${BRAND.name.ar}`, openGraph: { title: l.title.ar, images: l.photos[0] ? [l.photos[0].url] : [] }, robots: { index: !l.demo } } : { title: BRAND.name.ar };
}

export default async function SharePage({ params }: { params: Promise<{ ref: string }> }) {
  const l = await load((await params).ref);
  if (!l) notFound();
  const price = l.pricing.kind === 'SALE' ? formatUSD(l.pricing.askingPriceCents, 'ar') : `${formatUSD(l.pricing.tenantMonthlyTotalCents, 'ar')} / شهرياً`;
  return (
    <main className="main" style={{ margin: '0 auto', maxWidth: 760 }} dir="rtl">
      <div className="brand"><b>{BRAND.name.ar}</b><span>{BRAND.tagline.ar}</span></div>
      {l.demo && <p className="notice">هذا إعلان تجريبي لأغراض العرض فقط وليس عقاراً حقيقياً · Demo listing — not a real property.</p>}
      {l.photos[0] && <img src={l.photos[0].url} alt="" style={{ width: '100%', borderRadius: 16, aspectRatio: '4 / 3', objectFit: 'cover' }} />}
      <h1 style={{ marginTop: 16 }}>{l.title.ar}</h1>
      <p className="sub">{[l.location.neighborhoodName?.ar, l.location.townName.ar, l.location.areaName.ar].filter(Boolean).join('، ')} · {l.ref}</p>
      <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--primary)' }}>{price}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{l.description.ar}</p>
      <div className="card">
        <p>للزيارة أو للاستفسار تواصل مع فريق {BRAND.name.ar} عبر التطبيق · Contact the {BRAND.name.en} team in the app to arrange a viewing.</p>
        <p className="sub" dir="ltr">{BRAND.contact.phone} · {BRAND.contact.email}</p>
      </div>
    </main>
  );
}
