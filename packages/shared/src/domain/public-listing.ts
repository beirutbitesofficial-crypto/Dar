import { customerSaleEstimate, SaleFeeRules } from './commission';
import { AmenityKey, ListingType, PropertyType } from './enums';
import { DomainError } from './errors';
import { Cents } from './money';
import { computeRentalBreakdown, RentalFeeRules, RentalPricingMode } from './rental';
import { isPubliclyVisible } from './status';

/**
 * Public listing serializer — an explicit ALLOWLIST. A field reaches a visitor
 * only if it is copied here. Owner identity/contact, exact address, precise
 * coordinates, private documents, internal notes and moderation data are
 * never copied. `assertNoPrivateFields` runs on every public response as a
 * second line of defence.
 */
export interface PropertyForPublic {
  id: string;
  publicRef: string;
  status: any;
  approvedAt: Date | string | null;
  listingType: ListingType;
  propertyType: PropertyType;
  titleAr: string;
  titleEn: string | null;
  descriptionAr: string;
  descriptionEn: string | null;
  areaId: string;
  townId: string;
  neighborhoodId: string | null;
  priceCents: Cents;
  rentPricingMode: RentalPricingMode | null;
  sizeSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  furnished: boolean | null;
  amenities: readonly string[];
  availableFrom: string | null;
  featured: boolean;
  publishedAt: Date | string | null;
  demo: boolean;
}

export interface LocationNames {
  area: { id: string; nameAr: string; nameEn: string };
  town: { id: string; nameAr: string; nameEn: string; lat: number | null; lng: number | null };
  neighborhood?: { id: string; nameAr: string; nameEn: string } | null;
}

export interface PublicPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  isCover: boolean;
}

export interface PublicListing {
  id: string;
  ref: string;
  listingType: ListingType;
  propertyType: PropertyType;
  title: { ar: string; en: string | null };
  description: { ar: string; en: string | null };
  location: {
    areaId: string;
    areaName: { ar: string; en: string };
    townId: string;
    townName: { ar: string; en: string };
    neighborhoodName: { ar: string; en: string } | null;
    /** Town-level approximate point, never the property pin. */
    approximate: { lat: number; lng: number } | null;
  };
  pricing:
    | { kind: 'SALE'; askingPriceCents: Cents; buyerCommissionCents: Cents; buyerTotalCents: Cents; buyerBps: number }
    | { kind: 'RENT'; tenantMonthlyTotalCents: Cents; includesMonthlyFeeCents: Cents };
  specs: {
    sizeSqm: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    floor: number | null;
    totalFloors: number | null;
    furnished: boolean | null;
  };
  amenities: AmenityKey[];
  availableFrom: string | null;
  featured: boolean;
  publishedAt: string | null;
  photos: PublicPhoto[];
  demo: boolean;
}

/**
 * Deterministic small offset (≈ ±350 m) derived from the listing id, applied to
 * the TOWN centroid so map pins don't stack. Derived from the id, never from
 * the property's real coordinates.
 */
export function approximatePoint(townLat: number, townLng: number, listingId: string) {
  let h = 2166136261;
  for (let i = 0; i < listingId.length; i++) {
    h ^= listingId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000 - 0.5;
  const b = (((h >>> 10) >>> 0) % 1000) / 1000 - 0.5;
  return { lat: round5(townLat + a * 0.007), lng: round5(townLng + b * 0.007) };
}
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function toPublicListing(
  p: PropertyForPublic,
  loc: LocationNames,
  photos: readonly PublicPhoto[],
  fees: { sale: SaleFeeRules; rental: RentalFeeRules },
): PublicListing {
  if (!isPubliclyVisible(p)) throw new DomainError('LISTING_NOT_PUBLIC');
  const pricing: PublicListing['pricing'] =
    p.listingType === ListingType.SALE
      ? (() => {
          const e = customerSaleEstimate(p.priceCents, fees.sale);
          return {
            kind: 'SALE' as const,
            askingPriceCents: e.askingPriceCents,
            buyerCommissionCents: e.buyerCommissionCents,
            buyerTotalCents: e.buyerTotalCents,
            buyerBps: e.buyerBps,
          };
        })()
      : (() => {
          const b = computeRentalBreakdown(p.priceCents, {
            mode: p.rentPricingMode ?? fees.rental.mode,
            monthlyFeeCents: fees.rental.monthlyFeeCents,
          });
          return { kind: 'RENT' as const, tenantMonthlyTotalCents: b.tenantTotalCents, includesMonthlyFeeCents: b.platformFeeCents };
        })();

  const out: PublicListing = {
    id: p.id,
    ref: p.publicRef,
    listingType: p.listingType,
    propertyType: p.propertyType,
    title: { ar: p.titleAr, en: p.titleEn },
    description: { ar: p.descriptionAr, en: p.descriptionEn },
    location: {
      areaId: loc.area.id,
      areaName: { ar: loc.area.nameAr, en: loc.area.nameEn },
      townId: loc.town.id,
      townName: { ar: loc.town.nameAr, en: loc.town.nameEn },
      neighborhoodName: loc.neighborhood ? { ar: loc.neighborhood.nameAr, en: loc.neighborhood.nameEn } : null,
      approximate:
        loc.town.lat != null && loc.town.lng != null ? approximatePoint(loc.town.lat, loc.town.lng, p.id) : null,
    },
    pricing,
    specs: {
      sizeSqm: p.sizeSqm,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      totalFloors: p.totalFloors,
      furnished: p.furnished,
    },
    amenities: [...p.amenities] as AmenityKey[],
    availableFrom: p.availableFrom,
    featured: p.featured,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    photos: photos.map((ph) => ({ id: ph.id, url: ph.url, width: ph.width, height: ph.height, isCover: ph.isCover })),
    demo: p.demo,
  };
  assertNoPrivateFields(out);
  return out;
}

/** Keys that must never appear anywhere in a public payload. */
export const FORBIDDEN_PUBLIC_KEYS = new Set([
  'ownerId',
  'owner',
  'ownerPhone',
  'ownerEmail',
  'ownerName',
  'contactPhone',
  'contactEmail',
  'contactName',
  'whatsapp',
  'phone',
  'email',
  'exactAddress',
  'address',
  'latitude',
  'longitude',
  'exactLat',
  'exactLng',
  'documents',
  'privateDocuments',
  'storageKey',
  'internalNotes',
  'notes',
  'moderation',
  'contactFlags',
  'assignedEmployeeId',
  'passwordHash',
]);

export function assertNoPrivateFields(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoPrivateFields(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PUBLIC_KEYS.has(k)) {
        throw new DomainError('PRIVATE_FIELD_IN_PUBLIC_RESPONSE', `Private field "${path}.${k}" in public response`);
      }
      assertNoPrivateFields(v, `${path}.${k}`);
    }
  }
}
