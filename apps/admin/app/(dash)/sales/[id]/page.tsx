import { formatBasisPoints } from '@dar/shared';
import { ConfirmButton } from '@/components/nav';
import { ApiForm, Badge, Card, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet, isAdmin, me } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function Sale({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { t, b, locale } = await getT();
  const [c, user] = await Promise.all([apiGet(`/v1/staff/sales/${id}`), me()]);
  const admin = isAdmin(user);
  const back = `/sales/${id}`;
  return (
    <>
      <PageHeader title={`${c.ref} — ${c.propertyRef}`} sub={<><Badge value={c.status} /> {c.propertyTitle}</>} />
      <Flash sp={sp} />
      <Card>
        <dl className="kv">
          <dt><L ar="السعر النهائي المتفق عليه" en="Final agreed price" /></dt><dd>{usd(c.finalPriceCents)}</dd>
          <dt>{b('البائع', 'Seller')} ({c.seller.fullName})</dt><dd>{b('عمولة', 'Commission')} {formatBasisPoints(c.sellerBps)} = {usd(c.sellerCommissionCents)}<div className="sub">{b('صافي البائع بعد العمولة', 'Seller proceeds after commission')}: {usd(c.finalPriceCents - c.sellerCommissionCents)}</div></dd>
          <dt>{b('المشتري', 'Buyer')} ({c.buyer.fullName})</dt><dd>{b('عمولة', 'Commission')} {formatBasisPoints(c.buyerBps)} = {usd(c.buyerCommissionCents)}<div className="sub">{b('مجموع المشتري مع العمولة', 'Buyer total incl. commission')}: {usd(c.finalPriceCents + c.buyerCommissionCents)}</div></dd>
          <dt><L ar="مجموع الوساطة" en="Total brokerage" /></dt><dd>{usd(c.sellerCommissionCents + c.buyerCommissionCents)}</dd>
          <dt><L ar="تاريخ الإغلاق" en="Closing date" /></dt><dd>{date(c.closingDate, locale)}</dd>
          <dt><L ar="نسخة الشروط" en="Terms version" /></dt><dd>{c.termsVersion}</dd>
          {c.overrideReason && (<><dt><L ar="استثناء على الرسوم" en="Fee override" /></dt><dd className="badge amber">{c.overrideReason}</dd></>)}
        </dl>
        <p className="sub"><L ar="التقديرات ما بتشمل الضرائب ورسوم التسجيل وأي رسوم تانية." en="Estimates exclude taxes, registration and other charges." /></p>
        {admin && c.status === 'PENDING_APPROVAL' && (
          <div className="row">
            <ApiForm path={`/v1/staff/sales/${id}/approve`} back={back}><ConfirmButton message={'الموافقة على البيع؟ العمولات رح تتثبّت والإعلان بيصير «مباع».\n\nApprove this closing? Commissions will be frozen and the listing marked sold.'}>{t('approve')}</ConfirmButton></ApiForm>
            <ApiForm path={`/v1/staff/sales/${id}/cancel`} back={back}><input name="reason" placeholder={t('reason')} required minLength={5} /><button className="danger"><L ar="إلغاء" en="Cancel" /></button></ApiForm>
          </div>
        )}
      </Card>
      {(c.obligations as any[]).map((o) => (
        <Card key={o.id} title={<>{o.party === 'BUYER' ? b('عمولة المشتري', 'Buyer commission') : b('عمولة البائع', 'Seller commission')} <Badge value={o.status} /></>}>
          <p>{b('المستحق', 'Due')} {usd(o.amountDueCents)} · {b('المحصّل', 'collected')} {usd(o.collectedCents)} · {b('المتبقي', 'remaining')} {usd(o.remainingCents)}</p>
          {o.status !== 'WAIVED' && o.remainingCents > 0 && (
            <ApiForm path={`/v1/staff/sales/${id}/entries`} back={back} idem>
              <input type="hidden" name="party" value={o.party} />
              <input type="hidden" name="kind" value="PAYMENT" />
              <input name="amountUsd" placeholder={t('amount')} required inputMode="decimal" />
              <select name="method"><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="BANK_TRANSFER"><L ar="تحويل مصرفي" en="Bank transfer" /></option><option value="OTHER"><L ar="غير ذلك" en="Other" /></option></select>
              <input type="date" name="receivedOn" defaultValue={today()} required />
              <input name="reference" placeholder={t('reference')} />
              <button>{t('recordPayment')}</button>
            </ApiForm>
          )}
          <Table head={['#', <L ar="النوع" en="Kind" />, t('date'), t('amount'), t('method'), t('reference'), '']}>
            {(o.entries as any[]).map((e) => (
              <tr key={e.id}>
                <td>R-{e.receiptNo}</td><td><Badge value={e.kind} /></td><td><span dir="ltr">{e.receivedOn}</span></td><td className="num">{usd(e.amountCents)}</td><td>{e.method === 'CASH' ? b('نقداً', 'Cash') : e.method === 'BANK_TRANSFER' ? b('تحويل مصرفي', 'Bank transfer') : b('غير ذلك', 'Other')}</td><td>{e.reference ?? e.reason}</td>
                <td>
                  {admin && e.kind === 'PAYMENT' && !(o.entries as any[]).some((x) => x.reversesEntryId === e.id) && (
                    <ApiForm path="/v1/staff/sales/entries/reverse" back={back} idem>
                      <input type="hidden" name="entryId" value={e.id} />
                      <input name="reason" placeholder={t('reason')} required minLength={5} />
                      <ConfirmButton className="danger" message={'تسجيل قيد عكسي؟ القيد الأصلي بيضل محفوظ.\n\nRecord a reversal? The original entry is kept.'}>{t('reverse')}</ConfirmButton>
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
                  <input name="amountUsd" placeholder={t('amount')} required /><select name="method"><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="BANK_TRANSFER"><L ar="تحويل مصرفي" en="Bank transfer" /></option></select>
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
