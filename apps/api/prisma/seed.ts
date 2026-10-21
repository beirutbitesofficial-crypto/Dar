/**
 * Seed: `pnpm db:seed`
 *
 * 1. BASE data (always, idempotent): launch-area locations, amenities, pricing
 *    settings v1, placeholder legal documents, notification templates.
 * 2. DEMO data (only when SEED_DEMO=true and not in production): fictional
 *    users for every role, listings across all launch areas (flagged demo=true
 *    and shown with a "Demo listing" badge), requests, a lease with payments
 *    and a payout, and a sale. Every demo record is clearly marked.
 */
import '../src/config/load-env';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import {
  AMENITIES_BY_TYPE,
  AMENITY_KEYS,
  computeObligationBalance,
  planAllObligations,
  planPaymentAllocation,
  PLACEHOLDER_PRIVACY,
  PLACEHOLDER_TERMS,
  snapshotRentalTerms,
  snapshotSaleTerms,
  todayInBeirut,
  addDays,
  addMonthsAnchored,
  type PricingSettings,
  type LedgerEntry,
} from '@dar/shared';
import { StorageService } from '../src/modules/storage/storage.service';
import { AMENITY_LABELS, LOCATIONS, NOTIFICATION_TEMPLATES, SeedLocation } from './seed-data';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Dar-demo-2026';
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function seedLocations() {
  const ids = new Map<string, string>();
  const walk = async (nodes: SeedLocation[], parentId: string | null, kind: 'AREA' | 'TOWN' | 'NEIGHBORHOOD', order = 0) => {
    for (const [i, n] of nodes.entries()) {
      const row = await prisma.location.upsert({
        where: { slug: n.slug },
        create: { slug: n.slug, kind, nameAr: n.nameAr, nameEn: n.nameEn, parentId, lat: n.lat ?? null, lng: n.lng ?? null, sortOrder: order + i },
        update: {},
      });
      ids.set(n.slug, row.id);
      if (n.children) await walk(n.children, row.id, kind === 'AREA' ? 'TOWN' : 'NEIGHBORHOOD');
    }
  };
  await walk(LOCATIONS, null, 'AREA');
  return ids;
}

async function seedBase() {
  const locations = await seedLocations();
  for (const [i, key] of AMENITY_KEYS.entries()) {
    const [ar, en] = AMENITY_LABELS[key]!;
    const appliesTo = (Object.keys(AMENITIES_BY_TYPE) as (keyof typeof AMENITIES_BY_TYPE)[]).filter((t) => AMENITIES_BY_TYPE[t].includes(key));
    await prisma.amenity.upsert({ where: { key }, create: { key, labelAr: ar, labelEn: en, appliesTo, sortOrder: i }, update: {} });
  }
  if (!(await prisma.pricingSettings.findFirst())) {
    await prisma.pricingSettings.create({
      data: {
        version: 1,
        saleBuyerBps: 250,
        saleSellerBps: 250,
        rentalMonthlyFeeCents: 5000n,
        rentalPricingMode: 'NET_PLUS_FEE',
        termsVersion: PLACEHOLDER_TERMS.version,
        changeReason: 'Initial defaults: 2.5% seller + 2.5% buyer; $50/month rental fee paid by tenant',
      },
    });
  }
  for (const [kind, doc] of [['TERMS', PLACEHOLDER_TERMS], ['PRIVACY', PLACEHOLDER_PRIVACY]] as const) {
    await prisma.legalDocument.upsert({
      where: { kind_version: { kind, version: doc.version } },
      create: { kind, version: doc.version, bodyAr: doc.ar, bodyEn: doc.en, legalReviewPending: true },
      update: {},
    });
  }
  for (const t of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({ where: { key: t.key }, create: t, update: {} });
  }
  await prisma.appSetting.upsert({ where: { key: 'reminders' }, create: { key: 'reminders', value: { daysBeforeDue: [3, 0], daysAfterDue: [3, 10] } }, update: {} });
  console.log(`base: ${locations.size} locations, ${AMENITY_KEYS.length} amenities, pricing v1, legal drafts, ${NOTIFICATION_TEMPLATES.length} templates`);
  return locations;
}

