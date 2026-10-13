import { PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string; entityId?: string; before?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const rows = await apiGet<any[]>(`/v1/admin/audit?${qs}`);
  const last = rows[rows.length - 1];
  return (
    <>
      <PageHeader title={t('audit')} sub="Append-only: financial changes, permission changes and access to private data" />
      <form className="row card" style={{ padding: 14 }}>
        <label>Action prefix<select name="action" defaultValue={sp.action ?? ''}>
          {['', 'sensitive.', 'rental.', 'sale.', 'payout.', 'pricing.', 'user.', 'listing.', 'auth.', 'export.'].map((a) => <option key={a} value={a}>{a || 'All'}</option>)}
        </select></label>
        <label>Entity ID<input name="entityId" defaultValue={sp.entityId} /></label>
        <button className="secondary">{t('search')}</button>
      </form>
      <Table head={[t('date'), 'Action', 'Entity', 'Actor', 'Details']}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{dateTime(r.createdAt, locale)}</td><td><code>{r.action}</code></td><td>{r.entityType} <code>{r.entityId.slice(0, 10)}</code></td>
            <td><code>{r.actorId?.slice(0, 10) ?? 'system'}</code></td><td><code style={{ fontSize: 11 }}>{r.metadata ? JSON.stringify(r.metadata).slice(0, 160) : ''}</code></td>
          </tr>
        ))}
      </Table>
      {last && rows.length === 200 && <p><a href={`/audit?${new URLSearchParams({ ...sp, before: last.createdAt } as any)}`}>Older →</a></p>}
    </>
  );
}
