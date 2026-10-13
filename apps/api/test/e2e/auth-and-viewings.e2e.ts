import { INestApplication } from '@nestjs/common';
import { api, createApp, prisma, publishedListing, user, uuid } from './helpers';

describe('auth, viewings and messaging', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers with a Lebanese phone that is stored but never marked verified', async () => {
    const u = await user(app);
    const me = await u.api.get('/v1/auth/me');
    expect(me.body.phone).toMatch(/^\+96171\d{6}$/);
    expect(me.body.phoneVerified).toBe(false);
    const otp = await u.api.post('/v1/auth/phone/send-code');
    expect(otp.status).toBe(503);
    expect(otp.body.error.code).toBe('OTP_NOT_CONFIGURED');
  });

  it('rejects invalid phones and weak passwords', async () => {
    const r = await api(app).post('/v1/auth/register', { fullName: 'X Y', email: 'bad@test.dar', password: 'short', phone: '12345', acceptedTermsVersion: 't' });
    expect(r.status).toBe(400);
    const codes = r.body.error.details.fields.map((f: any) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['PHONE_INVALID', 'PASSWORD_TOO_SHORT']));
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const u = await user(app);
    const first = await api(app).post('/v1/auth/refresh', { refreshToken: u.refreshToken });
    expect(first.status).toBe(200);
    const reuse = await api(app).post('/v1/auth/refresh', { refreshToken: u.refreshToken });
    expect(reuse.status).toBe(401);
    const afterReuse = await api(app).post('/v1/auth/refresh', { refreshToken: first.body.refreshToken });
    expect(afterReuse.status).toBe(401); // whole family revoked
  });

  it('the admin dashboard login is refused to non-staff accounts', async () => {
    const u = await user(app);
    const r = await api(app).post('/v1/auth/login', { email: u.email, password: u.password, device: 'admin' });
    expect(r.status).toBe(401);
  });

  it('viewing request requires the current fee disclosure, is idempotent, and creates an assigned lead + conversation', async () => {
    const admin = await user(app, ['ADMIN']);
    const emp = await user(app, ['EMPLOYEE']);
    const owner = await user(app);
    const customer = await user(app);
    const id = await publishedListing(app, owner, admin, emp.id);
    const terms = (await api(app).get(`/v1/listings/${id}/viewing-terms`)).body;
    expect(terms).toMatchObject({ kind: 'RENT', amountCents: 55_000, feeCents: 5_000 });

    expect((await api(app).post('/v1/viewings', { propertyId: id })).status).toBe(401); // visitors must sign in
    const stale = await customer.api.post('/v1/viewings', {
      propertyId: id, preferredSlots: [{ date: '2099-01-01', period: 'MORNING' }], acceptedTermsVersion: terms.termsVersion, acceptedFeeCents: 50_000, idempotencyKey: uuid(),
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('TERMS_CHANGED');

    const key = uuid();
    const body = { propertyId: id, preferredSlots: [{ date: '2099-01-01', period: 'MORNING' }], acceptedTermsVersion: terms.termsVersion, acceptedFeeCents: 55_000, idempotencyKey: key };
    const ok = await customer.api.post('/v1/viewings', body);
    expect(ok.status).toBe(201);
    const again = await customer.api.post('/v1/viewings', body);
    expect(again.body.id).toBe(ok.body.id);
    expect(await prisma.viewingRequest.count({ where: { propertyId: id } })).toBe(1);

    const stored = await prisma.viewingRequest.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(Number(stored.disclosedAmountCents)).toBe(55_000);
    expect(stored.acceptedAt).toBeTruthy();
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: stored.leadId! } });
    expect(lead).toMatchObject({ status: 'ASSIGNED', assignedEmployeeId: emp.id });

    // Staff confirm; the same employee cannot be double-booked.
    const at = new Date(Date.now() + 3 * 86_400_000);
    at.setUTCHours(8, 0, 0, 0);
    expect((await emp.api.post(`/v1/staff/viewings/${ok.body.id}/confirm`, { scheduledAt: at.toISOString(), durationMinutes: 45 })).status).toBe(201);
    const customer2 = await user(app);
    const v2 = await customer2.api.post('/v1/viewings', { ...body, idempotencyKey: uuid() });
    const clash = await emp.api.post(`/v1/staff/viewings/${v2.body.id}/confirm`, { scheduledAt: new Date(at.getTime() + 30 * 60_000).toISOString(), durationMinutes: 45 });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('EMPLOYEE_DOUBLE_BOOKED');

    // Messaging is customer ↔ staff; the owner has no access; internal notes never leak.
    const convId = (await customer.api.get('/v1/me/viewings')).body[0].conversationId;
    expect(convId).toBeTruthy();
    expect((await customer.api.post(`/v1/conversations/${convId}/messages`, { body: 'متى فيني زور؟', clientMessageId: uuid() })).status).toBe(201);
    await emp.api.post(`/v1/staff/conversations/${convId}/notes`, { body: 'INTERNAL-ONLY-NOTE' });
    const msgs = await customer.api.get(`/v1/conversations/${convId}/messages`);
    expect(JSON.stringify(msgs.body)).not.toContain('INTERNAL-ONLY-NOTE');
    expect((await owner.api.get(`/v1/conversations/${convId}/messages`)).status).toBe(403);
    expect((await customer2.api.get(`/v1/conversations/${convId}/messages`)).status).toBe(403);
    expect((await customer.api.get(`/v1/staff/conversations/${convId}/notes`)).status).toBe(403);
  });
});
