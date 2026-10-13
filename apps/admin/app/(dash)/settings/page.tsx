import { computeRentalBreakdown, computeSaleBreakdown, formatBasisPoints } from '@dar/shared';
import { ConfirmButton } from '@/components/nav';
import { ApiForm, Card, Flash, PageHeader, Table } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { dateTime, usd } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { L } from '@/components/l';

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const [pricing, reminders, templates] = await Promise.all([
    apiGet('/v1/admin/settings/pricing'),
    apiGet('/v1/admin/settings/reminders'),
    apiGet<any[]>('/v1/admin/notification-templates'),
  ]);
  const c = pricing.current;
  const sale = computeSaleBreakdown(10_000_000, c.sale);
  const rent = computeRentalBreakdown(50_000, c.rental);
  return (
    <>
      <PageHeader title={t('settings')} />
      <Flash sp={sp} />
      <div className="grid g2">
        <Card title={`Commission & fees — version ${c.version}`}>
          <p className="notice"><L ar="أي تغيير بيعمل نسخة جديدة وبيطبّق بس على الطلبات والعقود الجديدة. الشروط اللي انقبلت والعقود السارية ما بتتغيّر؛ تعديلها بيصير بتعديل عقد مسجّل." en="Changes create a new version and apply to new requests and agreements only. Accepted terms and active leases never change; amend them through a recorded agreement amendment." /></p>
          <ApiForm path="/v1/admin/settings/pricing" back="/settings" className="form">
            <div className="row">
              <label>Seller commission (basis points, 250 = 2.5%)<input type="number" name="num:saleSellerBps" min={0} max={10000} defaultValue={c.sale.sellerBps} required /></label>
              <label><L ar="عمولة المشتري (نقطة أساس)" en="Buyer commission (bp)" /><input type="number" name="num:saleBuyerBps" min={0} max={10000} defaultValue={c.sale.buyerBps} required /></label>
            </div>
            <div className="row">
              <label><L ar="رسم الإيجار الشهري ($)" en="Monthly rental fee ($)" /><input name="rentalMonthlyFeeUsd" defaultValue={(c.rental.monthlyFeeCents / 100).toFixed(2)} required /></label>
              <label>Default rental pricing mode
                <select name="rentalPricingMode" defaultValue={c.rental.mode}>
                  <option value="NET_PLUS_FEE"><L ar="صافي إيجار المالك + رسم شهري (بيدفعه المستأجر)" en="Owner net rent + monthly fee (tenant pays fee)" /></option>
                  <option value="TOTAL_MINUS_FEE">Total rent − agreed fee (owner net shown before acceptance)</option>
                </select>
              </label>
            </div>
            <div className="row">
              <label><L ar="نسخة الشروط" en="Terms version" /><input name="termsVersion" defaultValue={c.termsVersion} required /></label>
              <label style={{ flex: 1 }}>{t('reason')}<input name="changeReason" required minLength={5} /></label>
            </div>
            <div><ConfirmButton message={'إنشاء نسخة تسعير جديدة للمعاملات الجاية؟\n\nCreate a new pricing version for future transactions?'}>{t('save')}</ConfirmButton></div>
          </ApiForm>
          <h3 style={{ marginTop: 16 }}><L ar="أمثلة حالية" en="Current examples" /></h3>
          <p className="sub">$100,000 sale: seller {formatBasisPoints(c.sale.sellerBps)} = {usd(sale.sellerCommissionCents)}, buyer {formatBasisPoints(c.sale.buyerBps)} = {usd(sale.buyerCommissionCents)}, total brokerage {usd(sale.totalBrokerageCents)}; seller receives {usd(sale.sellerProceedsCents)}, buyer pays {usd(sale.buyerTotalCents)}.</p>
          <p className="sub">$500/month entered: owner receives {usd(rent.landlordNetCents)}, fee {usd(rent.platformFeeCents)}, tenant pays {usd(rent.tenantTotalCents)}.</p>
        </Card>
        <Card title={<L ar="تذكيرات الإيجار" en="Rent reminders" />}>
          <ApiForm path="/v1/admin/settings/reminders" method="PUT" back="/settings" className="form">
            <span className="sub"><L ar="كم يوم قبل الاستحقاق، وبعدين كم يوم بعده (اتركه فاضي للتخطي):" en="Days before the due date, then days after (leave blank to skip):" /></span>
            {[0, 1, 2].map((i) => <input key={`b${i}`} type="number" min={0} max={30} name="list:num:daysBeforeDue" defaultValue={reminders.daysBeforeDue[i] ?? ''} placeholder="أيام قبل · days before" />)}
            {[0, 1, 2].map((i) => <input key={`a${i}`} type="number" min={1} max={60} name="list:num:daysAfterDue" defaultValue={reminders.daysAfterDue[i] ?? ''} placeholder="أيام بعد · days after" />)}
            <div><button className="secondary">{t('save')}</button></div>
          </ApiForm>
          <p className="sub">Reminders are recorded per obligation and never sent twice. Push delivery requires PUSH_ENABLED on the API; otherwise reminders appear in the app inbox only.</p>
        </Card>
      </div>
      <Card title={<L ar="سجل التسعير" en="Pricing history" />}>
        <Table head={[<L ar="نسخة" en="v" />, <L ar="البائع" en="Seller" />, <L ar="المشتري" en="Buyer" />, <L ar="رسم الإيجار" en="Rental fee" />, <L ar="الطريقة" en="Mode" />, <L ar="الشروط" en="Terms" />, t('reason'), t('date')]}>
          {(pricing.history as any[]).map((h) => (
            <tr key={h.id}><td>{h.version}</td><td>{formatBasisPoints(h.saleSellerBps)}</td><td>{formatBasisPoints(h.saleBuyerBps)}</td><td>{usd(h.rentalMonthlyFeeCents)}</td><td>{h.rentalPricingMode}</td><td>{h.termsVersion}</td><td>{h.changeReason}</td><td>{dateTime(h.createdAt, locale)}</td></tr>
          ))}
        </Table>
      </Card>
      <Card title={<L ar="قوالب الإشعارات" en="Notification templates" />}>
        <p className="sub">Placeholders: {'{ref} {reason} {date} {amount} {receipt} {brand}'}</p>
        {templates.map((tpl) => (
          <details key={tpl.key} style={{ marginBottom: 8 }}>
            <summary><code>{tpl.key}</code> — {tpl.titleAr}</summary>
            <ApiForm path={`/v1/admin/notification-templates/${tpl.key}`} method="PUT" back="/settings" className="form">
              <input type="hidden" name="key" value={tpl.key} />
              <div className="row"><label><L ar="العنوان (عربي)" en="Title (AR)" /><input name="titleAr" defaultValue={tpl.titleAr} required /></label><label><L ar="العنوان (إنكليزي)" en="Title (EN)" /><input name="titleEn" defaultValue={tpl.titleEn} required /></label></div>
              <div className="row"><label style={{ flex: 1 }}><L ar="النص (عربي)" en="Body (AR)" /><input name="bodyAr" defaultValue={tpl.bodyAr} required /></label><label style={{ flex: 1 }}><L ar="النص (إنكليزي)" en="Body (EN)" /><input name="bodyEn" defaultValue={tpl.bodyEn} required /></label></div>
              <select name="bool:active" defaultValue={String(tpl.active)}><option value="true"><L ar="فعّال" en="Active" /></option><option value="false"><L ar="معطّل" en="Disabled" /></option></select>
              <div><button className="secondary">{t('save')}</button></div>
            </ApiForm>
          </details>
        ))}
      </Card>
    </>
  );
}
