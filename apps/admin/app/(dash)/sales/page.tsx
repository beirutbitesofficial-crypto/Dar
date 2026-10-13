import Link from 'next/link';
import { ApiForm, Badge, Card, Empty, Flash, PageHeader, Table, today } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { date, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';

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
        <p className="sub">Commissions are calculated on the <strong>final agreed price</strong> with the current rates and frozen at approval. Record how each party accepted the fees. Accepting in the app does not by itself guarantee collection.</p>
        <ApiForm path="/v1/staff/sales" back="/sales" className="form">
          <div className="row">
            <label>Listing<select name="propertyId" required>{forSale.map((p: any) => <option key={p.id} value={p.id}>{p.ref} · {p.titleAr}</option>)}</select></label>
            <label>Buyer user ID<input name="buyerId" required placeholder="from the lead record" /></label>
            <label>Final agreed price ($)<input name="finalPriceUsd" required inputMode="decimal" /></label>
            <label>Closing date<input type="date" name="closingDate" required defaultValue={today()} /></label>
          </div>
          <div className="row">
            <label>Buyer accepted<input type="datetime-local" name="buyerAcceptance.acceptedAtLocal" required /></label>
            <input type="hidden" name="buyerAcceptance.channel" value="in_person_recorded_by_staff" />
            <label>Seller accepted<input type="datetime-local" name="sellerAcceptance.acceptedAtLocal" required /></label>
            <input type="hidden" name="sellerAcceptance.channel" value="in_person_recorded_by_staff" />
          </div>
          <label>Notes<input name="notes" /></label>
          <div><button>{t('create')}</button></div>
        </ApiForm>
      </Card>
      {rows.length === 0 ? <Empty text={t('empty')} /> : (
        <Table head={['Ref', 'Listing', 'Buyer', 'Seller', 'Final price', 'Seller fee', 'Buyer fee', t('status'), t('date')]}>
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
