import Link from 'next/link';
import { ApiForm, Badge, Card, Empty, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Viewings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, dict, locale } = await getT();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 21 * 86_400_000);
  const [queue, calendar] = await Promise.all([
    apiGet<any[]>('/v1/staff/viewings/requests'),
    apiGet<any[]>(`/v1/staff/viewings/calendar?from=${from.toISOString()}&to=${to.toISOString()}`),
  ]);
  const periods: Record<string, string> = { MORNING: dict.viewing.morning, AFTERNOON: dict.viewing.afternoon, EVENING: dict.viewing.evening };
  return (
    <>
      <PageHeader title={t('viewings')} />
      <Flash sp={sp} />
      <Card title={t('requests')}>
        {queue.length === 0 ? <Empty text={t('empty')} /> : (
          <Table head={['Listing', 'Customer', 'Preferred', 'Notes', t('confirm')]}>
            {queue.map((v) => (
              <tr key={v.id}>
                <td>{v.propertyRef}<div className="sub">{v.propertyTitle}</div></td>
                <td>{v.leadId ? <Link href={`/leads/${v.leadId}`}>{v.customerName}</Link> : v.customerName}</td>
                <td>{(v.preferredSlots as any[]).map((s, i) => <div key={i}>{s.date} · {periods[s.period]}</div>)}</td>
                <td>{v.customerNotes}</td>
                <td>
                  <ApiForm path={`/v1/staff/viewings/${v.id}/confirm`} back="/viewings" className="form">
                    <ConfirmFields />
                    <div className="row">
                      <button>{t('confirm')}</button>
                    </div>
                  </ApiForm>
                  <ApiForm path={`/v1/staff/viewings/${v.id}/outcome`} back="/viewings"><input type="hidden" name="status" value="CANCELLED" /><button className="link">{dict.viewing.cancel}</button></ApiForm>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Card title={`${t('calendar')} (21d)`}>
        {calendar.length === 0 ? <Empty text={t('empty')} /> : (
          <Table head={[t('date'), 'Listing', 'Customer', t('employee'), t('status'), '']}>
            {calendar.map((v) => (
              <tr key={v.id}>
                <td>{dateTime(v.scheduledAt, locale)}</td>
                <td>{v.propertyRef} · {v.propertyTitle}</td>
                <td>{v.customerName}</td>
                <td>{v.employeeName}</td>
                <td><Badge value={v.status} label={dict.viewingStatus[v.status as 'CONFIRMED']} /></td>
                <td>
                  {v.status === 'CONFIRMED' && (
                    <ApiForm path={`/v1/staff/viewings/${v.id}/outcome`} back="/viewings">
                      <select name="status"><option value="COMPLETED">{dict.viewingStatus.COMPLETED}</option><option value="NO_SHOW">{dict.viewingStatus.NO_SHOW}</option><option value="CANCELLED">{dict.viewingStatus.CANCELLED}</option></select>
                      <input name="notes" placeholder="Notes" />
                      <button className="secondary">{t('save')}</button>
                    </ApiForm>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/** datetime-local is interpreted as Beirut time (+03:00 / +02:00 handled by the hidden offset field). */
function ConfirmFields() {
  return (
    <>
      <input type="datetime-local" name="scheduledAtLocal" required />
      <select name="num:durationMinutes" defaultValue="45"><option value="30">30m</option><option value="45">45m</option><option value="60">60m</option><option value="90">90m</option></select>
      <input name="meetingInstructions" placeholder="Meeting point / instructions (sent to customer)" />
    </>
  );
}
