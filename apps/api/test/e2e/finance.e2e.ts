import { INestApplication } from '@nestjs/common';
import { addDays, addMonthsAnchored, todayInBeirut } from '@dar/shared';
import { createApp, prisma, publishedListing, user, uuid } from './helpers';

describe('rentals, collections, payouts and sales', () => {
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof user>>;
  let emp: Awaited<ReturnType<typeof user>>;
  let collector: Awaited<ReturnType<typeof user>>;
  let owner: Awaited<ReturnType<typeof user>>;
  let tenant: Awaited<ReturnType<typeof user>>;
  let agreementId: string;

  beforeAll(async () => {
    app = await createApp();
    admin = await user(app, ['ADMIN']);
    emp = await user(app, ['EMPLOYEE']);
    collector = await user(app, ['EMPLOYEE'], { canRecordCollections: true });
    owner = await user(app);
    tenant = await user(app);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a lease with $500 net + $50 fee and activates it only after both acceptances', async () => {
    const propertyId = await publishedListing(app, owner, admin, collector.id);
    const start = addMonthsAnchored(`${todayInBeirut().slice(0, 7)}-01`, -2);
    const res = await admin.api.post('/v1/staff/agreements', {
      propertyId, tenantId: tenant.id, assignedEmployeeId: collector.id, startDate: start, endDate: addDays(addMonthsAnchored(start, 12), -1),
      dueDay: 5, enteredAmountCents: 50_000, depositCents: 50_000,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ landlordNetCents: 50_000, platformFeeCents: 5_000, tenantTotalCents: 55_000, status: 'DRAFT' });
    agreementId = res.body.id;

    expect((await admin.api.post(`/v1/staff/agreements/${agreementId}/activate`)).status).toBe(400); // no acceptances yet
    // Tenant accepts in the app against the disclosed monthly total.
    const terms = (await tenant.api.get(`/v1/me/agreements/${agreementId}/terms`)).body;
    expect(terms.tenantMonthlyTotalCents).toBe(55_000);
    expect(terms.landlordNetCents).toBeUndefined();
    expect((await tenant.api.post(`/v1/me/agreements/${agreementId}/accept`, { termsVersion: terms.termsVersion, disclosedMonthlyCents: 55_000 })).status).toBe(201);
    const ownerTerms = (await owner.api.get(`/v1/me/agreements/${agreementId}/terms`)).body;
    expect(ownerTerms).toMatchObject({ landlordNetCents: 50_000, feeDeductedFromOwner: false });
    await owner.api.post(`/v1/me/agreements/${agreementId}/accept`, { termsVersion: ownerTerms.termsVersion, disclosedMonthlyCents: 50_000 });

    expect((await emp.api.post(`/v1/staff/agreements/${agreementId}/activate`)).status).toBe(403); // admin only
    const act = await admin.api.post(`/v1/staff/agreements/${agreementId}/activate`);
    expect(act.status).toBe(201);
    expect(act.body.status).toBe('ACTIVE');
    expect(act.body.obligations.length).toBeGreaterThanOrEqual(3);
  });

  it('monthly obligation generation never duplicates', async () => {
    const { RentalsService } = await import('../../src/modules/finance/rentals.service');
    const svc = app.get(RentalsService);
    const before = await prisma.rentObligation.count({ where: { agreementId } });
    expect(await svc.generateFor(agreementId, todayInBeirut())).toBe(0);
    await Promise.all([svc.generateAll(todayInBeirut()), svc.generateAll(todayInBeirut())]);
    expect(await prisma.rentObligation.count({ where: { agreementId } })).toBe(before);
  });

  it('existing agreements keep their accepted fee after the global settings change', async () => {
    const r = await admin.api.post('/v1/admin/settings/pricing', {
      saleBuyerBps: 300, saleSellerBps: 300, rentalMonthlyFeeCents: 7_500, rentalPricingMode: 'NET_PLUS_FEE', termsVersion: 'test-v2', changeReason: 'Test fee change',
    });
    expect(r.status).toBe(201);
    const { RentalsService } = await import('../../src/modules/finance/rentals.service');
    await app.get(RentalsService).generateFor(agreementId, addDays(todayInBeirut(), 120));
    const obs = await prisma.rentObligation.findMany({ where: { agreementId } });
    expect(obs.every((o) => Number(o.feeShareCents) === 5_000 && Number(o.totalCents) === 55_000)).toBe(true);
    // Direct tampering is rejected by the database.
    await expect(prisma.rentalAgreement.update({ where: { id: agreementId }, data: { platformFeeCents: 7_500n, tenantTotalCents: 57_500n } })).rejects.toThrow(/AGREEMENT_TERMS_FROZEN/);
    // Restore the defaults so later suites see the standard 2.5% / $50 rules.
    const restore = await admin.api.post('/v1/admin/settings/pricing', {
      saleBuyerBps: 250, saleSellerBps: 250, rentalMonthlyFeeCents: 5_000, rentalPricingMode: 'NET_PLUS_FEE', termsVersion: 'test-v3', changeReason: 'Restore defaults after test',
    });
    expect(restore.status).toBe(201);
  });

  it('partial payments, overpayment rejection, idempotent recording and reversal', async () => {
    const [first] = await prisma.rentObligation.findMany({ where: { agreementId }, orderBy: { periodIndex: 'asc' }, take: 1 });
    const pay = (amountCents: number, key = uuid(), who = collector) =>
      who.api.post(`/v1/staff/obligations/${first!.id}/payments`, { amountCents, method: 'CASH', receivedOn: todayInBeirut(), idempotencyKey: key });

    expect((await pay(30_000, uuid(), emp)).status).toBe(403); // not assigned, no collection permission
    const key = uuid();
    const p1 = await pay(30_000, key);
    expect(p1.status).toBe(201);
    expect((await pay(30_000, key)).body.duplicate).toBe(true);
    expect((await pay(25_001)).status).toBe(422);
    const p2 = await pay(25_000);
    expect(p2.status).toBe(201);

    const entries = await prisma.rentLedgerEntry.findMany({ where: { obligationId: first!.id }, orderBy: { createdAt: 'asc' } });
    expect(entries.map((e) => [Number(e.landlordCents), Number(e.feeCents)])).toEqual([[30_000, 0], [20_000, 5_000]]);

    // Owner payout: only what was collected for the owner, never automatic.
    const statement = (await owner.api.get('/v1/me/owner-statement')).body;
    expect(statement.totals.payableCents).toBe(50_000);
    expect(statement.totals.paidOutCents).toBe(0);
    expect((await collector.api.post('/v1/staff/payouts', { ownerId: owner.id, obligationIds: [first!.id], method: 'BANK_TRANSFER', paidOn: todayInBeirut(), reference: 'T1', idempotencyKey: uuid() })).status).toBe(403);
    const payout = await admin.api.post('/v1/staff/payouts', { ownerId: owner.id, obligationIds: [first!.id], method: 'BANK_TRANSFER', paidOn: todayInBeirut(), reference: 'TRX-1', idempotencyKey: uuid() });
    expect(payout.status).toBe(201);
    expect(payout.body.totalCents).toBe(50_000);

    // The second tenant payment bounces → reversal keeps history and surfaces owner debt.
    const rev = await admin.api.post('/v1/staff/obligations/entries/reverse', { entryId: entries[1]!.id, reason: 'Transfer bounced', idempotencyKey: uuid() });
    expect(rev.status).toBe(201);
    const again = await admin.api.post('/v1/staff/obligations/entries/reverse', { entryId: entries[1]!.id, reason: 'Transfer bounced', idempotencyKey: uuid() });
    expect(again.status).toBe(409);
    const after = (await owner.api.get('/v1/me/owner-statement')).body;
    expect(after.totals.ownerDebtCents).toBe(20_000);
    expect(await prisma.rentLedgerEntry.count({ where: { obligationId: first!.id } })).toBe(3);
  });

  it('dashboard keeps collected rent, revenue, unpaid fees, owed rent and payouts separate', async () => {
    const d = (await admin.api.get('/v1/admin/dashboard')).body.money;
    expect(d.brokerageRevenueEarnedCents).toBeLessThan(d.moneyCollectedCents);
    expect(d.landlordPayoutsCents).toBeGreaterThanOrEqual(50_000);
    expect((await emp.api.get('/v1/admin/dashboard')).status).toBe(403);
  });

  it('sale closing uses the final agreed price, needs admin approval, and tracks buyer/seller separately', async () => {
    const seller = await user(app);
    const buyer = await user(app);
    const propertyId = await publishedListing(app, seller, admin, emp.id, { listingType: 'SALE', priceCents: 15_000_000 });
    const now = new Date().toISOString();
    const req = await emp.api.post('/v1/staff/sales', {
      propertyId, buyerId: buyer.id, finalPriceCents: 10_000_000, closingDate: todayInBeirut(),
      buyerAcceptance: { acceptedAt: now, channel: 'in_person_recorded_by_staff' }, sellerAcceptance: { acceptedAt: now, channel: 'in_person_recorded_by_staff' },
    });
    expect(req.status).toBe(201);
    // Settings were changed to 3%/3% in an earlier test; the snapshot uses the current version.
    expect(req.body).toMatchObject({ status: 'PENDING_APPROVAL', sellerCommissionCents: 300_000, buyerCommissionCents: 300_000 });
    expect((await emp.api.post(`/v1/staff/sales/${req.body.id}/approve`)).status).toBe(403);
    const ok = await admin.api.post(`/v1/staff/sales/${req.body.id}/approve`);
    expect(ok.status).toBe(201);
    expect(ok.body.obligations.map((o: any) => [o.party, o.status]).sort()).toEqual([['BUYER', 'PENDING'], ['SELLER', 'PENDING']]);
    expect((await prisma.property.findUniqueOrThrow({ where: { id: propertyId } })).status).toBe('SOLD');
    // The buyer only sees their own obligation.
    const mine = await buyer.api.get(`/v1/me/sales/${req.body.id}`);
    expect(mine.body.obligations.map((o: any) => o.party)).toEqual(['BUYER']);
    expect(mine.body.sellerCommissionCents).toBeUndefined();
  });
});
