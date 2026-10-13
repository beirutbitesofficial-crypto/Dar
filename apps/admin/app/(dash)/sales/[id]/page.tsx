import { formatBasisPoints } from '@dar/shared';
import { ConfirmButton } from '@/components/nav';
import { ApiForm, Badge, Card, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

export default async function Sale({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, locale } = await getT();
  const [c, user] = await Promise.all([apiGet(`/v1/staff/sales/${id}`), me()]);
  const admin = isAdmin(user);
  const back = `/sales/${id}`;
  return (
    <>
      <PageHeader title={`${c.ref} — ${c.propertyRef}`} sub={<><Badge value={c.status} /> {c.propertyTitle}</>} />
      <Flash sp={sp} />
      <Card>
        <dl className="kv">
          <dt>Final agreed price</dt><dd>{usd(c.finalPriceCents)}</dd>
          <dt>Seller ({c.seller.fullName})</dt><dd>{formatBasisPoints(c.sellerBps)} = {usd(c.sellerCommissionCents)} → proceeds {usd(c.finalPriceCents - c.sellerCommissionCents)}</dd>
          <dt>Buyer ({c.buyer.fullName})</dt><dd>{formatBasisPoints(c.buyerBps)} = {usd(c.buyerCommissionCents)} → total {usd(c.finalPriceCents + c.buyerCommissionCents)}</dd>
          <dt>Total brokerage</dt><dd>{usd(c.sellerCommissionCents + c.buyerCommissionCents)}</dd>
          <dt>Closing date</dt><dd>{date(c.closingDate, locale)}</dd>
          <dt>Terms version</dt><dd>{c.termsVersion}</dd>
          {c.overrideReason && (<><dt>Fee override</dt><dd className="badge amber">{c.overrideReason}</dd></>)}
        </dl>
        <p className="sub">Estimates exclude taxes, registration and other charges.</p>
        {admin && c.status === 'PENDING_APPROVAL' && (
          <div className="row">
            <ApiForm path={`/v1/staff/sales/${id}/approve`} back={back}><ConfirmButton message="Approve this closing? Commissions will be frozen and the listing marked sold.">{t('approve')}</ConfirmButton></ApiForm>
            <ApiForm path={`/v1/staff/sales/${id}/cancel`} back={back}><input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger">Cancel</button></ApiForm>
          </div>
        )}
      </Card>
      {(c.obligations as any[]).map((o) => (
        <Card key={o.id} title={<>{o.party === 'BUYER' ? 'Buyer commission' : 'Seller commission'} <Badge value={o.status} /></>}>
          <p>Due {usd(o.amountDueCents)} · collected {usd(o.collectedCents)} · remaining {usd(o.remainingCents)}</p>
          {o.status !== 'WAIVED' && o.remainingCents > 0 && (
            <ApiForm path={`/v1/staff/sales/${id}/entries`} back={back} idem>
              <input type="hidden" name="party" value={o.party} />
              <input type="hidden" name="kind" value="PAYMENT" />
              <input name="amountUsd" placeholder={t('amount')} required inputMode="decimal" />
              <select name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select>
              <input type="date" name="receivedOn" defaultValue={today()} required />
              <input name="reference" placeholder={t('reference')} />
              <button>{t('recordPayment')}</button>
            </ApiForm>
          )}
          <Table head={['#', 'Kind', t('date'), t('amount'), t('method'), t('reference'), '']}>
            {(o.entries as any[]).map((e) => (
              <tr key={e.id}>
                <td>R-{e.receiptNo}</td><td><Badge value={e.kind} /></td><td>{e.receivedOn}</td><td className="num">{usd(e.amountCents)}</td><td>{e.method}</td><td>{e.reference ?? e.reason}</td>
                <td>
                  {admin && e.kind === 'PAYMENT' && !(o.entries as any[]).some((x) => x.reversesEntryId === e.id) && (
                    <ApiForm path="/v1/staff/sales/entries/reverse" back={back} idem>
                      <input type="hidden" name="entryId" value={e.id} />
                      <input name="reason" placeholder={t('reason')} required minLength={5} />
                      <ConfirmButton className="danger" message="Record a reversal? The original entry is kept.">{t('reverse')}</ConfirmButton>
                    </ApiForm>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {admin && o.status !== 'WAIVED' && (
            <details style={{ marginTop: 10 }}>
              <summary>{t('refund')} / {t('waive')}</summary>
              <div className="row" style={{ marginTop: 10 }}>
                <ApiForm path={`/v1/staff/sales/${id}/entries`} back={back} idem>
                  <input type="hidden" name="party" value={o.party} /><input type="hidden" name="kind" value="REFUND" />
                  <input name="amountUsd" placeholder={t('amount')} required /><select name="method"><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option></select>
                  <input type="date" name="receivedOn" defaultValue={today()} required /><input name="reason" placeholder={t('reason')} required minLength={5} />
                  <button className="danger">{t('refund')}</button>
                </ApiForm>
                <ApiForm path={`/v1/staff/sales/obligations/${o.id}/waive`} back={back}>
                  <input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger">{t('waive')}</button>
                </ApiForm>
              </div>
            </details>
          )}
        </Card>
      ))}
    </>
  );
}
