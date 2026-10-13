import Link from 'next/link';
import { Badge, DemoBadge, Empty, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

const STATUSES = ['', 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'PAUSED', 'RENTED', 'SOLD', 'ARCHIVED'];

export default async function Properties({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { t, dict, locale } = await getT();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const data = await apiGet(`/v1/staff/properties?${qs}`);
  return (
    <>
      <PageHeader title={t('properties')} sub={`${data.total}`} />
      <form className="row card" style={{ padding: 14 }}>
        <label>{t('status')}
          <select name="status" defaultValue={sp.status ?? ''}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? dict.listingStatus[s as 'DRAFT'] : '—'}</option>)}
          </select>
        </label>
        <label>{t('search')}<input name="q" defaultValue={sp.q} /></label>
        <button className="secondary">{t('search')}</button>
      </form>
      {data.items.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={['Ref', 'Title', t('status'), 'Type', 'Price', 'Town', t('employee'), 'Owner', 'Updated']}>
          {data.items.map((p: any) => (
            <tr key={p.id}>
              <td><Link href={`/properties/${p.id}`}>{p.ref}</Link> <DemoBadge show={p.demo} label={t('demo')} /></td>
              <td>{p.titleAr ?? '—'} {p.featured && <span className="badge blue">★</span>}</td>
              <td><Badge value={p.status} label={dict.listingStatus[p.status as 'DRAFT']} /></td>
              <td>{p.listingType ? dict.listingType[p.listingType as 'SALE'] : '—'}</td>
              <td className="num">{usd(p.priceCents)}</td>
              <td>{p.town ? (locale === 'ar' ? p.town.nameAr : p.town.nameEn) : '—'}</td>
              <td>{p.assignedEmployee?.fullName ?? '—'}</td>
              <td>{p.owner.fullName} <span className="sub" dir="ltr">{p.owner.phoneMasked}</span></td>
              <td>{date(p.updatedAt, locale)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
