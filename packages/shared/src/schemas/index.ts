import { z } from 'zod';
import {
  AMENITY_KEYS,
  ListingType,
  PaymentMethod,
  PropertyType,
  ReportTarget,
} from '../domain/enums';
import { isISODate } from '../domain/dates';
import { MAX_CENTS } from '../domain/money';
import { normalizeLebanesePhone } from '../domain/phone';
import { RentalPricingMode } from '../domain/rental';
import { ProrationPolicy } from '../domain/schedule';

/**
 * Request validation shared by the API (authoritative) and the clients (for
 * immediate feedback). Error messages are machine codes translated client-side.
 */

const isoDate = z.string().refine(isISODate, 'DATE_INVALID');
const cents = z.number().int('MONEY_NOT_INTEGER_CENTS').min(0).max(MAX_CENTS);
const positiveCents = cents.refine((v) => v > 0, 'MONEY_REQUIRED');
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().max(max);

export const lebanesePhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeLebanesePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'PHONE_INVALID' });
      return z.NEVER;
    }
    return n;
  });

export const password = z
  .string()
  .min(10, 'PASSWORD_TOO_SHORT')
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'PASSWORD_WEAK');

// --- Auth -------------------------------------------------------------------

export const registerSchema = z.object({
  fullName: text(120).min(2, 'NAME_REQUIRED'),
  email: z.string().trim().toLowerCase().email('EMAIL_INVALID').max(254),
  password,
  phone: lebanesePhone,
  locale: z.enum(['ar', 'en']).default('ar'),
  acceptedTermsVersion: z.string().min(1, 'TERMS_REQUIRED'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('EMAIL_INVALID'),
  password: z.string().min(1).max(200),
  device: z.enum(['mobile', 'admin']).default('mobile'),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email('EMAIL_INVALID') });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(512), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const updateProfileSchema = z.object({
  fullName: text(120).min(2).optional(),
  phone: lebanesePhone.optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(255).regex(/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/, 'PUSH_TOKEN_INVALID'),
  platform: z.enum(['ios', 'android']),
});

export const deletionRequestSchema = z.object({ reason: text(500).optional(), confirm: z.literal(true) });

// --- Properties -------------------------------------------------------------

export const propertyDraftSchema = z.object({
  listingType: z.nativeEnum(ListingType).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  titleAr: text(120).optional(),
  titleEn: text(120).optional().nullable(),
  descriptionAr: text(4000).optional(),
  descriptionEn: text(4000).optional().nullable(),
  areaId: id.optional(),
  townId: id.optional(),
  neighborhoodId: id.optional().nullable(),
  exactAddress: text(300).optional(),
  latitude: z.number().min(33.0).max(34.8).optional().nullable(), // Lebanon bounding box
  longitude: z.number().min(35.0).max(36.7).optional().nullable(),
  priceCents: positiveCents.optional(),
  sizeSqm: z.number().int().min(1).max(1_000_000).optional().nullable(),
  bedrooms: z.number().int().min(0).max(30).optional().nullable(),
  bathrooms: z.number().int().min(0).max(30).optional().nullable(),
  floor: z.number().int().min(-5).max(100).optional().nullable(),
  totalFloors: z.number().int().min(1).max(150).optional().nullable(),
  furnished: z.boolean().optional().nullable(),
  amenities: z.array(z.enum(AMENITY_KEYS)).max(AMENITY_KEYS.length).optional(),
  otherAmenities: text(300).optional().nullable(),
  availableFrom: isoDate.optional().nullable(),
  ownerContactName: text(120).optional(),
  ownerContactPhone: lebanesePhone.optional(),
  ownerContactEmail: z.string().trim().email('EMAIL_INVALID').optional().nullable(),
  ownerNotesForStaff: text(1000).optional().nullable(),
});
export type PropertyDraftInput = z.infer<typeof propertyDraftSchema>;

export const listingSearchSchema = z.object({
  listingType: z.nativeEnum(ListingType).optional(),
  propertyType: z.array(z.nativeEnum(PropertyType)).or(z.nativeEnum(PropertyType).transform((v) => [v])).optional(),
  areaId: id.optional(),
  townId: id.optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  minSizeSqm: z.coerce.number().int().min(0).optional(),
  maxSizeSqm: z.coerce.number().int().min(0).optional(),
  minBedrooms: z.coerce.number().int().min(0).max(30).optional(),
  furnished: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  amenities: z.array(z.enum(AMENITY_KEYS)).or(z.enum(AMENITY_KEYS).transform((v) => [v])).optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  q: text(100).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'size_desc']).default('newest'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListingSearchInput = z.infer<typeof listingSearchSchema>;

export const uploadIntentSchema = z.object({
  kind: z.enum(['PHOTO', 'VIDEO', 'DOCUMENT', 'MESSAGE_ATTACHMENT']),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().min(1),
  fileName: text(200).min(1),
  propertyId: id.optional(),
  conversationId: id.optional(),
});

export const reorderMediaSchema = z.object({
  orderedIds: z.array(id).min(1).max(40),
  coverId: id.optional(),
});

export const moderationDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE'), assignedEmployeeId: id.optional(), featured: z.boolean().optional() }),
  z.object({ decision: z.literal('REJECT'), reason: text(1000).min(5, 'REASON_REQUIRED') }),
]);

