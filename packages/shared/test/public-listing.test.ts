import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoPrivateFields,
  isPubliclyVisible,
  listingMachine,
  leadMachine,
  viewingMachine,
  agreementMachine,
  PropertyForPublic,
  toPublicListing,
  DEFAULT_SALE_FEE_RULES,
  DEFAULT_RENTAL_FEE_RULES,
} from '../src/domain';

const fees = { sale: DEFAULT_SALE_FEE_RULES, rental: DEFAULT_RENTAL_FEE_RULES };
const loc = {
  area: { id: 'a1', nameAr: 'صيدا', nameEn: 'Saida' },
  town: { id: 't1', nameAr: 'صيدا', nameEn: 'Saida', lat: 33.5631, lng: 35.3689 },
  neighborhood: null,
};

// A full database row INCLUDING private columns, as Prisma would return it.
const row = {
  id: 'prop_1',
  publicRef: 'DAR-1001',
  status: 'PUBLISHED',
  approvedAt: new Date('2026-10-01T10:00:00Z'),
  listingType: 'SALE',
  propertyType: 'APARTMENT',
  titleAr: 'شقة مطلة على البحر',
  titleEn: 'Sea-view apartment',
  descriptionAr: 'شقة واسعة ومشمسة قريبة من الكورنيش',
  descriptionEn: null,
  areaId: 'a1',
  townId: 't1',
  neighborhoodId: null,
  priceCents: 15_000_000,
  rentPricingMode: null,
  sizeSqm: 160,
  bedrooms: 3,
  bathrooms: 2,
  floor: 4,
  totalFloors: 8,
  furnished: false,
  amenities: ['elevator', 'parking'],
  availableFrom: '2026-11-01',
  featured: true,
  publishedAt: new Date('2026-10-01T10:00:00Z'),
  demo: true,
  // private columns that must never leave the server publicly:
  ownerId: 'user_owner',
  exactAddress: 'Bldg 12, Street 5, near the pharmacy',
  latitude: 33.560123,
  longitude: 35.371234,
  ownerContactPhone: '+96171123456',
  ownerContactEmail: 'owner@example.com',
  assignedEmployeeId: 'emp1',
  internalNotes: 'Owner prefers calls after 5pm',
} as const;

test('public listing payload contains no private fields or values', () => {
  const pub = toPublicListing(row as unknown as PropertyForPublic, loc, [], fees);
  const json = JSON.stringify(pub);
  for (const secret of ['+96171123456', 'owner@example.com', 'Bldg 12', '33.560123', '35.371234', 'user_owner', 'emp1', 'pharmacy', '5pm']) {
    assert.ok(!json.includes(secret), `leaked: ${secret}`);
  }
  assert.equal(pub.pricing.kind, 'SALE');
  if (pub.pricing.kind === 'SALE') assert.equal(pub.pricing.buyerTotalCents, 15_375_000);
  // Approximate point is near the town centre, not the private pin.
  assert.ok(Math.abs(pub.location.approximate!.lat - 33.5631) < 0.004);
  assert.notEqual(pub.location.approximate!.lat, row.latitude);
  assert.equal(pub.demo, true);
});

test('rental listing shows the tenant monthly total including the fee', () => {
  const pub = toPublicListing({ ...(row as any), listingType: 'RENT', priceCents: 50_000, rentPricingMode: 'NET_PLUS_FEE' }, loc, [], fees);
  assert.deepEqual(pub.pricing, { kind: 'RENT', tenantMonthlyTotalCents: 55_000, includesMonthlyFeeCents: 5_000 });
});

test('defence in depth: forbidden keys anywhere in a payload are rejected', () => {
  assert.throws(() => assertNoPrivateFields({ items: [{ id: 1, owner: { phone: 'x' } }] }), /PRIVATE_FIELD|Private field/);
  assert.throws(() => assertNoPrivateFields({ latitude: 1 }));
  assert.doesNotThrow(() => assertNoPrivateFields({ id: 'x', title: { ar: 'a' } }));
});

test('listings are invisible to the public until approved and published', () => {
  for (const status of ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'PAUSED', 'RENTED', 'SOLD', 'ARCHIVED']) {
    assert.equal(isPubliclyVisible({ status: status as any, approvedAt: new Date() }), false, status);
    assert.throws(() => toPublicListing({ ...(row as any), status }, loc, [], fees), /LISTING_NOT_PUBLIC/);
  }
  assert.equal(isPubliclyVisible({ status: 'PUBLISHED', approvedAt: null }), false, 'published without approval record');
  assert.equal(isPubliclyVisible({ status: 'PUBLISHED', approvedAt: new Date() }), true);
});

test('listing transitions: only admins publish; rejection needs a reason; owners resubmit', () => {
  assert.throws(() => listingMachine.assert('PENDING_REVIEW', 'PUBLISHED', 'OWNER'));
  assert.throws(() => listingMachine.assert('PENDING_REVIEW', 'PUBLISHED', 'STAFF'));
  assert.doesNotThrow(() => listingMachine.assert('PENDING_REVIEW', 'PUBLISHED', 'ADMIN'));
  assert.throws(() => listingMachine.assert('PENDING_REVIEW', 'REJECTED', 'ADMIN'), /reason/);
  assert.doesNotThrow(() => listingMachine.assert('PENDING_REVIEW', 'REJECTED', 'ADMIN', { reason: 'Phone number visible in photo 3' }));
  assert.doesNotThrow(() => listingMachine.assert('REJECTED', 'PENDING_REVIEW', 'OWNER'));
  assert.throws(() => listingMachine.assert('DRAFT', 'PUBLISHED', 'ADMIN'), /not allowed/);
  assert.throws(() => listingMachine.assert('SOLD', 'PUBLISHED', 'ADMIN'));
  assert.deepEqual(listingMachine.next('PUBLISHED', 'OWNER'), ['PAUSED']);
});

test('lead, viewing and agreement transitions', () => {
  assert.doesNotThrow(() => leadMachine.assert('NEW', 'ASSIGNED', 'ADMIN'));
  assert.throws(() => leadMachine.assert('NEW', 'ASSIGNED', 'STAFF'));
  assert.throws(() => leadMachine.assert('CONTACTED', 'LOST', 'STAFF'), /reason/);
  assert.doesNotThrow(() => leadMachine.assert('CONTACTED', 'LOST', 'STAFF', { reason: 'Found another property' }));
  assert.throws(() => leadMachine.assert('NEGOTIATION', 'WON', 'STAFF'), /not allowed/);
  assert.throws(() => leadMachine.assert('WON', 'LOST', 'ADMIN'));
  assert.doesNotThrow(() => viewingMachine.assert('REQUESTED', 'CANCELLED', 'CUSTOMER'));
  assert.throws(() => viewingMachine.assert('REQUESTED', 'COMPLETED', 'STAFF'));
  assert.throws(() => viewingMachine.assert('CONFIRMED', 'COMPLETED', 'CUSTOMER'));
  assert.doesNotThrow(() => agreementMachine.assert('DRAFT', 'ACTIVE', 'ADMIN'));
  assert.throws(() => agreementMachine.assert('ACTIVE', 'TERMINATED', 'ADMIN'), /reason/);
  assert.throws(() => agreementMachine.assert('TERMINATED', 'ACTIVE', 'ADMIN'));
  assert.throws(() => agreementMachine.assert('DRAFT', 'ACTIVE', 'STAFF'));
});
