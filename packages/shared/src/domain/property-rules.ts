import { AMENITY_KEYS, ListingType, PropertyType } from './enums';

/**
 * Which fields apply to which property type. Land has no bedrooms or floors;
 * commercial units have no bedrooms. Fields that do not apply are cleared, and
 * required fields are checked before a listing can be submitted for review.
 */
export type PropertyField =
  | 'bedrooms'
  | 'bathrooms'
  | 'floor'
  | 'totalFloors'
  | 'furnished'
  | 'sizeSqm';

export const FIELD_APPLICABILITY: Record<PropertyType, { applicable: PropertyField[]; required: PropertyField[] }> = {
  APARTMENT: {
    applicable: ['bedrooms', 'bathrooms', 'floor', 'totalFloors', 'furnished', 'sizeSqm'],
    required: ['bedrooms', 'bathrooms', 'floor', 'sizeSqm'],
  },
  HOUSE_VILLA: {
    applicable: ['bedrooms', 'bathrooms', 'totalFloors', 'furnished', 'sizeSqm'],
    required: ['bedrooms', 'bathrooms', 'sizeSqm'],
  },
  LAND: { applicable: ['sizeSqm'], required: ['sizeSqm'] },
  COMMERCIAL: {
    applicable: ['bathrooms', 'floor', 'totalFloors', 'furnished', 'sizeSqm'],
    required: ['sizeSqm'],
  },
};

export const AMENITIES_BY_TYPE: Record<PropertyType, readonly string[]> = {
  APARTMENT: AMENITY_KEYS,
  HOUSE_VILLA: AMENITY_KEYS.filter((a) => a !== 'concierge'),
  LAND: ['sea_view', 'mountain_view', 'water_well', 'state_electricity'],
  COMMERCIAL: AMENITY_KEYS.filter((a) => !['pets_allowed', 'garden', 'pool'].includes(a)),
};

export interface PropertyDraftShape {
  listingType?: ListingType | null;
  propertyType?: PropertyType | null;
  titleAr?: string | null;
  descriptionAr?: string | null;
  areaId?: string | null;
  townId?: string | null;
  exactAddress?: string | null;
  priceCents?: number | null;
  sizeSqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  furnished?: boolean | null;
  amenities?: readonly string[] | null;
  ownerContactPhone?: string | null;
  photoCount?: number;
  hasCover?: boolean;
}

/** Clears fields that don't apply to the property type (e.g. bedrooms on land). */
export function sanitizeForType<T extends PropertyDraftShape>(draft: T): T {
  if (!draft.propertyType) return draft;
  const rules = FIELD_APPLICABILITY[draft.propertyType];
  const out: any = { ...draft };
  for (const f of ['bedrooms', 'bathrooms', 'floor', 'totalFloors', 'furnished'] as PropertyField[]) {
    if (!rules.applicable.includes(f)) out[f] = null;
  }
  if (out.amenities) out.amenities = out.amenities.filter((a: string) => AMENITIES_BY_TYPE[draft.propertyType!].includes(a));
  return out;
}

export const MIN_PHOTOS_FOR_SUBMISSION = 3;

/** Returns machine codes for what is missing before submission for review. */
export function missingForSubmission(d: PropertyDraftShape): string[] {
  const missing: string[] = [];
  if (!d.listingType) missing.push('listingType');
  if (!d.propertyType) missing.push('propertyType');
  if (!d.titleAr || d.titleAr.trim().length < 5) missing.push('titleAr');
  if (!d.descriptionAr || d.descriptionAr.trim().length < 20) missing.push('descriptionAr');
  if (!d.areaId) missing.push('areaId');
  if (!d.townId) missing.push('townId');
  if (!d.exactAddress || d.exactAddress.trim().length < 5) missing.push('exactAddress');
  if (!d.priceCents || d.priceCents <= 0) missing.push('priceCents');
  if (!d.ownerContactPhone) missing.push('ownerContactPhone');
  if ((d.photoCount ?? 0) < MIN_PHOTOS_FOR_SUBMISSION) missing.push('photos');
  if (!d.hasCover) missing.push('coverPhoto');
  if (d.propertyType) {
    for (const f of FIELD_APPLICABILITY[d.propertyType].required) {
      const v = (d as any)[f];
      if (v === null || v === undefined || (typeof v === 'number' && v < 0)) missing.push(f);
    }
  }
  return missing;
}

/**
 * Editing a PUBLISHED listing: changes to these fields need re-review and are
 * held as a pending revision (the approved version stays public meanwhile).
 */
export const SENSITIVE_FIELDS = [
  'listingType',
  'propertyType',
  'titleAr',
  'titleEn',
  'descriptionAr',
  'descriptionEn',
  'priceCents',
  'areaId',
  'townId',
  'neighborhoodId',
  'sizeSqm',
  'bedrooms',
  'bathrooms',
  'floor',
  'totalFloors',
] as const;

export function splitEdit(changes: Record<string, unknown>) {
  const sensitive: Record<string, unknown> = {};
  const direct: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) continue;
    if ((SENSITIVE_FIELDS as readonly string[]).includes(k)) sensitive[k] = v;
    else direct[k] = v;
  }
  return { sensitive, direct, needsReview: Object.keys(sensitive).length > 0 };
}

/** Upload limits enforced on the server (clients mirror them for UX). */
export const UPLOAD_LIMITS = {
  PHOTO: { maxBytes: 15 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], maxCount: 30 },
  VIDEO: { maxBytes: 200 * 1024 * 1024, mime: ['video/mp4', 'video/quicktime'], maxCount: 1 },
  DOCUMENT: { maxBytes: 20 * 1024 * 1024, mime: ['application/pdf', 'image/jpeg', 'image/png'], maxCount: 10 },
  MESSAGE_ATTACHMENT: { maxBytes: 10 * 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxCount: 5 },
} as const;