export const mediaReviewSchema = z.object({
  mediaId: id,
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: text(500).optional(),
});

// --- Viewing requests, leads, messaging --------------------------------------

export const viewingRequestSchema = z.object({
  propertyId: id,
  preferredSlots: z
    .array(z.object({ date: isoDate, period: z.enum(['MORNING', 'AFTERNOON', 'EVENING']) }))
    .min(1, 'SLOT_REQUIRED')
    .max(3),
  customerNotes: text(1000).optional().nullable(),
  /** The fee disclosure the customer saw; must match the server's current terms. */
  acceptedTermsVersion: z.string().min(1, 'TERMS_REQUIRED'),
  acceptedFeeCents: cents,
  idempotencyKey: z.string().uuid(),
});

export const rescheduleViewingSchema = z.object({
  preferredSlots: viewingRequestSchema.shape.preferredSlots,
  customerNotes: text(1000).optional().nullable(),
});

export const confirmViewingSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240).default(45),
  meetingInstructions: text(1000).optional(),
});

export const viewingOutcomeSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW', 'CANCELLED']),
  notes: text(2000).optional(),
});

export const leadTransitionSchema = z.object({
  to: z.enum(['CONTACTED', 'VIEWING_SCHEDULED', 'VIEWED', 'NEGOTIATION', 'LOST']),
  reason: text(500).optional(),
});

export const leadAssignSchema = z.object({ employeeId: id, expectedVersion: z.number().int().min(0) });

export const offerSchema = z.object({
  amountCents: positiveCents,
  party: z.enum(['BUYER', 'TENANT', 'OWNER']),
  notes: text(1000).optional(),
});

export const internalNoteSchema = z.object({ body: text(4000).min(1) });

export const sendMessageSchema = z.object({
  body: text(4000).min(1, 'MESSAGE_EMPTY'),
  attachmentIds: z.array(id).max(5).default([]),
  clientMessageId: z.string().uuid(),
});

export const startConversationSchema = z.object({
  propertyId: id.optional(),
  subject: text(120).optional(),
  body: text(4000).min(1),
  clientMessageId: z.string().uuid(),
});

export const reportSchema = z.object({
  targetType: z.nativeEnum(ReportTarget),
  targetId: id,
  reason: z.enum(['CONTACT_INFO', 'MISLEADING', 'SCAM', 'OFFENSIVE', 'DUPLICATE', 'OTHER']),
  details: text(1000).optional(),
});

// --- Money ------------------------------------------------------------------

export const pricingSettingsSchema = z.object({
  saleBuyerBps: z.number().int().min(0).max(10_000),
  saleSellerBps: z.number().int().min(0).max(10_000),
  rentalMonthlyFeeCents: cents,
  rentalPricingMode: z.nativeEnum(RentalPricingMode),
  termsVersion: z.string().trim().min(1).max(40),
  changeReason: text(500).min(5, 'REASON_REQUIRED'),
});

export const saleClosingSchema = z.object({
  propertyId: id,
  leadId: id.optional(),
  buyerId: id,
  finalPriceCents: positiveCents,
  closingDate: isoDate,
  override: z
    .object({ sellerBps: z.number().int().min(0).max(10_000), buyerBps: z.number().int().min(0).max(10_000), reason: text(500).min(5) })
    .optional(),
  buyerAcceptance: z.object({ acceptedAt: z.string().datetime({ offset: true }), channel: z.enum(['mobile', 'in_person_recorded_by_staff']) }),
  sellerAcceptance: z.object({ acceptedAt: z.string().datetime({ offset: true }), channel: z.enum(['mobile', 'in_person_recorded_by_staff']) }),
  notes: text(2000).optional(),
});

