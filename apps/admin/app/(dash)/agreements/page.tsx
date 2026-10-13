import Link from 'next/link';
import { Badge, Empty, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function Agreements({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const { t, b, locale } = await getT();
  const rows = await apiGet<any[]>(`/v1/staff/agreements${sp.status ? `?status=${sp.status}` : ''}`);
  return (
    <>
      <PageHeader title={t('agreements')} sub="New leases are created from a lead (Leads → lead → New agreement)." />
      <div className="row" style={{ marginBottom: 12 }}>
        {['', 'DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED'].map((s) => <Link key={s} className="btn secondary" href={s ? `/agreements?status=${s}` : '/agreements'}>{s ? <Badge value={s} /> : b('الكل', 'All')}</Link>)}
      </div>
      {rows.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={[<L ar="المرجع" en="Ref" />, <L ar="الإعلان" en="Listing" />, <L ar="المالك" en="Landlord" />, <L ar="المستأجر" en="Tenant" />, <L ar="صافي المالك" en="Landlord net" />, <L ar="الرسم" en="Fee" />, <L ar="مجموع المستأجر" en="Tenant total" />, <L ar="المدة" en="Term" />, t('status')]}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/agreements/${a.id}`}>{a.ref}</Link></td>
              <td>{a.propertyRef}</td><td>{a.landlordName}</td><td>{a.tenantName}</td>
              <td className="num">{usd(a.landlordNetCents)}</td><td className="num">{usd(a.platformFeeCents)}</td><td className="num">{usd(a.tenantTotalCents)}</td>
              <td>{date(a.startDate, locale)} → {date(a.endDate, locale)}</td>
              <td><Badge value={a.status} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
