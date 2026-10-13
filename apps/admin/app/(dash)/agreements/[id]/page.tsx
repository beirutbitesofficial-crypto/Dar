import { ConfirmButton } from '@/components/nav';
import { ApiForm, Badge, Card, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

const CHANNEL: Record<string, [string, string]> = {
  mobile: ['عبر التطبيق', 'in the app'],
  admin: ['عبر لوحة الإدارة', 'via dashboard'],
  in_person_recorded_by_staff: ['حضورياً (سجّلها موظف)', 'in person (recorded by staff)'],
};

export default async function Agreement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, b, dict, locale } = await getT();
  const channel = (c: string) => (CHANNEL[c] ? b(CHANNEL[c][0], CHANNEL[c][1]) : c);
  const [a, user] = await Promise.all([apiGet(`/v1/staff/agreements/${id}`), me()]);
  const admin = isAdmin(user);
  const canCollect = admin || (user.canRecordCollections && a.assignedEmployee.id === user.id);
  const back = `/agreements/${id}`;
  return (
    <>
      <PageHeader title={`${a.ref} — ${a.property.ref}`} sub={<><Badge value={a.status} /> {a.property.titleAr}</>} />
      <Flash sp={sp} />
      <div className="grid g2">
        <Card title={<L ar="الشروط (مثبّتة عند الإنشاء)" en="Terms (frozen at creation)" />}>
          <dl className="kv">
            <dt><L ar="المالك" en="Landlord" /></dt><dd>{a.landlord.fullName} <span dir="ltr" className="sub">{a.landlord.phone}</span></dd>
            <dt><L ar="المستأجر" en="Tenant" /></dt><dd>{a.tenant.fullName} <span dir="ltr" className="sub">{a.tenant.phone}</span></dd>
            <dt>{t('employee')}</dt><dd>{a.assignedEmployee.fullName}</dd>
            <dt><L ar="طريقة التسعير" en="Pricing mode" /></dt><dd>{a.pricingMode === 'NET_PLUS_FEE' ? b('صافي المالك + رسم شهري', 'Owner net + monthly fee') : b('إيجار إجمالي − رسم متفق عليه', 'Total rent − agreed fee')}</dd>
            <dt>{dict.rentals.agreedNetRent}</dt><dd><strong>{usd(a.landlordNetCents)}</strong></dd>
            <dt><L ar="رسم الإدارة الشهري" en="Monthly management fee" /></dt><dd>{usd(a.platformFeeCents)} {a.feeOverride && <span className="badge amber">{b('استثناء', 'Override')}: {a.feeOverride.reason}{a.feeOverride.approvedById ? '' : b(' (بانتظار موافقة الإدارة)', ' (pending admin approval)')}</span>}</dd>
            <dt>{dict.rentals.tenantMonthly}</dt><dd><strong>{usd(a.tenantTotalCents)}</strong></dd>
            <dt><L ar="المدة" en="Term" /></dt><dd>{date(a.startDate, locale)} {b('←', '→')} {date(a.endDate, locale)}<div className="sub">{b('يوم الاستحقاق', 'Due day')} {a.dueDay} · {a.proration === 'DAILY' ? b('احتساب نسبي يومي', 'Daily proration') : b('بدون احتساب نسبي', 'No proration')}</div></dd>
            {a.terminationDate && (<><dt><L ar="منتهي" en="Terminated" /></dt><dd>{date(a.terminationDate, locale)}</dd></>)}
            <dt><L ar="التأمين" en="Deposit" /></dt><dd>{usd(a.depositCents)} {b('متفق عليه', 'agreed')} · {usd(a.depositHeldCents)} {b('محفوظ', 'held')}</dd>
            <dt><L ar="نسخة الشروط" en="Terms version" /></dt><dd><span dir="ltr">{a.termsVersion}</span> <span className="sub">({b('إعدادات', 'settings')} v{a.settingsVersion})</span></dd>
            <dt><L ar="موافقة المالك" en="Landlord accepted" /></dt><dd>{a.landlordAcceptedAt ? `${date(a.landlordAcceptedAt, locale)} · ${channel(a.landlordAcceptanceChannel)}` : <span className="badge amber">{b('بالانتظار', 'pending')}</span>}</dd>
            <dt><L ar="موافقة المستأجر" en="Tenant accepted" /></dt><dd>{a.tenantAcceptedAt ? `${date(a.tenantAcceptedAt, locale)} · ${channel(a.tenantAcceptanceChannel)}` : <span className="badge amber">{b('بالانتظار', 'pending')}</span>}</dd>
          </dl>
          {a.amendments.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}><L ar="تعديلات العقد" en="Amendments" /></h3>
              {(a.amendments as any[]).map((m) => <p key={m.id}>{b('ابتداءً من', 'From')} <span dir="ltr">{m.effectiveFrom}</span>: {b('صافي', 'net')} {usd(m.landlordNetCents)} + {b('رسم', 'fee')} {usd(m.platformFeeCents)} = {usd(m.tenantTotalCents)} — {m.reason}</p>)}
            </>
          )}
        </Card>
        <Card title={t('actions')}>
          {a.status === 'DRAFT' && (
            <div className="form">
              {(['LANDLORD', 'TENANT'] as const).map((party) => (
                <ApiForm key={party} path={`/v1/staff/agreements/${id}/acceptance`} back={back}>
                  <input type="hidden" name="party" value={party} />
                  <input type="hidden" name="channel" value="in_person_recorded_by_staff" />
                  <label>{party} accepted (recorded in person)<input type="datetime-local" name="acceptedAtLocal" required /></label>
                  <button className="secondary"><L ar="تسجيل" en="Record" /></button>
                </ApiForm>
              ))}
              {admin && <ApiForm path={`/v1/staff/agreements/${id}/activate`} back={back}><ConfirmButton message={'تفعيل العقد؟ رح تبلّش الاستحقاقات الشهرية تنعمل.\n\nActivate? Monthly obligations will start being generated.'}>{t('activate')}</ConfirmButton></ApiForm>}
              {admin && <ApiForm path={`/v1/staff/agreements/${id}/cancel`} back={back}><input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger"><L ar="إلغاء المسودة" en="Cancel draft" /></button></ApiForm>}
            </div>
          )}
          {a.status === 'ACTIVE' && admin && (
            <div className="form">
              <details><summary>{t('amend')}</summary>
                <ApiForm path={`/v1/staff/agreements/${id}/amendments`} back={back} className="form">
                  <div className="row">
                    <label><L ar="ساري من" en="Effective from" /><input type="date" name="effectiveFrom" required /></label>
                    <label><L ar="صافي المالك ($)" en="Landlord net ($)" /><input name="landlordNetUsd" required /></label>
                    <label><L ar="الرسم الشهري ($)" en="Monthly fee ($)" /><input name="platformFeeUsd" required /></label>
                  </div>
                  <div className="row">
                    <label><L ar="موافقة المالك" en="Landlord accepted" /><input type="datetime-local" name="landlordAcceptedAtLocal" required /></label>
                    <label><L ar="موافقة المستأجر" en="Tenant accepted" /><input type="datetime-local" name="tenantAcceptedAtLocal" required /></label>
                  </div>
                  <input name="reason" placeholder={t('reason')} required minLength={5} />
                  <div><button className="secondary">{t('amend')}</button></div>
                </ApiForm>
              </details>
              <details><summary>{t('terminate')}</summary>
                <ApiForm path={`/v1/staff/agreements/${id}/terminate`} back={back} className="form">
                  <label><L ar="آخر يوم سكن" en="Last day of occupancy" /><input type="date" name="terminationDate" required /></label>
                  <input name="reason" placeholder={t('reason')} required minLength={5} />
                  <div><ConfirmButton className="danger" message={'إنهاء مبكر؟ الفترات الجاية رح تتلغى.\n\nTerminate early? Future periods will be voided.'}>{t('terminate')}</ConfirmButton></div>
                </ApiForm>
              </details>
            </div>
          )}
          {['ACTIVE', 'ENDED'].includes(a.status) && admin && (
            <details><summary>{t('renew')}</summary>
              <ApiForm path={`/v1/staff/agreements/${id}/renew`} back="/agreements" className="form">
                <label><L ar="تاريخ انتهاء جديد" en="New end date" /><input type="date" name="endDate" required /></label>
                <label><L ar="إيجار جديد ($، اختياري)" en="New rent entered ($, optional)" /><input name="enteredAmountUsd" /></label>
                <label><span><input type="checkbox" name="bool:keepCurrentFee" /> Keep the current monthly fee</span></label>
                <div><button className="secondary">{t('renew')}</button></div>
              </ApiForm>
            </details>
          )}
          {canCollect && (
            <details><summary><L ar="التأمين" en="Deposit" /></summary>
              <ApiForm path={`/v1/staff/agreements/${id}/deposits`} back={back} idem>
                <select name="kind"><option value="RECEIVED"><L ar="مستلَم" en="Received" /></option>{admin && <option value="RETURNED"><L ar="مُرجَع" en="Returned" /></option>}{admin && <option value="APPLIED_TO_DAMAGES"><L ar="مخصوم للأضرار" en="Applied to damages" /></option>}</select>
                <input name="amountUsd" placeholder={t('amount')} required /><select name="method"><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="BANK_TRANSFER"><L ar="تحويل مصرفي" en="Bank transfer" /></option></select>
                <input type="date" name="occurredOn" defaultValue={today()} required /><button className="secondary">{t('save')}</button>
              </ApiForm>
            </details>
          )}
        </Card>
      </div>

      <Card title={<L ar="الاستحقاقات الشهرية" en="Monthly obligations" />}>
        <Table head={[<L ar="الفترة" en="Period" />, <L ar="الاستحقاق" en="Due" />, <L ar="حصة المالك" en="Landlord share" />, <L ar="الرسم" en="Fee" />, <L ar="المجموع" en="Total" />, <L ar="المحصّل" en="Collected" />, <L ar="المحوَّل للمالك" en="Paid out to owner" />, t('status'), '']}>
          {(a.obligations as any[]).map((o) => (
            <tr key={o.id}>
              <td><span dir="ltr" className="nowrap">{o.periodStart} → {o.periodEnd}</span>{o.prorated && <span className="badge blue">{b('نسبي', 'prorated')}</span>}{o.adjustedReason && <div className="sub">{o.adjustedReason}</div>}</td>
              <td><span dir="ltr" className="nowrap">{o.dueDate}</span></td>
              <td className="num">{usd(o.landlordShareCents)}</td><td className="num">{usd(o.feeShareCents)}</td><td className="num">{usd(o.totalCents)}</td>
              <td className="num">{usd(o.collectedCents)}</td><td className="num">{usd(o.paidOutCents)}</td>
              <td><Badge value={o.status} label={(dict.rentals.status as any)[o.status]} /></td>
              <td>
                {canCollect && o.remainingCents > 0 && (
                  <ApiForm path={`/v1/staff/obligations/${o.id}/payments`} back={back} idem>
                    <input name="amountUsd" placeholder={(o.remainingCents / 100).toFixed(2)} required style={{ width: 100 }} />
                    <select name="method"><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="BANK_TRANSFER"><L ar="تحويل" en="Transfer" /></option></select>
                    <input type="date" name="receivedOn" defaultValue={today()} required />
                    <input name="reference" placeholder={t('reference')} style={{ width: 110 }} />
                    <button>{t('recordPayment')}</button>
                  </ApiForm>
                )}
                {(o.entries as any[]).map((e) => (
                  <div key={e.id} className="sub">
                    <a href={`/download?path=${encodeURIComponent(`/v1/receipts/rent/${e.id}`)}`} target="_blank" rel="noreferrer">R-{e.receiptNo}</a> <Badge value={e.kind} /> {usd(e.amountCents)} <span className="sub">({b('للمالك', 'landlord')} {usd(e.landlordCents)} + {b('رسم', 'fee')} {usd(e.feeCents)})</span> <span dir="ltr">{e.receivedOn}</span>
                    {admin && e.kind === 'PAYMENT' && !(o.entries as any[]).some((x) => x.reversesEntryId === e.id) && (
                      <ApiForm path="/v1/staff/obligations/entries/reverse" back={back} idem>
                        <input type="hidden" name="entryId" value={e.id} /><input name="reason" placeholder={t('reason')} required minLength={5} style={{ width: 140 }} />
                        <ConfirmButton className="danger" message={'عكس هالدفعة؟ بينضاف قيد تصحيح وما بينمحى شي.\n\nReverse this payment? A correcting entry is added; nothing is deleted.'}>{t('reverse')}</ConfirmButton>
                      </ApiForm>
                    )}
                  </div>
                ))}
                {admin && o.status !== 'VOID' && o.status !== 'WAIVED' && (
                  <details><summary className="sub">{t('refund')} / {t('waive')}</summary>
                    <ApiForm path={`/v1/staff/obligations/${o.id}/refunds`} back={back} idem>
                      <input name="amountUsd" placeholder={t('amount')} required style={{ width: 90 }} /><select name="method"><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="BANK_TRANSFER"><L ar="تحويل" en="Transfer" /></option></select>
                      <input type="date" name="paidOn" defaultValue={today()} required /><input name="reason" placeholder={t('reason')} required minLength={5} />
                      <button className="danger">{t('refund')}</button>
                    </ApiForm>
                    <ApiForm path={`/v1/staff/obligations/${o.id}/waive`} back={back}><input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger">{t('waive')}</button></ApiForm>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