export const rentalAgreementSchema = z
  .object({
    propertyId: id,
    tenantId: id,
    leadId: id.optional(),
    assignedEmployeeId: id,
    startDate: isoDate,
    endDate: isoDate,
    dueDay: z.number().int().min(1).max(31),
    proration: z.nativeEnum(ProrationPolicy).default('NONE'),
    pricingMode: z.nativeEnum(RentalPricingMode).optional(),
    enteredAmountCents: positiveCents,
    feeOverride: z.object({ monthlyFeeCents: cents, reason: text(500).min(5) }).optional(),
    depositCents: cents.default(0),
    renewedFromId: id.optional(),
    notes: text(2000).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'AGREEMENT_END_BEFORE_START', path: ['endDate'] });

export const agreementAcceptanceSchema = z.object({
  party: z.enum(['LANDLORD', 'TENANT']),
  acceptedAt: z.string().datetime({ offset: true }),
  channel: z.enum(['mobile', 'in_person_recorded_by_staff']),
});

export const amendmentSchema = z.object({
  effectiveFrom: isoDate,
  landlordNetCents: cents,
  platformFeeCents: cents,
  reason: text(500).min(5),
  landlordAcceptedAt: z.string().datetime({ offset: true }),
  tenantAcceptedAt: z.string().datetime({ offset: true }),
});

export const terminationSchema = z.object({ terminationDate: isoDate, reason: text(500).min(5) });

export const recordPaymentSchema = z.object({
  amountCents: positiveCents,
  method: z.nativeEnum(PaymentMethod),
  receivedOn: isoDate,
  reference: text(120).optional(),
  notes: text(500).optional(),
  idempotencyKey: z.string().uuid(),
});

export const reversalSchema = z.object({
  entryId: id,
  reason: text(500).min(5, 'REASON_REQUIRED'),
  idempotencyKey: z.string().uuid(),
});

export const refundSchema = z.object({
  amountCents: positiveCents,
  method: z.nativeEnum(PaymentMethod),
  paidOn: isoDate,
  reference: text(120).optional(),
  reason: text(500).min(5, 'REASON_REQUIRED'),
  idempotencyKey: z.string().uuid(),
});

export const waiveSchema = z.object({ reason: text(500).min(5, 'REASON_REQUIRED') });

export const recordPayoutSchema = z.object({
  ownerId: id,
  obligationIds: z.array(id).min(1).max(200),
  method: z.nativeEnum(PaymentMethod),
  paidOn: isoDate,
  reference: text(120).min(1, 'REFERENCE_REQUIRED'),
  notes: text(500).optional(),
  idempotencyKey: z.string().uuid(),
});

export const salePaymentSchema = z.object({
  party: z.enum(['BUYER', 'SELLER']),
  kind: z.enum(['PAYMENT', 'REFUND']),
  amountCents: positiveCents,
  method: z.nativeEnum(PaymentMethod),
  receivedOn: isoDate,
  reference: text(120).optional(),
  reason: text(500).optional(),
  idempotencyKey: z.string().uuid(),
});

// --- Admin -------------------------------------------------------------------

export const locationSchema = z.object({
  kind: z.enum(['AREA', 'TOWN', 'NEIGHBORHOOD']),
  nameAr: text(80).min(2),
  nameEn: text(80).min(2),
  parentId: id.optional().nullable(),
  lat: z.number().min(33.0).max(34.8).optional().nullable(),
  lng: z.number().min(35.0).max(36.7).optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const userRoleUpdateSchema = z.object({
  roles: z.array(z.enum(['CUSTOMER', 'OWNER', 'EMPLOYEE', 'ADMIN'])).min(1),
  canRecordCollections: z.boolean().optional(),
  blocked: z.boolean().optional(),
  reason: text(500).min(5, 'REASON_REQUIRED'),
});

export const notificationTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.]+$/),
  titleAr: text(120).min(1),
  titleEn: text(120).min(1),
  bodyAr: text(500).min(1),
  bodyEn: text(500).min(1),
  active: z.boolean().default(true),
});

export const reminderSettingsSchema = z.object({
  daysBeforeDue: z.array(z.number().int().min(0).max(30)).max(5),
  daysAfterDue: z.array(z.number().int().min(1).max(60)).max(5),
});
