import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { api, createApp, prisma, publishedListing, uploadPhoto, user, locations } from './helpers';

const PRIVATE_VALUES = ['03 999 888', '+9613999888', 'private-owner@test.dar', 'Private test address 42', '33.560123', '35.371234', 'Owner Private'];

describe('listings, privacy and access boundaries', () => {
  let app: INestApplication;
  let admin: Awaited<ReturnType<typeof user>>;
  let emp: Awaited<ReturnType<typeof user>>;
  let otherEmp: Awaited<ReturnType<typeof user>>;
  let owner: Awaited<ReturnType<typeof user>>;
  let customer: Awaited<ReturnType<typeof user>>;

  beforeAll(async () => {
    app = await createApp();
    admin = await user(app, ['ADMIN']);
    emp = await user(app, ['EMPLOYEE']);
    otherEmp = await user(app, ['EMPLOYEE']);
    owner = await user(app);
    customer = await user(app);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('a listing is invisible to the public until an admin approves it', async () => {
    const loc = await locations(app);
    const draft = await owner.api.post('/v1/owner/properties', {
      listingType: 'SALE', propertyType: 'LAND', titleAr: 'أرض للبيع للاختبار', descriptionAr: 'أرض مستوية على طريق رئيسي للاختبار فقط',
      ...loc, exactAddress: 'Plot 1 secret', priceCents: 5_000_000, sizeSqm: 900, ownerContactPhone: '71 222 333', bedrooms: 4,
    });
    expect(draft.status).toBe(201);
    expect(draft.body.bedrooms).toBeNull(); // land never keeps bedrooms
    const id = draft.body.id;
    expect((await api(app).get(`/v1/listings/${id}`)).status).toBe(404);

    const incomplete = await owner.api.post(`/v1/owner/properties/${id}/submit`);
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error.details.missing).toContain('photos');

    for (let i = 0; i < 3; i++) await uploadPhoto(owner.api, id);
    expect((await owner.api.post(`/v1/owner/properties/${id}/submit`)).status).toBe(201);
    expect((await api(app).get(`/v1/listings/${id}`)).status).toBe(404); // pending review

    // Owners and employees cannot approve
    expect((await owner.api.post(`/v1/admin/moderation/properties/${id}/decision`, { decision: 'APPROVE' })).status).toBe(403);
    expect((await emp.api.post(`/v1/admin/moderation/properties/${id}/decision`, { decision: 'APPROVE' })).status).toBe(403);

    expect((await admin.api.post(`/v1/admin/moderation/properties/${id}/decision`, { decision: 'APPROVE', assignedEmployeeId: emp.id })).status).toBe(201);
    const pub = await api(app).get(`/v1/listings/${id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.photos).toHaveLength(3);
  });

  it('public responses never include owner contact, exact address or precise coordinates', async () => {
    const id = await publishedListing(app, owner, admin, emp.id);
    const one = await api(app).get(`/v1/listings/${id}`);
    const list = await api(app).get('/v1/listings?pageSize=50');
    const favs = await customer.api.put(`/v1/me/favorites/${id}`).then(() => customer.api.get('/v1/me/favorites'));
    for (const body of [one.body, list.body, favs.body]) {
      const json = JSON.stringify(body);
      for (const secret of PRIVATE_VALUES) expect(json).not.toContain(secret);
      for (const key of ['ownerId', 'exactAddress', 'latitude', 'longitude', 'ownerContactPhone', 'assignedEmployeeId']) expect(json).not.toContain(`"${key}"`);
    }
    expect(one.body.pricing).toEqual({ kind: 'RENT', tenantMonthlyTotalCents: 55_000, includesMonthlyFeeCents: 5_000 });
  });

  it('uploaded photos have their EXIF/GPS metadata removed', async () => {
    const id = await publishedListing(app, owner, admin, emp.id);
    const pub = await api(app).get(`/v1/listings/${id}`);
    const path = new URL(pub.body.photos[0].url).pathname;
    const img = await request(app.getHttpServer()).get(path).buffer(true);
    expect(img.status).toBe(200);
    const raw = Buffer.from(img.body).toString('latin1');
    expect(raw).not.toContain('secret-gps-test');
    expect(raw).not.toContain('35.3689E');
    expect(raw).not.toContain('Exif');
  });

  it('owner details: admin and assigned employee only (audited); not other employees or customers', async () => {
    const id = await publishedListing(app, owner, admin, emp.id);
    expect((await customer.api.get(`/v1/staff/properties/${id}`)).status).toBe(403);
    expect((await otherEmp.api.get(`/v1/staff/properties/${id}`)).status).toBe(403);
    const mine = await emp.api.get(`/v1/staff/properties/${id}`);
    expect(mine.status).toBe(200);
    expect(mine.body.ownerContactPhone).toBe('+9613999888');
    expect((await admin.api.get(`/v1/staff/properties/${id}`)).status).toBe(200);
    const audits = await prisma.auditLog.count({ where: { entityId: id, action: 'sensitive.owner_contact_viewed' } });
    expect(audits).toBeGreaterThanOrEqual(2);
    // Another user cannot read or edit the owner's private record.
    expect((await customer.api.get(`/v1/owner/properties/${id}`)).status).toBe(403);
    expect((await customer.api.put(`/v1/owner/properties/${id}`, { priceCents: 1 })).status).toBe(403);
  });

  it('editing a published listing holds sensitive changes for review; the approved version stays public', async () => {
    const id = await publishedListing(app, owner, admin, emp.id);
    await owner.api.put(`/v1/owner/properties/${id}`, { priceCents: 60_000, availableFrom: '2030-01-01' });
    const pub = await api(app).get(`/v1/listings/${id}`);
    expect(pub.body.pricing.tenantMonthlyTotalCents).toBe(55_000); // old price still shown
    expect(pub.body.availableFrom).toBe('2030-01-01'); // non-sensitive applied directly
    const q = await admin.api.get('/v1/admin/moderation');
    const rev = q.body.revisions.find((r: any) => r.propertyId === id);
    expect(rev).toBeTruthy();
    await admin.api.post(`/v1/admin/moderation/revisions/${rev.id}/decision`, { decision: 'APPROVE' });
    expect((await api(app).get(`/v1/listings/${id}`)).body.pricing.tenantMonthlyTotalCents).toBe(65_000);
  });

  it('contact details typed into a description are flagged for moderation', async () => {
    const loc = await locations(app);
    const draft = await owner.api.post('/v1/owner/properties', { listingType: 'RENT', propertyType: 'APARTMENT', titleAr: 'شقة', descriptionAr: 'للتواصل واتساب ٧١ ١٢٣ ٤٥٦ شكرا', ...loc });
    expect(draft.body.contactFlagged).toBe(true);
  });

  it('employees see only their own leads', async () => {
    const id = await publishedListing(app, owner, admin, emp.id);
    const disclosure = (await api(app).get(`/v1/listings/${id}/viewing-terms`)).body;
    const v = await customer.api.post('/v1/viewings', {
      propertyId: id, preferredSlots: [{ date: '2099-01-01', period: 'MORNING' }], acceptedTermsVersion: disclosure.termsVersion, acceptedFeeCents: disclosure.amountCents, idempotencyKey: crypto.randomUUID(),
    });
    expect(v.status).toBe(201);
    const lead = await prisma.lead.findFirstOrThrow({ where: { propertyId: id, customerId: customer.id } });
    expect((await emp.api.get(`/v1/staff/leads/${lead.id}`)).status).toBe(200);
    expect((await otherEmp.api.get(`/v1/staff/leads/${lead.id}`)).status).toBe(403);
    expect((await owner.api.get(`/v1/staff/leads/${lead.id}`)).status).toBe(403);
    const otherList = await otherEmp.api.get('/v1/staff/leads');
    expect(otherList.body.items.find((l: any) => l.id === lead.id)).toBeUndefined();
    // The owner sees viewing activity without the customer's identity.
    const activity = await owner.api.get(`/v1/owner/properties/${id}/viewing-activity`);
    expect(JSON.stringify(activity.body)).not.toContain(customer.email);
    expect(Object.keys(activity.body[0]).sort()).toEqual(['createdAt', 'id', 'scheduledAt', 'status']);
  });
});
