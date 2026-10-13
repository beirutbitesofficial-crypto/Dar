/** Values mirror the Prisma enums in apps/api/prisma/schema.prisma. */

export const Role = {
  CUSTOMER: 'CUSTOMER',
  OWNER: 'OWNER',
  EMPLOYEE: 'EMPLOYEE',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ListingType = { SALE: 'SALE', RENT: 'RENT' } as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const PropertyType = {
  APARTMENT: 'APARTMENT',
  HOUSE_VILLA: 'HOUSE_VILLA',
  LAND: 'LAND',
  COMMERCIAL: 'COMMERCIAL',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const ListingStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  RENTED: 'RENTED',
  SOLD: 'SOLD',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const LeadStatus = {
  NEW: 'NEW',
  ASSIGNED: 'ASSIGNED',
  CONTACTED: 'CONTACTED',
  VIEWING_SCHEDULED: 'VIEWING_SCHEDULED',
  VIEWED: 'VIEWED',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const ViewingStatus = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type ViewingStatus = (typeof ViewingStatus)[keyof typeof ViewingStatus];

export const AgreementStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  TERMINATED: 'TERMINATED',
  CANCELLED: 'CANCELLED',
} as const;
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];

export const SaleClosingStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
} as const;
export type SaleClosingStatus = (typeof SaleClosingStatus)[keyof typeof SaleClosingStatus];

export const PaymentMethod = { CASH: 'CASH', BANK_TRANSFER: 'BANK_TRANSFER', OTHER: 'OTHER' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const MediaKind = { PHOTO: 'PHOTO', VIDEO: 'VIDEO', DOCUMENT: 'DOCUMENT' } as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const MediaReviewStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type MediaReviewStatus = (typeof MediaReviewStatus)[keyof typeof MediaReviewStatus];

export const ReportTarget = { LISTING: 'LISTING', MESSAGE: 'MESSAGE', USER: 'USER' } as const;
export type ReportTarget = (typeof ReportTarget)[keyof typeof ReportTarget];

export const AMENITY_KEYS = [
  'parking',
  'elevator',
  'balcony',
  'terrace',
  'sea_view',
  'mountain_view',
  'generator',
  'solar_power',
  'state_electricity',
  'water_well',
  'water_tank',
  'central_heating',
  'air_conditioning',
  'storage',
  'garden',
  'pool',
  'concierge',
  'pets_allowed',
] as const;
export type AmenityKey = (typeof AMENITY_KEYS)[number];
