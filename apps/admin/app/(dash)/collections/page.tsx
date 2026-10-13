import Link from 'next/link';
import { Badge, Empty, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Collections({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const filter = sp.filter ?? 'OVERDUE';
  const { t, dict } = await getT();
  const rows = await apiGet<any[]>(`/v1/staff/collections?filter=${filter}`);
  const total = rows.reduce((s, r) => s + r.remainingCents, 0);
  return (
    <>
      <PageHeader title={t('collections')} sub={`${rows.length} · ${usd(total)} unpaid`} />
      <div className="row" style={{ marginBottom: 12 }}>
        {[['OVERDUE', dict.rentals.status.OVERDUE], ['DUE_SOON', '≤ 7 days'], ['ALL_OPEN', 'All open']].map(([k, l]) => (
          <Link key={k} className={`btn ${filter === k ? '' : 'secondary'}`} href={`/collections?filter=${k}`}>{l}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={['Lease', 'Tenant', 'Listing', 'Period', 'Due', 'Total', 'Collected', 'Remaining', t('status')]}>
          {rows.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/agreements/${o.agreementId}`}>{o.agreementRef}</Link></td>
              <td>{o.tenantName}</td><td>{o.propertyRef}</td>
              <td>{o.periodStart} → {o.periodEnd}</td><td>{o.dueDate}</td>
              <td className="num">{usd(o.totalCents)}</td><td className="num">{usd(o.collectedCents)}</td><td className="num"><strong>{usd(o.remainingCents)}</strong></td>
              <td><Badge value={o.status} label={(dict.rentals.status as any)[o.status]} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
