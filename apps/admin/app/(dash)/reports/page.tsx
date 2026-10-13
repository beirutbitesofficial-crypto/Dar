import Link from 'next/link';
import { ApiForm, Empty, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Reports({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const rows = await apiGet<any[]>('/v1/admin/reports');
  return (
    <>
      <PageHeader title={t('reports')} sub="Reported listings, messages and users" />
      <Flash sp={sp} />
      {rows.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={['Target', 'Reason', 'Details', 'Reporter', t('date'), t('actions')]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.targetType} {r.targetType === 'LISTING' ? <Link href={`/properties/${r.targetId}`}>open</Link> : <code>{r.targetId.slice(0, 8)}</code>}</td>
              <td>{r.reason}</td><td>{r.details}</td><td>{r.reporter.fullName}</td><td>{dateTime(r.createdAt, locale)}</td>
              <td>
                <ApiForm path={`/v1/admin/reports/${r.id}/resolve`} back="/reports" className="form">
                  <select name="status"><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option></select>
                  <input name="resolution" placeholder="What was done" required minLength={3} />
                  <label><span><input type="checkbox" name="bool:blockUser" /> Block the responsible user</span></label>
                  <button className="secondary">{t('save')}</button>
                </ApiForm>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
