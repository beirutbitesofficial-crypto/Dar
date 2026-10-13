import { Injectable } from '@nestjs/common';
import { computeDashboardMoney, DashboardOverview, LeadStatus, ListingStatus, todayInBeirut } from '@dar/shared';
import { toCents, toDbDate } from '../../common/money';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Money figures are computed from the ledgers with separate SQL aggregates so
   * that collected rent is never counted as platform revenue.
   */
  async overview(range?: { from?: string; to?: string }): Promise<DashboardOverview> {
    const today = todayInBeirut();
    const from = range?.from ? toDbDate(range.from) : new Date('1970-01-01');
    const to = range?.to ? toDbDate(range.to) : toDbDate('9999-12-31');

    const [listings, leads, viewings, activeRentals, salesThisMonth] = await Promise.all([
      this.prisma.property.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.viewingRequest.count({ where: { status: 'CONFIRMED', scheduledAt: { gte: new Date(), lt: new Date(Date.now() + 7 * 86_400_000) } } }),
      this.prisma.rentalAgreement.count({ where: { status: 'ACTIVE' } }),
      this.prisma.saleClosing.count({ where: { status: 'APPROVED', approvedAt: { gte: new Date(`${today.slice(0, 7)}-01T00:00:00+03:00`) } } }),
    ]);

    const [rent] = await this.prisma.$queryRaw<{ landlord: bigint; fee: bigint }[]>`
      SELECT coalesce(sum("landlordCents"), 0)::bigint AS landlord, coalesce(sum("feeCents"), 0)::bigint AS fee
      FROM "RentLedgerEntry" WHERE "receivedOn" >= ${from} AND "receivedOn" <= ${to}`;
    const [feeOutstanding] = await this.prisma.$queryRaw<{ outstanding: bigint; overdue_count: bigint }[]>`
      SELECT coalesce(sum(greatest(o."feeShareCents" - coalesce(e.fee, 0), 0)), 0)::bigint AS outstanding,
             count(*) FILTER (WHERE o."dueDate" < ${toDbDate(today)} AND o."totalCents" > coalesce(e.total, 0))::bigint AS overdue_count
      FROM "RentObligation" o
      LEFT JOIN (SELECT "obligationId", sum("feeCents") AS fee, sum("amountCents") AS total FROM "RentLedgerEntry" GROUP BY 1) e ON e."obligationId" = o.id
      WHERE o."voidedAt" IS NULL AND o."waivedAt" IS NULL AND o."dueDate" <= ${toDbDate(today)}`;
    const [sale] = await this.prisma.$queryRaw<{ collected: bigint; outstanding: bigint }[]>`
      SELECT coalesce((SELECT sum("amountCents") FROM "SaleLedgerEntry" WHERE "receivedOn" >= ${from} AND "receivedOn" <= ${to}), 0)::bigint AS collected,
             coalesce((SELECT sum(greatest(so."amountDueCents" - coalesce(x.net, 0), 0)) FROM "SaleObligation" so
                       JOIN "SaleClosing" sc ON sc.id = so."closingId" AND sc.status = 'APPROVED'
                       LEFT JOIN (SELECT "obligationId", sum("amountCents") AS net FROM "SaleLedgerEntry" GROUP BY 1) x ON x."obligationId" = so.id
                       WHERE so."waivedAt" IS NULL), 0)::bigint AS outstanding`;
    const [payouts] = await this.prisma.$queryRaw<{ paid: bigint }[]>`
      SELECT coalesce(sum("totalCents"), 0)::bigint AS paid FROM "OwnerPayout" WHERE "paidOn" >= ${from} AND "paidOn" <= ${to}`;
    // Rent owed to landlords is a running balance (all time), independent of the date range.
    const [owed] = await this.prisma.$queryRaw<{ owed: bigint }[]>`
      SELECT (coalesce((SELECT sum("landlordCents") FROM "RentLedgerEntry"), 0) -
              coalesce((SELECT sum("amountCents") FROM "OwnerPayoutLine"), 0))::bigint AS owed`;

    const money = computeDashboardMoney({
      rentCollectedLandlordCents: toCents(rent!.landlord),
      rentCollectedFeeCents: toCents(rent!.fee),
      rentFeeOutstandingCents: toCents(feeOutstanding!.outstanding),
      saleCommissionCollectedCents: toCents(sale!.collected),
      saleCommissionOutstandingCents: toCents(sale!.outstanding),
      ownerPayoutsCents: toCents(payouts!.paid),
    });
    money.rentOwedToLandlordsCents = toCents(owed!.owed);

    return {
      listings: Object.fromEntries(listings.map((l) => [l.status, l._count._all])) as Record<ListingStatus, number>,
      leads: Object.fromEntries(leads.map((l) => [l.status, l._count._all])) as Record<LeadStatus, number>,
      viewingsNext7Days: viewings,
      activeRentals,
      salesClosedThisMonth: salesThisMonth,
      money,
      overdueObligations: Number(feeOutstanding!.overdue_count),
    };
  }

  async workload() {
    const employees = await this.prisma.user.findMany({
      where: { roles: { has: 'EMPLOYEE' }, blocked: false, anonymizedAt: null },
      select: {
        id: true,
        fullName: true,
        _count: {
          select: {
            assignedLeads: { where: { status: { notIn: ['WON', 'LOST'] } } },
            assignedProperties: { where: { status: { in: ['PUBLISHED', 'PAUSED'] } } },
            assignedViewings: { where: { status: 'CONFIRMED', scheduledAt: { gte: new Date() } } },
            employeeAgreements: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    return employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      openLeads: e._count.assignedLeads,
      activeListings: e._count.assignedProperties,
      upcomingViewings: e._count.assignedViewings,
      activeAgreements: e._count.employeeAgreements,
    }));
  }
}
