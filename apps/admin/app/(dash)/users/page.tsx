import { ConfirmButton } from '@/components/nav';
import { ApiForm, Card, DemoBadge, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date } from '@/lib/format';
import { getT } from '@/lib/i18n';

const ROLES = ['CUSTOMER', 'OWNER', 'EMPLOYEE', 'ADMIN'] as const;

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const qs = new URLSearchParams(Object.entries({ q: sp.q, role: sp.role }).filter(([, v]) => v) as [string, string][]);
  const [data, deletions] = await Promise.all([apiGet(`/v1/admin/users?${qs}`), apiGet<any[]>('/v1/admin/deletion-requests')]);
  return (
    <>
      <PageHeader title={t('users')} sub={`${data.total}`} />
      <Flash sp={sp} />
      <form className="row card" style={{ padding: 14 }}>
        <label>{t('search')}<input name="q" defaultValue={sp.q} /></label>
        <label>Role<select name="role" defaultValue={sp.role ?? ''}><option value="">—</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <button className="secondary">{t('search')}</button>
      </form>
      {deletions.length > 0 && (
        <Card title="Account deletion requests">
          <p className="sub">Review active leases and balances first. Completing anonymizes personal data; financial records are kept for the legal retention period (docs/PRIVACY_RETENTION.md).</p>
          {deletions.map((d) => (
            <div key={d.id} className="row">
              <span>{d.user.fullName} · {d.user.email} · {date(d.requestedAt, locale)} — {d.reason}</span>
              <ApiForm path={`/v1/admin/deletion-requests/${d.id}/complete`} back="/users"><ConfirmButton className="danger" message="Anonymize this account? This cannot be undone.">Anonymize</ConfirmButton></ApiForm>
            </div>
          ))}
        </Card>
      )}
      <Table head={['Name', 'Email', 'Phone', 'Roles', 'Open leads', t('actions')]}>
        {data.items.map((u: any) => (
          <tr key={u.id}>
            <td>{u.fullName} <DemoBadge show={u.demo} label={t('demo')} /> {u.blocked && <span className="badge red">blocked</span>}</td>
            <td dir="ltr">{u.email}</td>
            <td dir="ltr">{u.phone ?? '—'} {u.phone && !u.phoneVerifiedAt && <span className="badge">unverified</span>}</td>
            <td>{u.roles.join(', ')}{u.canRecordCollections && <span className="badge blue">collections</span>}</td>
            <td className="num">{u._count.assignedLeads}</td>
            <td>
              <details>
                <summary>Edit</summary>
                <ApiForm path={`/v1/admin/users/${u.id}/roles`} method="PUT" back="/users" className="form">
                  <div className="row">{ROLES.map((r) => <label key={r}><span><input type="checkbox" name="list:roles" value={r} defaultChecked={u.roles.includes(r)} /> {r}</span></label>)}</div>
                  <select name="bool:canRecordCollections" defaultValue={String(u.canRecordCollections)}><option value="false">Cannot record collections</option><option value="true">Can record collections (assigned leases)</option></select>
                  <select name="bool:blocked" defaultValue={String(u.blocked)}><option value="false">Active</option><option value="true">Blocked</option></select>
                  <input name="reason" placeholder={t('reason')} required minLength={5} />
                  <div><button className="secondary">{t('save')}</button></div>
                </ApiForm>
              </details>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
