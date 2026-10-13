import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://dar:dar_local_dev@localhost:5432/dar_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123456789';
process.env.TOKEN_HASH_PEPPER ??= 'test-pepper-test-pepper-test-pepper-0123456789';
process.env.STORAGE_DRIVER = 'local';
process.env.PUBLIC_API_URL = 'http://localhost:4999';
process.env.EMAIL_DRIVER = 'console';
process.env.JOBS_ENABLED = 'false';
process.env.PUSH_ENABLED = 'false';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppModule } = require('../../src/app.module');

export const prisma = new PrismaClient();

export async function createApp(): Promise<INestApplication> {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  await app.init();
  return app;
}

export type Api = ReturnType<typeof api>;
export function api(app: INestApplication, token?: string) {
  const auth = (r: request.Test) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
  const server = app.getHttpServer();
  return {
    get: (url: string) => auth(request(server).get(url)),
    post: (url: string, body?: object) => auth(request(server).post(url)).send(body ?? {}),
    put: (url: string, body?: object) => auth(request(server).put(url)).send(body ?? {}),
    del: (url: string) => auth(request(server).delete(url)),
    raw: server,
  };
}

let counter = 0;
/** Registers a user, optionally promotes roles directly in the DB, and logs in. */
export async function user(app: INestApplication, roles: ('ADMIN' | 'EMPLOYEE' | 'OWNER' | 'CUSTOMER')[] = ['CUSTOMER'], extra: { canRecordCollections?: boolean } = {}) {
  const n = ++counter;
  const email = `u${n}-${Date.now()}@test.dar`;
  const password = 'Password-12345';
  const reg = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ fullName: `Test User ${n}`, email, password, phone: `71 ${String(100000 + n).slice(0, 3)} ${String(100 + n).padStart(3, '0')}`, acceptedTermsVersion: 'test' });
  if (reg.status !== 201) throw new Error(`register failed ${reg.status} ${JSON.stringify(reg.body)}`);
  const u = await prisma.user.update({ where: { email }, data: { roles: Array.from(new Set(['CUSTOMER', ...roles])) as any, ...extra } });
  const login = await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password, device: roles.some((r) => r === 'ADMIN' || r === 'EMPLOYEE') ? 'admin' : 'mobile' });
  return { id: u.id, email, password, token: login.body.accessToken as string, refreshToken: login.body.refreshToken as string, api: api(app, login.body.accessToken) };
}

export async function jpeg(): Promise<Buffer> {
  // Includes an EXIF block with GPS-like data to prove it is stripped.
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 190, b: 170 } } })
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-gps-test', ImageDescription: '33.5631N 35.3689E' } } })
    .jpeg()
    .toBuffer();
}

/** Full upload flow through the dev storage driver: intent → PUT → complete. */
export async function uploadPhoto(a: Api, propertyId: string) {
  const img = await jpeg();
  const intent = await a.post('/v1/uploads', { kind: 'PHOTO', mimeType: 'image/jpeg', sizeBytes: img.length, fileName: 'p.jpg', propertyId });
  if (intent.status !== 201) throw new Error(`intent ${intent.status} ${JSON.stringify(intent.body)}`);
  const path = new URL(intent.body.uploadUrl).pathname;
  const put = await request(a.raw).put(path).set('Content-Type', 'image/jpeg').send(img);
  if (put.status !== 200) throw new Error(`put ${put.status}`);
  const done = await a.post(`/v1/uploads/${intent.body.mediaId}/complete`);
  if (done.status !== 201) throw new Error(`complete ${done.status} ${JSON.stringify(done.body)}`);
  return done.body;
}

export async function locations(app: INestApplication) {
  const res = await request(app.getHttpServer()).get('/v1/locations');
  const area = res.body.find((l: any) => l.kind === 'AREA' && l.nameEn === 'Saida');
  const town = res.body.find((l: any) => l.kind === 'TOWN' && l.parentId === area.id);
  return { areaId: area.id as string, townId: town.id as string };
}

export const uuid = () => randomUUID();

/** Owner draft → photos → submit → admin approve (with employee). Returns the property id. */
export async function publishedListing(
  app: INestApplication,
  owner: { api: Api },
  admin: { api: Api },
  employeeId: string,
  overrides: Record<string, unknown> = {},
) {
  const loc = await locations(app);
  const draft = await owner.api.post('/v1/owner/properties', {
    listingType: 'RENT',
    propertyType: 'APARTMENT',
    titleAr: 'شقة للإيجار للاختبار',
    descriptionAr: 'شقة واسعة ومشمسة قريبة من كل الخدمات للاختبار',
    ...loc,
    exactAddress: 'Private test address 42',
    latitude: 33.560123,
    longitude: 35.371234,
    priceCents: 50_000,
    sizeSqm: 120,
    bedrooms: 2,
    bathrooms: 1,
    floor: 2,
    ownerContactName: 'Owner Private',
    ownerContactPhone: '03 999 888',
    ownerContactEmail: 'private-owner@test.dar',
    ...overrides,
  });
  if (draft.status !== 201) throw new Error(`draft ${draft.status} ${JSON.stringify(draft.body)}`);
  const id = draft.body.id as string;
  for (let i = 0; i < 3; i++) await uploadPhoto(owner.api, id);
  const sub = await owner.api.post(`/v1/owner/properties/${id}/submit`);
  if (sub.status !== 201) throw new Error(`submit ${sub.status} ${JSON.stringify(sub.body)}`);
  const ok = await admin.api.post(`/v1/admin/moderation/properties/${id}/decision`, { decision: 'APPROVE', assignedEmployeeId: employeeId });
  if (ok.status !== 201) throw new Error(`approve ${ok.status} ${JSON.stringify(ok.body)}`);
  return id;
}
