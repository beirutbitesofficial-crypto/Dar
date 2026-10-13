import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoConflict,
  detectContactInfo,
  findConflicts,
  hasLikelyContactInfo,
  missingForSubmission,
  normalizeDigits,
  normalizeLebanesePhone,
  sanitizeForType,
  splitEdit,
} from '../src/domain';

const types = (t: string) => detectContactInfo(t).filter((f) => f.confidence !== 'low').map((f) => f.type);

test('normalizes Arabic-Indic and Persian digits', () => {
  assert.equal(normalizeDigits('٠٣ ١٢٣ ٤٥٦'), '03 123 456');
  assert.equal(normalizeDigits('۰۳۱۲۳۴۵۶'), '03123456');
});

test('detects Lebanese phone numbers in Arabic and Latin digits with separators', () => {
  assert.ok(types('للتواصل ٠٣ ١٢٣ ٤٥٦').includes('PHONE'));
  assert.ok(types('call 71-123-456 anytime').includes('PHONE'));
  assert.ok(types('+961 3 123456').includes('PHONE'));
  assert.ok(types('(961)81.123.456').includes('PHONE'));
  assert.ok(types('٧٦١٢٣٤٥٦').includes('PHONE'));
  assert.ok(types('0 7 7 2 1 2 3 4').includes('PHONE'), 'spaced-out digits');
});

test('detects email, links, WhatsApp, social media and handles', () => {
  assert.ok(types('owner.dar@gmail.com').includes('EMAIL'));
  assert.ok(types('write to dar at gmail dot com').includes('EMAIL'));
  assert.ok(types('wa.me/96171123456').includes('WHATSAPP'));
  assert.ok(types('ابعتلي عالواتساب').includes('WHATSAPP'));
  assert.ok(types('شوفوا الصور عالانستا').includes('SOCIAL'));
  assert.ok(types('follow @saida.homes').includes('HANDLE'));
  assert.ok(types('www.example.com/listing').includes('URL'));
  assert.ok(types('تلغرام').includes('SOCIAL'));
});

test('detects digits spelled out in Lebanese Arabic', () => {
  assert.ok(types('صفر تلاتة واحد اتنين تلاتة اربعة خمسة ستة').includes('SPELLED_DIGITS'));
  assert.ok(types('zero three one two three four five six').includes('SPELLED_DIGITS'));
});

test('ignores ordinary listing text: prices, sizes, floors', () => {
  assert.equal(hasLikelyContactInfo('شقة 150 متر مربع، الطابق 3، السعر 120000$'), false);
  assert.equal(hasLikelyContactInfo('أرض 2500 م2 بسعر 3500000 دولار'), false);
  assert.equal(hasLikelyContactInfo('Apartment 3 bedrooms, 2 bathrooms, 4th floor, 160 sqm'), false);
  assert.equal(hasLikelyContactInfo('السعر $3500000'), false);
});

test('Lebanese phone normalization', () => {
  assert.equal(normalizeLebanesePhone('03 123 456'), '+9613123456');
  assert.equal(normalizeLebanesePhone('٧١ ١٢٣ ٤٥٦'), '+96171123456');
  assert.equal(normalizeLebanesePhone('+961 7 721 234'), '+9617721234');
  assert.equal(normalizeLebanesePhone('0096181123456'), '+96181123456');
  assert.equal(normalizeLebanesePhone('12345'), null);
  assert.equal(normalizeLebanesePhone('02 123456'), null);
  assert.equal(normalizeLebanesePhone('72 123 456'), null);
});

test('property fields: land never requires or keeps bedrooms', () => {
  const land = sanitizeForType({ propertyType: 'LAND' as const, bedrooms: 3, bathrooms: 2, floor: 1, sizeSqm: 900, amenities: ['elevator', 'sea_view'] });
  assert.equal(land.bedrooms, null);
  assert.equal(land.floor, null);
  assert.deepEqual(land.amenities, ['sea_view']);
  const missing = missingForSubmission({
    listingType: 'SALE', propertyType: 'LAND', titleAr: 'أرض للبيع في الجية', descriptionAr: 'أرض مطلة على البحر قريبة من الأوتوستراد',
    areaId: 'a', townId: 't', exactAddress: 'Plot 1234 Jiyeh', priceCents: 1, sizeSqm: 900, ownerContactPhone: '+96171123456', photoCount: 3, hasCover: true,
  });
  assert.deepEqual(missing, []);
  const apt = missingForSubmission({ listingType: 'RENT', propertyType: 'APARTMENT', photoCount: 1 });
  for (const f of ['titleAr', 'bedrooms', 'bathrooms', 'floor', 'sizeSqm', 'photos', 'coverPhoto', 'ownerContactPhone']) {
    assert.ok(apt.includes(f), f);
  }
});

test('editing a published listing: sensitive changes are split out for re-review', () => {
  const r = splitEdit({ priceCents: 100, availableFrom: '2026-12-01', titleAr: 'جديد', amenities: ['parking'] });
  assert.equal(r.needsReview, true);
  assert.deepEqual(Object.keys(r.sensitive).sort(), ['priceCents', 'titleAr']);
  assert.deepEqual(Object.keys(r.direct).sort(), ['amenities', 'availableFrom']);
  assert.equal(splitEdit({ availableFrom: '2026-12-01' }).needsReview, false);
});

test('employees cannot be double-booked (15-minute buffer)', () => {
  const existing = [{ id: 'v1', employeeId: 'e1', startsAt: new Date('2026-10-20T10:00:00+03:00'), endsAt: new Date('2026-10-20T10:45:00+03:00') }];
  const clash = { id: 'v2', employeeId: 'e1', startsAt: new Date('2026-10-20T10:50:00+03:00'), endsAt: new Date('2026-10-20T11:30:00+03:00') };
  assert.throws(() => assertNoConflict(clash, existing), /EMPLOYEE_DOUBLE_BOOKED|already has/);
  assert.equal(findConflicts({ ...clash, startsAt: new Date('2026-10-20T11:00:00+03:00') }, existing).length, 0);
  assert.equal(findConflicts({ ...clash, employeeId: 'e2' }, existing).length, 0);
});
