import Link from 'next/link';
import { ConfirmButton } from '@/components/nav';
import { ApiForm, Badge, Card, Empty, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function Payouts({ searchParams }: { searchParams: Promise<{ owner?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, dict } = await getT();
  const queue = await apiGet<any[]>('/v1/staff/payouts/queue');
  const statement = sp.owner ? await apiGet(`/v1/staff/payouts/owners/${sp.owner}`) : null;
  const payable = statement ? (statement.lines as any[]).filter((l) => l.payableCents > 0) : [];
  const back = sp.owner ? `/payouts?owner=${sp.owner}` : '/payouts';
  return (
    <>
      <PageHeader title={t('payouts')} sub="Owners are paid only from rent actually collected for them. A tenant payment never marks an owner as paid." />
      <Flash sp={sp} />
      <Card title={<L ar="مالكين إلهم رصيد" en="Owners with a balance" />}>
        {queue.length === 0 ? <Empty text={t('empty')} /> : (
          <Table head={[<L ar="المالك" en="Owner" />, <L ar="المحصّل للمالك" en="Collected for owner" />, <L ar="المحوَّل" en="Paid out" />, <L ar="الرصيد" en="Balance" />, '']}>
            {queue.map((q) => (
              <tr key={q.ownerId}>
                <td>{q.ownerName}</td><td className="num">{usd(q.collectedForOwnerCents)}</td><td className="num">{usd(q.paidOutCents)}</td>
                <td className="num"><strong>{usd(q.balanceCents)}</strong> {q.balanceCents < 0 && <span className="badge red">owner owes</span>}</td>
                <td><Link className="btn secondary" href={`/payouts?owner=${q.ownerId}`}>{t('statement')}</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {statement && sp.owner && (
        <>
          <Card title={t('statement')} actions={<a className="btn secondary" target="_blank" rel="noreferrer" href={`/download?path=${encodeURIComponent(`/v1/statements/owner/${sp.owner}`)}`}>{t('print')}</a>}>
            <p>Payable {usd(statement.totals.payableCents)} · paid out {usd(statement.totals.paidOutCents)}{statement.totals.ownerDebtCents > 0 && <> · <span className="badge red">owed back {usd(statement.totals.ownerDebtCents)}</span></>}</p>
            <ApiForm path="/v1/staff/payouts" back={back} idem className="form">
              <input type="hidden" name="ownerId" value={sp.owner} />
              <Table head={['', <L key="l" ar="العقد" en="Lease" />, <L key="p" ar="الفترة" en="Period" />, dict.rentals.agreedNetRent, dict.rentals.collected, dict.rentals.paidOut, dict.rentals.payable]}>
                {(statement.lines as any[]).map((l) => (
                  <tr key={l.obligationId}>
                    <td>{l.payableCents > 0 && <input type="checkbox" name="list:obligationIds" value={l.obligationId} defaultChecked />}</td>
                    <td>{l.agreementRef}</td><td>{l.period}</td>
                    <td className="num">{usd(l.agreedNetRentCents)}</td><td className="num">{usd(l.collectedForOwnerCents)}</td><td className="num">{usd(l.paidOutCents)}</td>
                    <td className="num">{usd(l.payableCents)}</td>
                  </tr>
                ))}
              </Table>
              {payable.length > 0 && (
                <div className="row">
                  <select name="method"><option value="BANK_TRANSFER"><L ar="تحويل مصرفي" en="Bank transfer" /></option><option value="CASH"><L ar="نقداً" en="Cash" /></option><option value="OTHER"><L ar="غير ذلك" en="Other" /></option></select>
                  <label><L ar="تاريخ الدفع" en="Paid on" /><input type="date" name="paidOn" defaultValue={today()} required /></label>
                  <label>{t('reference')}<input name="reference" required /></label>
                  <ConfirmButton message={'تسجيل التحويل؟ سجّله بس بعد ما المصاري تنحوّل فعلياً.\n\nRecord this payout? Only do this after the money was actually transferred.'}>{t('recordPayout')}</ConfirmButton>
                </div>
              )}
            </ApiForm>
          </Card>
          <Card title={<L ar="سجل التحويلات" en="Payout history" />}>
            <Table head={[<L ar="المرجع" en="Ref" />, <L ar="النوع" en="Kind" />, <L ar="التاريخ" en="Date" />, t('reference'), t('amount'), '']}>
              {(statement.payouts as any[]).map((p) => (
                <tr key={p.id}>
                  <td>{p.ref}</td><td><Badge value={p.kind} /></td><td>{p.paidOn}</td><td>{p.reference}</td><td className="num">{usd(p.totalCents)}</td>
                  <td>
                    {p.kind === 'PAYOUT' && !(statement.payouts as any[]).some((x) => x.reference === `REVERSAL OF ${p.ref}`) && (
                      <ApiForm path={`/v1/staff/payouts/${p.id}/reverse`} back={back} idem>
                        <input name="reason" placeholder={t('reason')} required minLength={5} />
                        <ConfirmButton className="danger" message={'عكس سجل التحويل؟\n\nReverse this payout record?'}>{t('reverse')}</ConfirmButton>
                      </ApiForm>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
