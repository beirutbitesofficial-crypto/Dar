import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import {
  BRAND,
  canViewAgreementAsParty,
  centsToDecimalString,
  formatDateBeirut,
  formatUSD,
  isAdmin,
  isAssignedEmployee,
} from '@dar/shared';
import type { Response } from 'express';
import { AuditService } from '../../common/audit.service';
import { authorize, CurrentActor, RequestActor, Roles } from '../../common/auth';
import { dateOnly, ref, toCents, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';
import { RentalsService } from '../finance/rentals.service';
import { DashboardService } from './dashboard.service';
import { toCsv } from '../../common/csv';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(title: string, body: string, locale: 'ar' | 'en' = 'ar') {
  return `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;color:${BRAND.colors.text};margin:40px;max-width:760px}
h1{color:${BRAND.colors.primary};font-size:22px;margin:0}header{display:flex;justify-content:space-between;border-bottom:2px solid ${BRAND.colors.primary};padding-bottom:12px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border-bottom:1px solid ${BRAND.colors.border};padding:8px;text-align:start;font-size:14px}
.num{font-variant-numeric:tabular-nums;text-align:end}.muted{color:${BRAND.colors.textMuted};font-size:12px}.demo{background:#fff3cd;padding:8px;border-radius:6px}
@media print{body{margin:16px}button{display:none}}</style></head><body>
<header><div><h1>${esc(BRAND.name.ar)} · ${esc(BRAND.name.en)}</h1><div class="muted">${esc(BRAND.legalEntityName)}</div></div><button onclick="print()">Print / طباعة</button></header>
${body}<p class="muted">${esc(BRAND.contact.officeAddress.ar)} · ${esc(BRAND.contact.phone)} · ${esc(BRAND.contact.email)}</p></body></html>`;
}

@Controller('v1')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
    private readonly rentals: RentalsService,
    private readonly audit: AuditService,
  ) {}

  @Roles('ADMIN')
  @Get('admin/dashboard')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.overview({ from, to });
  }

  @Roles('ADMIN')
  @Get('admin/workload')
  workload() {
    return this.dashboard.workload();
  }

  @Roles('ADMIN')
  @Get('admin/audit')
  auditLog(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string, @Query('action') action?: string, @Query('before') before?: string) {
    return this.prisma.auditLog.findMany({
      where: { ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}), ...(action ? { action: { startsWith: action } } : {}), ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ------------------------------------------------------------------ CSV

  @Roles('ADMIN')
  @Get('admin/exports/rent-ledger.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="rent-ledger.csv"')
  async rentLedgerCsv(@CurrentActor() actor: RequestActor, @Query('from') from = '1970-01-01', @Query('to') to = '9999-12-31') {
    const rows = await this.prisma.rentLedgerEntry.findMany({
      where: { receivedOn: { gte: toDbDate(from), lte: toDbDate(to) } },
      orderBy: { receiptNo: 'asc' },
      include: { obligation: { include: { agreement: { select: { refNo: true, tenant: { select: { fullName: true } }, landlord: { select: { fullName: true } } } } } } },
    });
    await this.audit.log({ actorId: actor.id, action: 'export.csv', entityType: 'RentLedgerEntry', entityId: 'all', metadata: { from, to, rows: rows.length } });
    return toCsv(
      ['receipt', 'kind', 'received_on', 'agreement', 'period_start', 'tenant', 'landlord', 'amount_usd', 'landlord_share_usd', 'platform_fee_usd', 'method', 'reference', 'reverses', 'reason'],
      rows.map((e) => [
        `R-${e.receiptNo}`, e.kind, dateOnly(e.receivedOn), ref('LEASE', e.obligation.agreement.refNo), dateOnly(e.obligation.periodStart),
        e.obligation.agreement.tenant.fullName, e.obligation.agreement.landlord.fullName,
        centsToDecimalString(toCents(e.amountCents)), centsToDecimalString(toCents(e.landlordCents)), centsToDecimalString(toCents(e.feeCents)),
        e.method, e.reference, e.reversesEntryId, e.reason,
      ]),
    );
  }

  @Roles('ADMIN')
  @Get('admin/exports/payouts.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="owner-payouts.csv"')
  async payoutsCsv(@CurrentActor() actor: RequestActor) {
    const rows = await this.prisma.ownerPayout.findMany({ orderBy: { refNo: 'asc' }, include: { owner: { select: { fullName: true } } } });
    await this.audit.log({ actorId: actor.id, action: 'export.csv', entityType: 'OwnerPayout', entityId: 'all', metadata: { rows: rows.length } });
    return toCsv(
      ['payout', 'kind', 'owner', 'paid_on', 'amount_usd', 'method', 'reference', 'reverses'],
      rows.map((p) => [ref('PAY', p.refNo), p.kind, p.owner.fullName, dateOnly(p.paidOn), centsToDecimalString(toCents(p.totalCents)), p.method, p.reference, p.reversesPayoutId]),
    );
  }

  @Roles('ADMIN')
  @Get('admin/exports/listings.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="listings.csv"')
  async listingsCsv(@CurrentActor() actor: RequestActor) {
    // Deliberately excludes owner contact details and exact addresses.
    const rows = await this.prisma.property.findMany({ orderBy: { refNo: 'asc' }, include: { town: true, area: true, assignedEmployee: { select: { fullName: true } } } });
    await this.audit.log({ actorId: actor.id, action: 'export.csv', entityType: 'Property', entityId: 'all', metadata: { rows: rows.length } });
    return toCsv(
      ['ref', 'status', 'type', 'property_type', 'title_ar', 'area', 'town', 'price_usd', 'size_sqm', 'bedrooms', 'employee', 'demo', 'published_at'],
      rows.map((p) => [ref('DAR', p.refNo), p.status, p.listingType, p.propertyType, p.titleAr, p.area?.nameEn, p.town?.nameEn, p.priceCents ? centsToDecimalString(toCents(p.priceCents)) : '', p.sizeSqm, p.bedrooms, p.assignedEmployee?.fullName, p.demo, p.publishedAt?.toISOString()]),
    );
  }

  // ---------------------------------------------------------- printables

  /** Printable receipt for one rent ledger entry: staff, the tenant, or the landlord. */
  @Get('receipts/rent/:entryId')
  async rentReceipt(@CurrentActor() actor: RequestActor, @Param('entryId') entryId: string, @Res() res: Response) {
    const e = await this.prisma.rentLedgerEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { obligation: { include: { agreement: { include: { tenant: { select: { fullName: true } }, property: { select: { refNo: true, titleAr: true, demo: true } } } } } } },
    });
    const ag = e.obligation.agreement;
    authorize(isAdmin(actor) || isAssignedEmployee(actor, ag) || canViewAgreementAsParty(actor, ag) !== null);
    const kindAr = e.kind === 'PAYMENT' ? 'إيصال دفع' : e.kind === 'REFUND' ? 'إيصال استرداد' : 'قيد عكسي';
    res.type('html').send(
      page(
        `R-${e.receiptNo}`,
        `${ag.property.demo ? '<p class="demo">بيانات تجريبية — DEMO DATA</p>' : ''}
        <h2>${kindAr} · ${e.kind} — R-${e.receiptNo}</h2>
        <table>
          <tr><th>التاريخ · Date</th><td>${esc(formatDateBeirut(dateOnly(e.receivedOn)!, 'ar'))}</td></tr>
          <tr><th>العقد · Lease</th><td>${esc(ref('LEASE', ag.refNo))} · ${esc(ref('DAR', ag.property.refNo))} ${esc(ag.property.titleAr)}</td></tr>
          <tr><th>المستأجر · Tenant</th><td>${esc(ag.tenant.fullName)}</td></tr>
          <tr><th>الفترة · Period</th><td>${esc(dateOnly(e.obligation.periodStart))} → ${esc(dateOnly(e.obligation.periodEnd))}</td></tr>
          <tr><th>المبلغ · Amount</th><td class="num"><strong>${esc(formatUSD(toCents(e.amountCents), 'en'))}</strong></td></tr>
          <tr><th>منها إيجار للمالك · Rent for landlord</th><td class="num">${esc(formatUSD(toCents(e.landlordCents), 'en'))}</td></tr>
          <tr><th>منها رسوم إدارة · Management fee</th><td class="num">${esc(formatUSD(toCents(e.feeCents), 'en'))}</td></tr>
          <tr><th>طريقة الدفع · Method</th><td>${esc(e.method)} ${esc(e.reference ?? '')}</td></tr>
          ${e.reason ? `<tr><th>ملاحظة · Note</th><td>${esc(e.reason)}</td></tr>` : ''}
        </table>
        <p class="muted">هذا الإيصال يثبت استلام المبلغ من المستأجر. تحويل حصة المالك يُسجّل بشكل منفصل. · This receipt confirms money received from the tenant. The landlord's payout is recorded separately.</p>`,
      ),
    );
  }

  /** Printable owner statement: agreed rent vs. actual collections and payouts. */
  @Get('statements/owner/:ownerId')
  async ownerStatement(@CurrentActor() actor: RequestActor, @Param('ownerId') ownerId: string, @Res() res: Response) {
    const s = await this.rentals.ownerStatement(actor, ownerId);
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { fullName: true } });
    const rows = s.lines
      .map(
        (l) => `<tr><td>${esc(l.agreementRef)}</td><td>${esc(l.period)}</td><td class="num">${esc(formatUSD(l.agreedNetRentCents, 'en'))}</td>
        <td class="num">${esc(formatUSD(l.collectedForOwnerCents, 'en'))}</td><td class="num">${esc(formatUSD(l.paidOutCents, 'en'))}</td>
        <td class="num">${esc(formatUSD(l.payableCents, 'en'))}</td><td>${esc(l.status)}</td></tr>`,
      )
      .join('');
    const payouts = s.payouts.map((p) => `<tr><td>${esc(p.ref)}</td><td>${esc(p.kind)}</td><td>${esc(p.paidOn)}</td><td>${esc(p.reference)}</td><td class="num">${esc(formatUSD(p.totalCents, 'en'))}</td></tr>`).join('');
    res.type('html').send(
      page(
        `Owner statement — ${owner.fullName}`,
        `<h2>كشف حساب المالك · Owner statement — ${esc(owner.fullName)}</h2>
        <p class="muted">${esc(formatDateBeirut(new Date(), 'ar'))}</p>
        <table><tr><th>العقد</th><th>الفترة</th><th>الإيجار الصافي المتّفق عليه<br>Agreed net rent</th><th>المحصّل لك<br>Collected for you</th><th>المحوَّل<br>Paid out</th><th>المستحق<br>Payable</th><th>الحالة</th></tr>${rows}</table>
        <table><tr><th>المستحق لك حالياً · Currently payable</th><td class="num"><strong>${esc(formatUSD(s.totals.payableCents, 'en'))}</strong></td></tr>
        <tr><th>مجموع التحويلات · Total paid out</th><td class="num">${esc(formatUSD(s.totals.paidOutCents, 'en'))}</td></tr>
        ${s.totals.ownerDebtCents ? `<tr><th>مبالغ مستردّة مطلوبة · Owed back after reversals</th><td class="num">${esc(formatUSD(s.totals.ownerDebtCents, 'en'))}</td></tr>` : ''}</table>
        <h3>التحويلات · Payouts</h3><table><tr><th>Ref</th><th>Kind</th><th>Date</th><th>Reference</th><th>Amount</th></tr>${payouts}</table>`,
      ),
    );
  }
}