/** Placeholder photo generated locally — clearly labelled DEMO, no real property. */
async function demoPhoto(seed: number, label: string): Promise<Buffer> {
  const palettes = [
    ['#E9E2D6', '#C9D6CC', '#1F5A44'],
    ['#F1E7DA', '#D8C3A5', '#7A5C3E'],
    ['#E3ECEF', '#B8CCD3', '#2B5C8A'],
    ['#EFE9E1', '#CBB89D', '#5F646C'],
  ];
  const [a, b, c] = palettes[seed % palettes.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="1600" height="1100" fill="url(#g)"/>
    <g fill="none" stroke="${c}" stroke-width="14" opacity="0.55">
      <path d="M520 640 L800 400 L1080 640 V860 H520 Z"/><rect x="740" y="700" width="120" height="160"/><rect x="600" y="660" width="90" height="80"/><rect x="910" y="660" width="90" height="80"/>
    </g>
    <text x="800" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="88" font-weight="700" fill="${c}" text-anchor="middle" opacity="0.8">DEMO</text>
    <text x="800" y="1000" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" fill="${c}" text-anchor="middle" opacity="0.8">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

interface DemoListing {
  slugArea: string;
  slugTown: string;
  slugHood?: string;
  listingType: 'SALE' | 'RENT';
  propertyType: 'APARTMENT' | 'HOUSE_VILLA' | 'LAND' | 'COMMERCIAL';
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priceUsd: number;
  sizeSqm: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  furnished?: boolean;
  amenities: string[];
  status: 'PUBLISHED' | 'PENDING_REVIEW' | 'DRAFT' | 'REJECTED';
  featured?: boolean;
  owner: 'owner1' | 'owner2';
}

const DEMO_LISTINGS: DemoListing[] = [
  { slugArea: 'saida', slugTown: 'saida-city', slugHood: 'saida-seafront', listingType: 'SALE', propertyType: 'APARTMENT', titleAr: 'شقة مطلّة على البحر بالواجهة البحرية', titleEn: 'Sea-view apartment on the seafront', descriptionAr: 'شقة مشمسة بثلاث غرف نوم، صالون واسع وبلكون كبير على البحر. قريبة من الكورنيش والمحلات.', descriptionEn: 'Bright three-bedroom apartment with a large living room and a big sea-facing balcony, close to the corniche and shops.', priceUsd: 185000, sizeSqm: 170, bedrooms: 3, bathrooms: 2, floor: 5, totalFloors: 9, furnished: false, amenities: ['elevator', 'parking', 'balcony', 'sea_view', 'generator', 'water_tank'], status: 'PUBLISHED', featured: true, owner: 'owner1' },
  { slugArea: 'saida', slugTown: 'abra', listingType: 'RENT', propertyType: 'APARTMENT', titleAr: 'شقة مفروشة بعبرا', titleEn: 'Furnished apartment in Abra', descriptionAr: 'شقة غرفتين نوم مفروشة بالكامل، هادية ومنظّمة، مع اشتراك موتير وطاقة شمسية.', descriptionEn: 'Fully furnished two-bedroom apartment in a quiet building with generator and solar power.', priceUsd: 550, sizeSqm: 115, bedrooms: 2, bathrooms: 1, floor: 2, totalFloors: 4, furnished: true, amenities: ['generator', 'solar_power', 'balcony', 'air_conditioning'], status: 'PUBLISHED', featured: true, owner: 'owner2' },
  { slugArea: 'saida', slugTown: 'majdelyoun', listingType: 'SALE', propertyType: 'HOUSE_VILLA', titleAr: 'فيلا مع حديقة بمجدليون', titleEn: 'Villa with garden in Majdelyoun', descriptionAr: 'فيلا طابقين مع حديقة ومسبح، إطلالة على صيدا والبحر، أربع غرف نوم.', descriptionEn: 'Two-floor villa with garden and pool, overlooking Saida and the sea, four bedrooms.', priceUsd: 420000, sizeSqm: 380, bedrooms: 4, bathrooms: 4, totalFloors: 2, furnished: false, amenities: ['garden', 'pool', 'parking', 'sea_view', 'solar_power', 'water_well'], status: 'PUBLISHED', owner: 'owner1' },
  { slugArea: 'saida', slugTown: 'saida-city', slugHood: 'saida-old-city', listingType: 'RENT', propertyType: 'COMMERCIAL', titleAr: 'محل تجاري بالبلدة القديمة', titleEn: 'Shop in the Old City', descriptionAr: 'محل على شارع ناشط بالأسواق القديمة، مناسب لمقهى أو محل حرف يدوية.', descriptionEn: 'Shop on a busy street in the old souks, suitable for a café or crafts store.', priceUsd: 700, sizeSqm: 60, bathrooms: 1, floor: 0, furnished: false, amenities: ['state_electricity'], status: 'PUBLISHED', owner: 'owner2' },
  { slugArea: 'iqlim-el-kharroub', slugTown: 'barja', listingType: 'SALE', propertyType: 'APARTMENT', titleAr: 'شقة جديدة ببرجا', titleEn: 'New apartment in Barja', descriptionAr: 'شقة بناء جديد، ثلاث غرف نوم، تشطيب ممتاز ومطبخ مجهّز، موقف خاص.', descriptionEn: 'Newly built three-bedroom apartment with excellent finishing, fitted kitchen and private parking.', priceUsd: 98000, sizeSqm: 150, bedrooms: 3, bathrooms: 2, floor: 3, totalFloors: 5, furnished: false, amenities: ['elevator', 'parking', 'balcony', 'mountain_view', 'generator'], status: 'PUBLISHED', featured: true, owner: 'owner1' },
  { slugArea: 'iqlim-el-kharroub', slugTown: 'chehim', listingType: 'SALE', propertyType: 'LAND', titleAr: 'أرض للبيع بشحيم', titleEn: 'Land for sale in Chehim', descriptionAr: 'أرض مستوية على طريق رئيسي، صالحة للبناء، إطلالة جبلية مفتوحة.', descriptionEn: 'Flat plot on a main road, suitable for building, with open mountain views.', priceUsd: 75000, sizeSqm: 1200, amenities: ['mountain_view', 'state_electricity'], status: 'PUBLISHED', owner: 'owner2' },
  { slugArea: 'iqlim-el-kharroub', slugTown: 'ketermaya', listingType: 'RENT', propertyType: 'APARTMENT', titleAr: 'شقة للإيجار بكترمايا', titleEn: 'Apartment for rent in Ketermaya', descriptionAr: 'شقة غرفتين نوم، قريبة من المدارس، مع خزان مي واشتراك موتير.', descriptionEn: 'Two-bedroom apartment near schools, with water tank and generator subscription.', priceUsd: 400, sizeSqm: 110, bedrooms: 2, bathrooms: 1, floor: 1, totalFloors: 3, furnished: false, amenities: ['water_tank', 'generator', 'balcony'], status: 'PUBLISHED', owner: 'owner1' },
  { slugArea: 'iqlim-el-kharroub', slugTown: 'mghairieh', listingType: 'SALE', propertyType: 'HOUSE_VILLA', titleAr: 'بيت حجر قديم بالمغيرية', titleEn: 'Traditional stone house in Mghairieh', descriptionAr: 'بيت حجر مرمّم مع قناطر وحديقة صغيرة، جو هادي وإطلالة.', descriptionEn: 'Restored stone house with arches and a small garden, peaceful setting with a view.', priceUsd: 160000, sizeSqm: 210, bedrooms: 3, bathrooms: 2, totalFloors: 1, furnished: true, amenities: ['garden', 'mountain_view', 'water_well', 'solar_power'], status: 'PENDING_REVIEW', owner: 'owner2' },
  { slugArea: 'jiyeh', slugTown: 'jiyeh-town', slugHood: 'jiyeh-beachfront', listingType: 'RENT', propertyType: 'APARTMENT', titleAr: 'شاليه على البحر بالجية', titleEn: 'Beachfront chalet in Jiyeh', descriptionAr: 'شاليه غرفة نوم مع تراس على البحر، مفروش، إيجار سنوي.', descriptionEn: 'One-bedroom chalet with a sea-facing terrace, furnished, yearly lease.', priceUsd: 650, sizeSqm: 75, bedrooms: 1, bathrooms: 1, floor: 1, totalFloors: 2, furnished: true, amenities: ['terrace', 'sea_view', 'pool', 'air_conditioning'], status: 'PUBLISHED', featured: true, owner: 'owner1' },
  { slugArea: 'jiyeh', slugTown: 'jiyeh-town', slugHood: 'jiyeh-old-village', listingType: 'SALE', propertyType: 'LAND', titleAr: 'أرض زراعية بالجية القديمة', titleEn: 'Agricultural land in old Jiyeh', descriptionAr: 'أرض مزروعة زيتون مع بير مي، قريبة من الأوتوستراد.', descriptionEn: 'Olive grove with a water well, close to the highway.', priceUsd: 120000, sizeSqm: 2500, amenities: ['water_well', 'sea_view'], status: 'PUBLISHED', owner: 'owner2' },
  { slugArea: 'naameh', slugTown: 'naameh-town', listingType: 'RENT', propertyType: 'APARTMENT', titleAr: 'شقة عائلية بالناعمة', titleEn: 'Family apartment in Naameh', descriptionAr: 'شقة ثلاث غرف نوم، مطبخ واسع، قريبة من الطريق البحري.', descriptionEn: 'Three-bedroom apartment with a large kitchen, close to the coastal road.', priceUsd: 500, sizeSqm: 140, bedrooms: 3, bathrooms: 2, floor: 4, totalFloors: 6, furnished: false, amenities: ['elevator', 'parking', 'generator', 'water_tank'], status: 'PUBLISHED', owner: 'owner1' },
  { slugArea: 'naameh', slugTown: 'haret-naameh', listingType: 'SALE', propertyType: 'COMMERCIAL', titleAr: 'مستودع بحارة الناعمة', titleEn: 'Warehouse in Haret En Naameh', descriptionAr: 'مستودع مع مدخل للشاحنات وارتفاع سقف عالي.', descriptionEn: 'Warehouse with truck access and high ceilings.', priceUsd: 210000, sizeSqm: 600, bathrooms: 1, floor: 0, furnished: false, amenities: ['parking', 'state_electricity', 'storage'], status: 'DRAFT', owner: 'owner2' },
  { slugArea: 'damour', slugTown: 'damour-town', slugHood: 'damour-coast', listingType: 'SALE', propertyType: 'APARTMENT', titleAr: 'شقة حديثة بالدامور', titleEn: 'Modern apartment in Damour', descriptionAr: 'شقة غرفتين نوم بمجمّع سكني مع مسبح وحرس.', descriptionEn: 'Two-bedroom apartment in a gated complex with pool and security.', priceUsd: 135000, sizeSqm: 120, bedrooms: 2, bathrooms: 2, floor: 2, totalFloors: 7, furnished: false, amenities: ['elevator', 'pool', 'parking', 'concierge', 'sea_view'], status: 'PUBLISHED', owner: 'owner1' },
  { slugArea: 'damour', slugTown: 'mechref', listingType: 'RENT', propertyType: 'HOUSE_VILLA', titleAr: 'بيت مع حديقة بالمشرف', titleEn: 'House with garden in Mechref', descriptionAr: 'بيت مستقل مع حديقة كبيرة ومواقف لسيارتين. اتصلوا على 03 123 456', descriptionEn: 'Detached house with a large garden and parking for two cars.', priceUsd: 900, sizeSqm: 260, bedrooms: 4, bathrooms: 3, totalFloors: 2, furnished: false, amenities: ['garden', 'parking', 'mountain_view', 'central_heating'], status: 'REJECTED', owner: 'owner2' },
];

async function seedDemo(locations: Map<string, string>) {
  if (await prisma.user.count({ where: { demo: true } })) {
    console.log('demo: already seeded (use `pnpm --filter @dar/api exec prisma migrate reset` to start over)');
    return;
  }
  const storage = new StorageService().driver;
  const hash = await argonHash(DEMO_PASSWORD);
  const mk = (email: string, fullName: string, roles: any[], extra: object = {}) =>
    prisma.user.create({ data: { email, fullName, passwordHash: hash, roles, demo: true, locale: 'ar', termsAcceptedVersion: PLACEHOLDER_TERMS.version, termsAcceptedAt: new Date(), ...extra } });
  const admin = await mk('admin@demo.dar.test', 'مدير تجريبي (Demo Admin)', ['ADMIN'], { phone: '+96170000001' });
  const emp1 = await mk('employee1@demo.dar.test', 'لينا موظفة تجريبية (Demo Employee 1)', ['EMPLOYEE'], { phone: '+96170000002', canRecordCollections: true });
  const emp2 = await mk('employee2@demo.dar.test', 'كريم موظف تجريبي (Demo Employee 2)', ['EMPLOYEE'], { phone: '+96170000003' });
  const owner1 = await mk('owner1@demo.dar.test', 'نادية مالكة تجريبية (Demo Owner 1)', ['CUSTOMER', 'OWNER'], { phone: '+96171000001' });
  const owner2 = await mk('owner2@demo.dar.test', 'سمير مالك تجريبي (Demo Owner 2)', ['CUSTOMER', 'OWNER'], { phone: '+96171000002' });
  const cust1 = await mk('customer1@demo.dar.test', 'مايا زبونة تجريبية (Demo Customer 1)', ['CUSTOMER'], { phone: '+96176000001' });
  const cust2 = await mk('customer2@demo.dar.test', 'عمر زبون تجريبي (Demo Customer 2)', ['CUSTOMER'], { phone: '+96176000002' });
  const owners = { owner1, owner2 };

  const settingsRow = (await prisma.pricingSettings.findFirst({ orderBy: { version: 'desc' } }))!;
  const settings: PricingSettings = {
    version: settingsRow.version,
    termsVersion: settingsRow.termsVersion,
    sale: { buyerBps: settingsRow.saleBuyerBps, sellerBps: settingsRow.saleSellerBps },
    rental: { mode: settingsRow.rentalPricingMode as any, monthlyFeeCents: Number(settingsRow.rentalMonthlyFeeCents) },
  };

  const props: { id: string; refNo: number; listingType: string; ownerId: string; status: string; priceCents: number; assignedEmployeeId: string | null }[] = [];
  for (const [i, l] of DEMO_LISTINGS.entries()) {
    const published = l.status === 'PUBLISHED';
    const emp = i % 2 === 0 ? emp1 : emp2;
    const p = await prisma.property.create({
      data: {
        ownerId: owners[l.owner].id,
        assignedEmployeeId: l.status === 'DRAFT' ? null : emp.id,
        status: l.status,
        listingType: l.listingType,
        propertyType: l.propertyType,
        titleAr: l.titleAr,
        titleEn: l.titleEn,
        descriptionAr: l.descriptionAr,
        descriptionEn: l.descriptionEn,
        areaId: locations.get(l.slugArea)!,
        townId: locations.get(l.slugTown)!,
        neighborhoodId: l.slugHood ? locations.get(l.slugHood)! : null,
        exactAddress: `DEMO — fictional address #${i + 1}`,
        priceCents: BigInt(l.priceUsd * 100),
        rentPricingMode: l.listingType === 'RENT' ? 'NET_PLUS_FEE' : null,
        sizeSqm: l.sizeSqm,
        bedrooms: l.bedrooms ?? null,
        bathrooms: l.bathrooms ?? null,
        floor: l.floor ?? null,
        totalFloors: l.totalFloors ?? null,
        furnished: l.furnished ?? null,
        amenities: l.amenities,
        availableFrom: d(addDays(todayInBeirut(), 14 + i)),
        featured: !!l.featured,
        featuredRank: i,
        demo: true,
        ownerContactName: owners[l.owner].fullName,
        ownerContactPhone: owners[l.owner].phone,
        submittedAt: l.status === 'DRAFT' ? null : new Date(),
        approvedAt: published ? new Date() : null,
        approvedById: published ? admin.id : null,
        publishedAt: published ? new Date(Date.now() - i * 86_400_000) : null,
        rejectionReason: l.status === 'REJECTED' ? 'رقم تلفون ظاهر بالوصف. شيلو وأرسل من جديد. (A phone number is visible in the description — please remove it.)' : null,
        contactFlags: l.status === 'REJECTED' ? [{ type: 'PHONE', match: '03 123 456', confidence: 'high' }] : undefined,
      },
    });
    for (let k = 0; k < 3; k++) {
      const media = await prisma.media.create({
        data: {
          kind: 'PHOTO',
          status: 'READY',
          reviewStatus: published ? 'APPROVED' : 'PENDING',
          uploaderId: owners[l.owner].id,
          propertyId: p.id,
          incomingKey: `incoming/seed-${p.id}-${k}`,
          fileName: `demo-${k + 1}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 0,
          sortOrder: k,
          isCover: k === 0,
          width: 1600,
          height: 1100,
        },
      });
      const img = await demoPhoto(i + k, `DAR-${1000 + p.refNo} · ${k + 1}/3`);
      const key = `media/${media.id}.jpg`;
      await storage.put(key, img, 'image/jpeg');
      await prisma.media.update({ where: { id: media.id }, data: { storageKey: key, sizeBytes: img.length } });
    }
    props.push({ id: p.id, refNo: p.refNo, listingType: l.listingType, ownerId: owners[l.owner].id, status: l.status, priceCents: l.priceUsd * 100, assignedEmployeeId: p.assignedEmployeeId });
  }

  // --- Viewing requests, leads, conversation --------------------------------
  const saleListing = props[0]!; // Saida seafront (owner1, emp1)
  const lead1 = await prisma.lead.create({
    data: { propertyId: saleListing.id, customerId: cust1.id, assignedEmployeeId: saleListing.assignedEmployeeId, status: 'VIEWING_SCHEDULED', source: 'VIEWING_REQUEST', openKey: `${saleListing.id}:${cust1.id}` },
  });
  const buyerFee = snapshotSaleTerms(settings, saleListing.priceCents).buyerCommissionCents;
  const scheduled = new Date(`${addDays(todayInBeirut(), 2)}T11:00:00+03:00`);
  await prisma.viewingRequest.create({
    data: {
      propertyId: saleListing.id, customerId: cust1.id, leadId: lead1.id, assignedEmployeeId: saleListing.assignedEmployeeId, status: 'CONFIRMED',
      preferredSlots: [{ date: addDays(todayInBeirut(), 2), period: 'MORNING' }], customerNotes: 'DEMO — رح إجي مع زوجي',
      scheduledAt: scheduled, scheduledEndsAt: new Date(scheduled.getTime() + 45 * 60_000), meetingInstructions: 'DEMO — meet at the building entrance',
      disclosedKind: 'SALE', disclosedAmountCents: BigInt(buyerFee), disclosedRateBps: 250, termsVersion: settings.termsVersion, settingsVersion: settings.version,
      acceptedAt: new Date(), idempotencyKey: randomUUID(),
    },
  });
  const conv = await prisma.conversation.create({ data: { customerId: cust1.id, leadId: lead1.id, propertyId: saleListing.id, assignedEmployeeId: saleListing.assignedEmployeeId, subject: `DAR-${1000 + saleListing.refNo}`, lastMessageAt: new Date() } });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, senderId: cust1.id, senderRole: 'CUSTOMER', body: 'مرحبا، بعد الشقة متوفرة؟ (DEMO)', clientMessageId: randomUUID() },
      { conversationId: conv.id, senderId: emp1.id, senderRole: 'STAFF', body: 'أهلا! إيه متوفرة. أكّدنا الزيارة يوم الخميس الساعة ١١. (DEMO)', clientMessageId: randomUUID() },
    ],
  });
  await prisma.internalNote.create({ data: { entityType: 'LEAD', entityId: lead1.id, authorId: emp1.id, body: 'DEMO internal note — customer pre-approved for a bank loan. Never visible to customers.' } });

  const rentListing = props[1]!; // Abra furnished (owner2)
  const lead2 = await prisma.lead.create({ data: { propertyId: rentListing.id, customerId: cust2.id, assignedEmployeeId: rentListing.assignedEmployeeId, status: 'ASSIGNED', source: 'VIEWING_REQUEST', openKey: `${rentListing.id}:${cust2.id}` } });
  await prisma.viewingRequest.create({
    data: {
      propertyId: rentListing.id, customerId: cust2.id, leadId: lead2.id, assignedEmployeeId: rentListing.assignedEmployeeId, status: 'REQUESTED',
      preferredSlots: [{ date: addDays(todayInBeirut(), 3), period: 'EVENING' }, { date: addDays(todayInBeirut(), 4), period: 'MORNING' }],
      disclosedKind: 'RENT', disclosedAmountCents: BigInt(rentListing.priceCents + settings.rental.monthlyFeeCents), termsVersion: settings.termsVersion,
      settingsVersion: settings.version, acceptedAt: new Date(), idempotencyKey: randomUUID(),
    },
  });

  // --- An active lease with history: Ketermaya apartment ($400 net + $50 fee) ---
  const leaseListing = props[6]!;
  const start = addMonthsAnchored(todayInBeirut().slice(0, 8) + '01', -3);
  const end = addDays(addMonthsAnchored(start, 12), -1);
  const snap = snapshotRentalTerms(settings, leaseListing.priceCents);
  const ag = await prisma.rentalAgreement.create({
    data: {
      propertyId: leaseListing.id, landlordId: leaseListing.ownerId, tenantId: cust2.id, assignedEmployeeId: emp1.id, status: 'ACTIVE', activeKey: leaseListing.id,
      startDate: d(start), endDate: d(end), dueDay: 5, proration: 'NONE', pricingMode: snap.mode, enteredAmountCents: BigInt(snap.enteredAmountCents),
      landlordNetCents: BigInt(snap.landlordNetCents), platformFeeCents: BigInt(snap.platformFeeCents), tenantTotalCents: BigInt(snap.tenantTotalCents),
      depositCents: 40000n, settingsVersion: snap.settingsVersion, termsVersion: snap.termsVersion, termsSnapshot: snap as any,
      landlordAcceptedAt: new Date(), landlordAcceptanceChannel: 'in_person_recorded_by_staff', tenantAcceptedAt: new Date(), tenantAcceptanceChannel: 'mobile',
      activatedAt: new Date(), activatedById: admin.id, createdById: admin.id, notes: 'DEMO lease — fictional',
    },
  });
  await prisma.property.update({ where: { id: leaseListing.id }, data: { status: 'RENTED', featured: false } });
  await prisma.depositEntry.create({ data: { agreementId: ag.id, kind: 'RECEIVED', amountCents: 40000n, method: 'CASH', occurredOn: d(start), recordedById: emp1.id, idempotencyKey: randomUUID(), notes: 'DEMO' } });
  const planned = planAllObligations({ startDate: start, endDate: end, dueDay: 5, proration: 'NONE', baseTerms: { landlordNetCents: snap.landlordNetCents, platformFeeCents: snap.platformFeeCents } }).filter(
    (p) => p.periodStart <= addDays(todayInBeirut(), 35),
  );
  const created: Awaited<ReturnType<typeof prisma.rentObligation.create>>[] = [];
  for (const p of planned) {
    created.push(
      await prisma.rentObligation.create({
        data: { agreementId: ag.id, periodIndex: p.periodIndex, periodStart: d(p.periodStart), periodEnd: d(p.periodEnd), dueDate: d(p.dueDate), landlordShareCents: BigInt(p.landlordShareCents), feeShareCents: BigInt(p.feeShareCents), totalCents: BigInt(p.totalCents) },
      }),
    );
  }
  // Months 1–2 fully paid, month 3 partially paid ($300 of $450); later months open.
  const payments: [number, number][] = [[0, 45000], [1, 45000], [2, 30000]];
  for (const [idx, amount] of payments) {
    const o = created[idx];
    if (!o) continue;
    const state = { landlordDueCents: Number(o.landlordShareCents), feeDueCents: Number(o.feeShareCents), dueDate: o.dueDate.toISOString().slice(0, 10), entries: [] as LedgerEntry[] };
    const alloc = planPaymentAllocation(state, amount, todayInBeirut());
    await prisma.rentLedgerEntry.create({
      data: { obligationId: o.id, kind: 'PAYMENT', landlordCents: BigInt(alloc.landlordCents), feeCents: BigInt(alloc.feeCents), amountCents: BigInt(amount), method: idx === 1 ? 'BANK_TRANSFER' : 'CASH', receivedOn: o.dueDate, reference: idx === 1 ? 'DEMO-TRX-1' : null, recordedById: emp1.id, idempotencyKey: randomUUID() },
    });
  }
  // Owner paid for month 1 only — month 2's collected rent is still owed to the owner.
  if (created[0]) {
    await prisma.ownerPayout.create({
      data: {
        ownerId: leaseListing.ownerId, kind: 'PAYOUT', totalCents: created[0].landlordShareCents, method: 'BANK_TRANSFER', paidOn: d(addDays(created[0].dueDate.toISOString().slice(0, 10), 3)),
        reference: 'DEMO-PAYOUT-1', recordedById: admin.id, idempotencyKey: randomUUID(), notes: 'DEMO',
        lines: { create: [{ obligationId: created[0].id, amountCents: created[0].landlordShareCents }] },
      },
    });
  }
  const check = computeObligationBalance(
    { landlordDueCents: 40000, feeDueCents: 5000, dueDate: '2000-01-01', entries: [{ id: 'x', kind: 'PAYMENT', landlordCents: 30000, feeCents: 0 }] },
    todayInBeirut(),
  );
  if (check.status !== 'PARTIALLY_PAID') throw new Error('seed sanity check failed');

  // --- A completed sale: Damour apartment, final price below asking ------------
  const soldListing = props[12]!;
  const finalPrice = 130_000_00;
  const saleSnap = snapshotSaleTerms(settings, finalPrice);
  const closing = await prisma.saleClosing.create({
    data: {
      propertyId: soldListing.id, sellerId: soldListing.ownerId, buyerId: cust1.id, assignedEmployeeId: soldListing.assignedEmployeeId, status: 'APPROVED', approvedKey: soldListing.id,
      finalPriceCents: BigInt(finalPrice), closingDate: d(addDays(todayInBeirut(), -10)), sellerBps: saleSnap.rules.sellerBps, buyerBps: saleSnap.rules.buyerBps,
      sellerCommissionCents: BigInt(saleSnap.sellerCommissionCents), buyerCommissionCents: BigInt(saleSnap.buyerCommissionCents), termsSnapshot: saleSnap as any,
      settingsVersion: saleSnap.settingsVersion, termsVersion: saleSnap.termsVersion, buyerAcceptedAt: new Date(), buyerAcceptanceChannel: 'in_person_recorded_by_staff',
      sellerAcceptedAt: new Date(), sellerAcceptanceChannel: 'in_person_recorded_by_staff', requestedById: emp1.id, approvedById: admin.id, approvedAt: new Date(), notes: 'DEMO sale',
    },
  });
  const seller = await prisma.saleObligation.create({ data: { closingId: closing.id, party: 'SELLER', amountDueCents: BigInt(saleSnap.sellerCommissionCents) } });
  await prisma.saleObligation.create({ data: { closingId: closing.id, party: 'BUYER', amountDueCents: BigInt(saleSnap.buyerCommissionCents) } });
  await prisma.saleLedgerEntry.create({ data: { obligationId: seller.id, kind: 'PAYMENT', amountCents: BigInt(saleSnap.sellerCommissionCents), method: 'BANK_TRANSFER', receivedOn: d(addDays(todayInBeirut(), -8)), reference: 'DEMO-SALE-1', recordedById: admin.id, idempotencyKey: randomUUID() } });
  await prisma.property.update({ where: { id: soldListing.id }, data: { status: 'SOLD', featured: false } });

  console.log(`demo: 7 users (password "${DEMO_PASSWORD}"), ${props.length} listings, 2 viewing requests, 1 active lease with ${created.length} obligations, 1 sale`);
}

async function main() {
  const locations = await seedBase();
  const wantDemo = (process.env.SEED_DEMO ?? 'true') === 'true';
  if (wantDemo && process.env.NODE_ENV === 'production') {
    console.log('demo: skipped in production');
  } else if (wantDemo) {
    await seedDemo(locations);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
