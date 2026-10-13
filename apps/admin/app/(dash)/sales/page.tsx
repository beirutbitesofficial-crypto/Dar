import Link from 'next/link';
import { ApiForm, Badge, Card, Empty, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function Sales({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const [rows, props] = await Promise.all([apiGet<any[]>('/v1/staff/sales'), apiGet('/v1/staff/properties?status=PUBLISHED')]);
  const forSale = props.items.filter((p: any) => p.listingType === 'SALE');
  return (
    <>
      <PageHeader title={t('sales')} />
      <Flash sp={sp} />
      <Card title={t('newClosing')}>
        <p className="sub"><L ar="العمولات بتنحسب على السعر النهائي المتفق عليه بالنسب الحالية وبتتثبّت عند الموافقة. سجّل كيف كل طرف وافق على الرسوم. الموافقة بالتطبيق لحالها ما بتضمن التحصيل." en="Commissions are calculated on the final agreed price with the current rates and frozen at approval. Record how each party accepted the fees. Accepting in the app does not by itself guarantee collection." /></p>
        <ApiForm path="/v1/staff/sales" back="/sales" className="form">
          <div className="row">
            <label><L ar="الإعلان" en="Listing" /><select name="propertyId" required>{forSale.map((p: any) => <option key={p.id} value={p.id}>{p.ref} · {p.titleAr}</option>)}</select></label>
            <label><L ar="رقم حساب المشتري" en="Buyer user ID" /><input name="buyerId" required placeholder="من سجل العميل · from the lead record" /></label>
            <label><L ar="السعر النهائي المتفق عليه ($)" en="Final agreed price ($)" /><input name="finalPriceUsd" required inputMode="decimal" /></label>
            <label><L ar="تاريخ الإغلاق" en="Closing date" /><input type="date" name="closingDate" required defaultValue={today()} /></label>
          </div>
          <div className="row">
            <label><L ar="موافقة المشتري" en="Buyer accepted" /><input type="datetime-local" name="buyerAcceptance.acceptedAtLocal" required /></label>
            <input type="hidden" name="buyerAcceptance.channel" value="in_person_recorded_by_staff" />
            <label><L ar="موافقة البائع" en="Seller accepted" /><input type="datetime-local" name="sellerAcceptance.acceptedAtLocal" required /></label>
            <input type="hidden" name="sellerAcceptance.channel" value="in_person_recorded_by_staff" />
          </div>
          <label><L ar="ملاحظات" en="Notes" /><input name="notes" /></label>
          <div><button>{t('create')}</button></div>
        </ApiForm>
      </Card>
      {rows.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={[<L ar="المرجع" en="Ref" />, <L ar="الإعلان" en="Listing" />, <L ar="المشتري" en="Buyer" />, <L ar="البائع" en="Seller" />, <L ar="السعر النهائي" en="Final price" />, <L ar="عمولة البائع" en="Seller fee" />, <L ar="عمولة المشتري" en="Buyer fee" />, t('status'), t('date')]}>
          {rows.map((c) => {
            const s = c.obligations.find((o: any) => o.party === 'SELLER');
            const b = c.obligations.find((o: any) => o.party === 'BUYER');
            return (
              <tr key={c.id}>
                <td><Link href={`/sales/${c.id}`}>{c.ref}</Link></td>
                <td>{c.propertyRef}</td>
                <td>{c.buyerName}</td>
                <td>{c.sellerName}</td>
                <td className="num">{usd(c.finalPriceCents)}</td>
                <td>{s ? <Badge value={s.status} /> : '—'}</td>
                <td>{b ? <Badge value={b.status} /> : '—'}</td>
                <td><Badge value={c.status} /></td>
                <td>{date(c.closingDate, locale)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
