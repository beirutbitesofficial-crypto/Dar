import { randomUUID } from 'node:crypto';
import { ApiForm, Card, Flash, PageHeader } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { getT } from '@/lib/i18n';

const SYSTEM_TEXT: Record<string, string> = { 'viewing.requested': 'طلب زيارة جديد · Viewing requested' };

export default async function Conversation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, locale } = await getT();
  const [messages, notes] = await Promise.all([apiGet<any[]>(`/v1/conversations/${id}/messages`), apiGet<any[]>(`/v1/staff/conversations/${id}/notes`)]);
  await apiPost(`/v1/conversations/${id}/read`).catch(() => undefined);
  const back = `/conversations/${id}`;
  return (
    <>
      <PageHeader title={t('conversations')} sub="Customers talk to our team only — never directly with owners." />
      <Flash sp={sp} />
      <div className="grid g2">
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.senderRole === 'STAFF' ? 'staff' : m.senderRole === 'SYSTEM' ? 'system' : ''}`}>
                {m.senderRole === 'SYSTEM' ? SYSTEM_TEXT[m.body] ?? m.body : m.body}
                {m.attachments.map((a: any) => <div key={a.id}><a href={a.url} target="_blank" rel="noreferrer">📎 {a.fileName}</a></div>)}
                <div className="sub" style={{ fontSize: 11 }}>
                  {m.senderName} · {dateTime(m.createdAt, locale)}
                  {m.senderRole !== 'SYSTEM' && (
                    <ApiForm path={`/v1/staff/messages/${m.id}/hide`} back={back}>
                      <input type="hidden" name="reason" value="Hidden by staff (policy)" />
                      <button className="link" style={{ fontSize: 11 }}>hide</button>
                    </ApiForm>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ApiForm path={`/v1/conversations/${id}/messages`} back={back} className="form">
            <input type="hidden" name="clientMessageId" value={randomUUID()} />
            <textarea name="body" required placeholder="…" />
            <div><button>{'➤'}</button></div>
          </ApiForm>
        </Card>
        <Card title={t('notes')} className="private">
          <p className="sub">Internal — never visible to the customer.</p>
          <ApiForm path={`/v1/staff/conversations/${id}/notes`} back={back} className="form">
            <textarea name="body" required />
            <div><button className="secondary">{t('addNote')}</button></div>
          </ApiForm>
          {notes.map((n) => <p key={n.id}><span className="sub">{dateTime(n.createdAt, locale)}</span><br />{n.body}</p>)}
        </Card>
      </div>
    </>
  );
}
