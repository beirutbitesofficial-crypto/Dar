import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date } from '@/lib/format';
import { getT } from '@/lib/i18n';

const COLUMNS = ['NEW', 'ASSIGNED', 'CONTACTED', 'VIEWING_SCHEDULED', 'VIEWED', 'NEGOTIATION', 'WON'] as const;

export default async function Leads() {
  const { t, locale } = await getT();
  const data = await apiGet('/v1/staff/leads');
  const lost = data.items.filter((l: any) => l.status === 'LOST');
  return (
    <>
      <PageHeader title={t('pipeline')} sub={`${data.total}`} />
      <div className="kanban">
        {COLUMNS.map((s) => {
          const items = data.items.filter((l: any) => l.status === s);
          return (
            <div className="col" key={s}>
              <strong>{s.replaceAll('_', ' ').toLowerCase()}</strong> <span className="sub">({items.length})</span>
              {items.map((l: any) => (
                <div className="item" key={l.id}>
                  <Link href={`/leads/${l.id}`}>{l.customerName}</Link>
                  <div className="sub">{l.propertyRef} · {l.propertyTitle}</div>
                  <div className="sub">{l.assignedEmployeeName ?? '—'} · {date(l.updatedAt, locale)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {lost.length > 0 && (
        <details className="card" style={{ marginTop: 18 }}>
          <summary>Lost ({lost.length})</summary>
          {lost.map((l: any) => <p key={l.id}><Link href={`/leads/${l.id}`}>{l.customerName}</Link> — {l.propertyRef} — {l.lostReason}</p>)}
        </details>
      )}
    </>
  );
}
