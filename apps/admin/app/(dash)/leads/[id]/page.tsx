import Link from 'next/link';
import { ApiForm, Badge, Card, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { dateTime, usd } from '@/lib/format';
import { getT, LEAD_STATUS } from '@/lib/i18n';
import { L } from '@/components/l';

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
            <dt><L ar="المصدر" en="Source" /></dt><dd>{lead.source}</dd>
            <dt>{dict.property.askingPrice}</dt><dd>{usd(lead.property.priceCents)}</dd>
          </dl>
          {lead.conversations[0] && <p><Link className="btn secondary" href={`/conversations/${lead.conversations[0].id}`}>{t('conversations')}</Link></p>}
        </Card>
        <Card title={t('status')}>
          <ApiForm path={`/v1/staff/leads/${id}/status`} back={back} className="form">
            <select name="to" required>{(lead.allowedTransitions as string[]).filter((s) => s !== 'WON' && s !== 'ASSIGNED').map((s) => <option key={s} value={s}>{LEAD_STATUS[s]?.[locale] ?? s}</option>)}</select>
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
        <Card title={<L ar="العروض" en="Offers" />}>
          <ApiForm path={`/v1/staff/leads/${id}/offers`} back={back}>
            <input name="amountUsd" placeholder={t('amount')} required inputMode="decimal" />
            <select name="party"><option value="BUYER"><L ar="المشتري" en="Buyer" /></option><option value="TENANT"><L ar="المستأجر" en="Tenant" /></option><option value="OWNER"><L ar="عرض مقابل من المالك" en="Owner counter" /></option></select>
            <input name="notes" placeholder="ملاحظات · Notes" />
            <button className="secondary">+</button>
          </ApiForm>
          <Table head={[t('date'), <L ar="الطرف" en="Party" />, t('amount'), <L ar="ملاحظات" en="Notes" />]}>
            {(lead.offers as any[]).map((o) => <tr key={o.id}><td>{dateTime(o.createdAt, locale)}</td><td>{o.party}</td><td className="num">{usd(o.amountCents)}</td><td>{o.notes}</td></tr>)}
          </Table>
        </Card>
        <Card title={t('viewings')}>
          <Table head={[t('status'), t('date'), <L ar="ملاحظات" en="Notes" />]}>
            {(lead.viewings as any[]).map((v) => <tr key={v.id}><td><Badge value={v.status} /></td><td>{dateTime(v.scheduledAt, locale)}</td><td>{v.customerNotes}<br /><span className="sub">{v.outcomeNotes}</span></td></tr>)}
          </Table>
        </Card>
      </div>
      {lead.status !== 'WON' && lead.status !== 'LOST' && lead.property.listingType === 'SALE' && (
        <Card title={t('newClosing')}>
          <p className="sub"><L ar="العمولة بتنحسب على السعر النهائي المتفق عليه وبدها موافقة الإدارة." en="Commission is computed on the final agreed price and needs administrator approval." /></p>
          <ApiForm path="/v1/staff/sales" back={back} className="form">
            <input type="hidden" name="propertyId" value={lead.property.id} />
            <input type="hidden" name="buyerId" value={lead.customer.id} />
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="buyerAcceptance.channel" value="in_person_recorded_by_staff" />
            <input type="hidden" name="sellerAcceptance.channel" value="in_person_recorded_by_staff" />
            <div className="row">
              <label><L ar="السعر النهائي المتفق عليه ($)" en="Final agreed price ($)" /><input name="finalPriceUsd" required inputMode="decimal" /></label>
              <label><L ar="تاريخ الإغلاق" en="Closing date" /><input type="date" name="closingDate" required /></label>
              <label><L ar="المشتري وافق على الرسوم" en="Buyer accepted fees" /><input type="datetime-local" name="buyerAcceptance.acceptedAtLocal" required /></label>
              <label><L ar="البائع وافق على الرسوم" en="Seller accepted fees" /><input type="datetime-local" name="sellerAcceptance.acceptedAtLocal" required /></label>
            </div>
            <div><button>{t('create')}</button></div>
          </ApiForm>
        </Card>
      )}
      {lead.status !== 'WON' && lead.status !== 'LOST' && lead.property.listingType === 'RENT' && (
        <Card title={t('newAgreement')}>
          <p className="sub"><L ar="بينشئ مسودة عقد. لازم الطرفين يوافقوا على الشروط الشهرية قبل ما الإدارة تفعّله." en="Creates a DRAFT lease. Both parties must accept the monthly terms before an administrator activates it." /></p>
          <ApiForm path="/v1/staff/agreements" back={back} className="form">
            <input type="hidden" name="propertyId" value={lead.property.id} />
            <input type="hidden" name="tenantId" value={lead.customer.id} />
            <input type="hidden" name="leadId" value={lead.id} />
            <input type="hidden" name="assignedEmployeeId" value={lead.assignedEmployeeId ?? lead.property.assignedEmployeeId ?? ''} />
            <div className="row">
              <label><L ar="البداية" en="Start" /><input type="date" name="startDate" required /></label>
              <label><L ar="النهاية" en="End" /><input type="date" name="endDate" required /></label>
              <label><L ar="يوم الاستحقاق" en="Due day" /><input type="number" name="num:dueDay" min={1} max={31} defaultValue={5} required /></label>
              <label><L ar="الإيجار اللي حطّه المالك ($)" en="Rent entered by owner ($)" /><input name="enteredAmountUsd" required inputMode="decimal" defaultValue={(lead.property.priceCents / 100).toFixed(2)} /></label>
              <label><L ar="التأمين ($)" en="Deposit ($)" /><input name="depositUsd" inputMode="decimal" defaultValue="0" /></label>
              <label><L ar="احتساب نسبي" en="Proration" /><select name="proration"><option value="NONE"><L ar="بدون" en="None" /></option><option value="DAILY"><L ar="يومي (متفق عليه)" en="Daily (agreed)" /></option></select></label>
            </div>
            <div><button>{t('create')}</button></div>
          </ApiForm>
        </Card>
      )}
      <Card title={t('notes')}>
        <ApiForm path={`/v1/staff/leads/${id}/notes`} back={back} className="form">
          <textarea name="body" required placeholder="للموظفين بس · Staff only" />
          <div><button className="secondary">{t('addNote')}</button></div>
        </ApiForm>
        {(lead.internalNotes as any[]).map((n) => <p key={n.id}><span className="sub">{dateTime(n.createdAt, locale)}</span><br />{n.body}</p>)}
      </Card>
      <Card title={<L ar="السجل" en="History" />}>
        {(lead.events as any[]).map((e) => <div key={e.id} className="sub">{dateTime(e.createdAt, locale)} — {e.type} {e.fromStatus ?? ''} → {e.toStatus ?? ''}</div>)}
      </Card>
    </>
  );
}
