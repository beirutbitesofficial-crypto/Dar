import { Card, PageHeader } from '@/components/ui';
import { getT } from '@/lib/i18n';

const dl = (p: string) => `/download?path=${encodeURIComponent(p)}`;

export default async function Exports() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t('exports')} sub="CSV files open correctly in Excel (UTF-8 with BOM). Every export is recorded in the audit log." />
      <div className="grid g3">
        <Card title="Rent ledger"><p className="sub">All payments, reversals and refunds with landlord/fee split.</p><a className="btn" href={dl('/v1/admin/exports/rent-ledger.csv')}>CSV</a></Card>
        <Card title="Owner payouts"><p className="sub">Recorded transfers to owners and reversals.</p><a className="btn" href={dl('/v1/admin/exports/payouts.csv')}>CSV</a></Card>
        <Card title="Listings"><p className="sub">Excludes owner contact details and exact addresses.</p><a className="btn" href={dl('/v1/admin/exports/listings.csv')}>CSV</a></Card>
      </div>
      <p className="sub">Printable receipts are on each lease (receipt numbers R-…); printable owner statements are on the Payouts page.</p>
    </>
  );
}
