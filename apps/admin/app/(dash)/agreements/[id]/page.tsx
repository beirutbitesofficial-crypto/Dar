import { ConfirmButton } from '@/components/nav';
import { ApiForm, Badge, Card, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Agreement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, dict, locale } = await getT();
  const [a, user] = await Promise.all([apiGet(`/v1/staff/agreements/${id}`), me()]);
  const admin = isAdmin(user);
  const canCollect = admin || (user.canRecordCollections && a.assignedEmployee.id === user.id);
  const back = `/agreements/${id}`;
  return (
    <>
      <PageHeader title={`${a.ref} — ${a.property.ref}`} sub={<><Badge value={a.status} /> {a.property.titleAr}</>} />
      <Flash sp={sp} />
      <div className="grid g2">
        <Card title="Terms (frozen at creation)">
          <dl className="kv">
            <dt>Landlord</dt><dd>{a.landlord.fullName} <span dir="ltr" className="sub">{a.landlord.phone}</span></dd>
            <dt>Tenant</dt><dd>{a.tenant.fullName} <span dir="ltr" className="sub">{a.tenant.phone}</span></dd>
            <dt>{t('employee')}</dt><dd>{a.assignedEmployee.fullName}</dd>
            <dt>Pricing mode</dt><dd>{a.pricingMode === 'NET_PLUS_FEE' ? 'Owner net + monthly fee' : 'Total rent − agreed fee'}</dd>
            <dt>{dict.rentals.agreedNetRent}</dt><dd><strong>{usd(a.landlordNetCents)}</strong></dd>
            <dt>Monthly management fee</dt><dd>{usd(a.platformFeeCents)} {a.feeOverride && <span className="badge amber">override: {a.feeOverride.reason}{a.feeOverride.approvedById ? '' : ' (pending admin approval)'}</span>}</dd>
            <dt>{dict.rentals.tenantMonthly}</dt><dd><strong>{usd(a.tenantTotalCents)}</strong></dd>
            <dt>Term</dt><dd>{date(a.startDate, locale)} → {date(a.endDate, locale)} · due day {a.dueDay} · proration {a.proration}</dd>
            {a.terminationDate && (<><dt>Terminated</dt><dd>{date(a.terminationDate, locale)}</dd></>)}
            <dt>Deposit</dt><dd>{usd(a.depositCents)} agreed · {usd(a.depositHeldCents)} held</dd>
            <dt>Terms version</dt><dd>{a.termsVersion} (settings v{a.settingsVersion})</dd>
            <dt>Landlord accepted</dt><dd>{a.landlordAcceptedAt ? `${date(a.landlordAcceptedAt, locale)} · ${a.landlordAcceptanceChannel}` : <span className="badge amber">pending</span>}</dd>
            <dt>Tenant accepted</dt><dd>{a.tenantAcceptedAt ? `${date(a.tenantAcceptedAt, locale)} · ${a.tenantAcceptanceChannel}` : <span className="badge amber">pending</span>}</dd>
          </dl>
          {a.amendments.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>Amendments</h3>
              {(a.amendments as any[]).map((m) => <p key={m.id}>From {m.effectiveFrom}: net {usd(m.landlordNetCents)} + fee {usd(m.platformFeeCents)} = {usd(m.tenantTotalCents)} — {m.reason}</p>)}
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
                  <button className="secondary">Record</button>
                </ApiForm>
              ))}
              {admin && <ApiForm path={`/v1/staff/agreements/${id}/activate`} back={back}><ConfirmButton message="Activate? Monthly obligations will start being generated.">{t('activate')}</ConfirmButton></ApiForm>}
              {admin && <ApiForm path={`/v1/staff/agreements/${id}/cancel`} back={back}><input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger">Cancel draft</button></ApiForm>}
            </div>
          )}
          {a.status === 'ACTIVE' && admin && (
            <div className="form">
              <details><summary>{t('amend')}</summary>
                <ApiForm path={`/v1/staff/agreements/${id}/amendments`} back={back} className="form">
                  <div className="row">
                    <label>Effective from<input type="date" name="effectiveFrom" required /></label>
                    <label>Landlord net ($)<input name="landlordNetUsd" required /></label>
                    <label>Monthly fee ($)<input name="platformFeeUsd" required /></label>
                  </div>
                  <div className="row">
                    <label>Landlord accepted<input type="datetime-local" name="landlordAcceptedAtLocal" required /></label>
                    <label>Tenant accepted<input type="datetime-local" name="tenantAcceptedAtLocal" required /></label>
                  </div>
                  <input name="reason" placeholder={t('reason')} required minLength={5} />
                  <div><button className="secondary">{t('amend')}</button></div>
                </ApiForm>
              </details>
              <details><summary>{t('terminate')}</summary>
                <ApiForm path={`/v1/staff/agreements/${id}/terminate`} back={back} className="form">
                  <label>Last day of occupancy<input type="date" name="terminationDate" required /></label>
                  <input name="reason" placeholder={t('reason')} required minLength={5} />
                  <div><ConfirmButton className="danger" message="Terminate early? Future periods will be voided.">{t('terminate')}</ConfirmButton></div>
                </ApiForm>
              </details>
            </div>
          )}
          {['ACTIVE', 'ENDED'].includes(a.status) && admin && (
            <details><summary>{t('renew')}</summary>
              <ApiForm path={`/v1/staff/agreements/${id}/renew`} back="/agreements" className="form">
                <label>New end date<input type="date" name="endDate" required /></label>
                <label>New rent entered ($, optional)<input name="enteredAmountUsd" /></label>
                <label><span><input type="checkbox" name="bool:keepCurrentFee" /> Keep the current monthly fee</span></label>
                <div><button className="secondary">{t('renew')}</button></div>
              </ApiForm>
            </details>
          )}
          {canCollect && (
            <details><summary>Deposit</summary>
              <ApiForm path={`/v1/staff/agreements/${id}/deposits`} back={back} idem>
                <select name="kind"><option value="RECEIVED">Received</option>{admin && <option value="RETURNED">Returned</option>}{admin && <option value="APPLIED_TO_DAMAGES">Applied to damages</option>}</select>
                <input name="amountUsd" placeholder={t('amount')} required /><select name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option></select>
                <input type="date" name="occurredOn" defaultValue={today()} required /><button className="secondary">{t('save')}</button>
              </ApiForm>
            </details>
          )}
        </Card>
      </div>

      <Card title="Monthly obligations">
        <Table head={['Period', 'Due', 'Landlord share', 'Fee', 'Total', 'Collected', 'Paid out to owner', t('status'), '']}>
          {(a.obligations as any[]).map((o) => (
            <tr key={o.id}>
              <td>{o.periodStart} → {o.periodEnd}{o.prorated && <span className="badge blue">prorated</span>}{o.adjustedReason && <div className="sub">{o.adjustedReason}</div>}</td>
              <td>{o.dueDate}</td>
              <td className="num">{usd(o.landlordShareCents)}</td><td className="num">{usd(o.feeShareCents)}</td><td className="num">{usd(o.totalCents)}</td>
              <td className="num">{usd(o.collectedCents)}</td><td className="num">{usd(o.paidOutCents)}</td>
              <td><Badge value={o.status} label={(dict.rentals.status as any)[o.status]} /></td>
              <td>
                {canCollect && o.remainingCents > 0 && (
                  <ApiForm path={`/v1/staff/obligations/${o.id}/payments`} back={back} idem>
                    <input name="amountUsd" placeholder={(o.remainingCents / 100).toFixed(2)} required style={{ width: 100 }} />
                    <select name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Transfer</option></select>
                    <input type="date" name="receivedOn" defaultValue={today()} required />
                    <input name="reference" placeholder={t('reference')} style={{ width: 110 }} />
                    <button>{t('recordPayment')}</button>
                  </ApiForm>
                )}
                {(o.entries as any[]).map((e) => (
                  <div key={e.id} className="sub">
                    <a href={`/download?path=${encodeURIComponent(`/v1/receipts/rent/${e.id}`)}`} target="_blank" rel="noreferrer">R-{e.receiptNo}</a> {e.kind} {usd(e.amountCents)} ({usd(e.landlordCents)} + {usd(e.feeCents)}) {e.receivedOn}
                    {admin && e.kind === 'PAYMENT' && !(o.entries as any[]).some((x) => x.reversesEntryId === e.id) && (
                      <ApiForm path="/v1/staff/obligations/entries/reverse" back={back} idem>
                        <input type="hidden" name="entryId" value={e.id} /><input name="reason" placeholder={t('reason')} required minLength={5} style={{ width: 140 }} />
                        <ConfirmButton className="danger" message="Reverse this payment? A correcting entry is added; nothing is deleted.">{t('reverse')}</ConfirmButton>
                      </ApiForm>
                    )}
                  </div>
                ))}
                {admin && o.status !== 'VOID' && o.status !== 'WAIVED' && (
                  <details><summary className="sub">{t('refund')} / {t('waive')}</summary>
                    <ApiForm path={`/v1/staff/obligations/${o.id}/refunds`} back={back} idem>
                      <input name="amountUsd" placeholder={t('amount')} required style={{ width: 90 }} /><select name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Transfer</option></select>
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
