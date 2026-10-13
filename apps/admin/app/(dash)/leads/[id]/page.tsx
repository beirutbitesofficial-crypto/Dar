import Link from 'next/link';
import { ApiForm, Badge, Card, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { dateTime, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Lead({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, dict, locale } = await getT();
  const [lead, user] = await Promise.all([apiGet(`/v1/staff/leads/${id}`), me()]);
  const admin = isAdmin(user);
  const employees = admin ? await apiGet<any[]>('/v1/admin/employees') : [];
  const back = `/leads/${id}`;
  return (
    <>
      <PageHeader title={`${lead.customer.fullName}`} sub={<><Badge value={lead.status} /> · <Link href={`/properties/${lead.property.id}`}>{lead.property.ref}</Link> {lead.property.titleAr}</>} />
      <Flash sp={sp} />
      <div className="grid g2">
        <Card title={t('privateData')} className="private">
          <dl className="kv">
            <dt>{dict.account.phone}</dt><dd dir="ltr">{lead.customer.phone ?? '—'} {!lead.customer.phoneVerifiedAt && <span className="badge amber">{dict.account.phoneNotVerified}</span>}</dd>
            <dt>{dict.account.email}</dt><dd dir="ltr">{lead.customer.email}</dd>
            <dt>Source</dt><dd>{lead.source}</dd>
            <dt>{dict.property.askingPrice}</dt><dd>{usd(lead.property.priceCents)}</dd>
          </dl>
          {lead.conversations[0] && <p><Link className="btn secondary" href={`/conversations/${lead.conversations[0].id}`}>{t('conversations')}</Link></p>}
        </Card>
        <Card title={t('status')}>
          <ApiForm path={`/v1/staff/leads/${id}/status`} back={back} className="form">
            <select name="to" required>{(lead.allowedTransitions as string[]).filter((s) => s !== 'WON' && s !== 'ASSIGNED').map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ').toLowerCase()}</option>)}</select>
            <input name="reason" placeholder={`${t('reason')} (required when lost)`} />
            <div><button className="secondary">{t('save')}</button></div>
          </ApiForm>
          <p className="sub">Leads become “won” automatically when a sale closing is approved or a lease is activated.</p>
          {admin && (
            <ApiForm path={`/v1/staff/leads/${id}/assignee`} method="PUT" back={back}>
              <input type="hidden" name="num:expectedVersion" value={lead.version} />
              <select name="employeeId" defaultValue={lead.assignedEmployeeId ?? ''} required>
                <option value="" disabled>—</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e._count.assignedLeads})</option>)}
              </select>
              <button className="secondary">{t('assign')}</button>
            </ApiForm>
          )}
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Offers">
          <ApiForm path={`/v1/staff/leads/${id}/offers`} back={back}>
            <input name="amountUsd" placeholder={t('amount')} required inputMode="decimal" />
            <select name="party"><option value="BUYER">Buyer</option><option value="TENANT">Tenant</option><option value="OWNER">Owner counter</option></select>
            <input name="notes" placeholder="Notes" />
            <button className="secondary">+</button>
          </ApiForm>
          <Table head={[t('date'), 'Party', t('amount'), 'Notes']}>
            {(lead.offers as any[]).map((o) => <tr key={o.id}><td>{dateTime(o.createdAt, locale)}</td><td>{o.party}</td><td className="num">{usd(o.amountCents)}</td><td>{o.notes}</td></tr>)}
          </Table>
        </Card>
        <Card title={t('viewings')}>
          <Table head={[t('status'), t('date'), 'Notes']}>
            {(lead.viewings as any[]).map((v) => <tr key={v.id}><td><Badge value={v.status} /></td><td>{dateTime(v.scheduledAt, locale)}</td><td>{v.customerNotes}<br /><span className="sub">{v.outcomeNotes}</span></td></tr>)}
          </Table>
        </Card>
      </div>
      {lead.status !== 'WON' && lead.status !== 'LOST' && lead.property.listingType === 'SALE' && (
        <Card title={t('newClosing')}>
          <p className="sub">Commission is computed on the final agreed price and needs administrator approval.</p>
          <ApiForm path="/v1/staff/sales" back={back} className="form">
            <input type="hidden" name="propertyId" value={lead.property.id} />
            <input type="hidden" name="buyerId" value={lead.customer.id} />
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="buyerAcceptance.channel" value="in_person_recorded_by_staff" />
            <input type="hidden" name="sellerAcceptance.channel" value="in_person_recorded_by_staff" />
            <div className="row">
              <label>Final agreed price ($)<input name="finalPriceUsd" required inputMode="decimal" /></label>
              <label>Closing date<input type="date" name="closingDate" required /></label>
              <label>Buyer accepted fees<input type="datetime-local" name="buyerAcceptance.acceptedAtLocal" required /></label>
              <label>Seller accepted fees<input type="datetime-local" name="sellerAcceptance.acceptedAtLocal" required /></label>
            </div>
            <div><button>{t('create')}</button></div>
          </ApiForm>
        </Card>
      )}
      {lead.status !== 'WON' && lead.status !== 'LOST' && lead.property.listingType === 'RENT' && (
        <Card title={t('newAgreement')}>
          <p className="sub">Creates a DRAFT lease. Both parties must accept the monthly terms before an administrator activates it.</p>
          <ApiForm path="/v1/staff/agreements" back={back} className="form">
            <input type="hidden" name="propertyId" value={lead.property.id} />
            <input type="hidden" name="tenantId" value={lead.customer.id} />
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="assignedEmployeeId" value={lead.assignedEmployeeId ?? lead.property.assignedEmployeeId ?? ''} />
            <div className="row">
              <label>Start<input type="date" name="startDate" required /></label>
              <label>End<input type="date" name="endDate" required /></label>
              <label>Due day<input type="number" name="num:dueDay" min={1} max={31} defaultValue={5} required /></label>
              <label>Rent entered by owner ($)<input name="enteredAmountUsd" required inputMode="decimal" defaultValue={(lead.property.priceCents / 100).toFixed(2)} /></label>
              <label>Deposit ($)<input name="depositUsd" inputMode="decimal" defaultValue="0" /></label>
              <label>Proration<select name="proration"><option value="NONE">None</option><option value="DAILY">Daily (agreed)</option></select></label>
            </div>
            <div><button>{t('create')}</button></div>
          </ApiForm>
        </Card>
      )}
      <Card title={t('notes')}>
        <ApiForm path={`/v1/staff/leads/${id}/notes`} back={back} className="form">
          <textarea name="body" required placeholder="Staff only" />
          <div><button className="secondary">{t('addNote')}</button></div>
        </ApiForm>
        {(lead.internalNotes as any[]).map((n) => <p key={n.id}><span className="sub">{dateTime(n.createdAt, locale)}</span><br />{n.body}</p>)}
      </Card>
      <Card title="History">
        {(lead.events as any[]).map((e) => <div key={e.id} className="sub">{dateTime(e.createdAt, locale)} — {e.type} {e.fromStatus ?? ''} → {e.toStatus ?? ''}</div>)}
      </Card>
    </>
  );
}
