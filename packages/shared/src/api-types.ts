import type {
  AgreementStatus,
  LeadStatus,
  ListingStatus,
  ListingType,
  PaymentMethod,
  PropertyType,
  Role,
  ViewingStatus,
} from './domain/enums';
import type { PublicListing } from './domain/public-listing';
import type { RentObligationStatus } from './domain/ledger';
import type { RentalPricingMode } from './domain/rental';
import type { SaleObligationStatus } from './domain/commission';

/** Response shapes shared by the API, admin dashboard and mobile app. */

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface Me {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  roles: Role[];
  locale: 'ar' | 'en';
  canRecordCollections: boolean;
  deletionRequestedAt: string | null;
}

export interface LocationNode {
  id: string;
  kind: 'AREA' | 'TOWN' | 'NEIGHBORHOOD';
  nameAr: string;
  nameEn: string;
  parentId: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
  sortOrder: number;
}

export type { PublicListing };

export interface PublicSettings {
  saleBuyerBps: number;
  saleSellerBps: number;
  rentalMonthlyFeeCents: number;
  rentalPricingMode: RentalPricingMode;
  termsVersion: string;
  /** Placeholder legal text flagged for local legal review before launch. */
  legalReviewPending: boolean;
}

export interface OwnerListingSummary {
  id: string;
  ref: string;
  status: ListingStatus;
  listingType: ListingType;
  propertyType: PropertyType;
  titleAr: string;
  priceCents: number;
  rejectionReason: string | null;
  hasPendingRevision: boolean;
  coverUrl: string | null;
  viewingCount: number;
  updatedAt: string;
}

/** What an owner sees about viewings — never the customer's identity or contact. */
export interface OwnerViewingActivity {
  id: string;
  status: ViewingStatus;
  scheduledAt: string | null;
  createdAt: string;
}

export interface ViewingRequestDto {
  id: string;
  propertyId: string;
  propertyRef: string;
  propertyTitle: { ar: string; en: string | null };
  status: ViewingStatus;
  preferredSlots: { date: string; period: 'MORNING' | 'AFTERNOON' | 'EVENING' }[];
  scheduledAt: string | null;
  customerNotes: string | null;
  disclosedFee: { kind: 'SALE' | 'RENT'; amountCents: number; termsVersion: string };
  assignedEmployeeName: string | null;
  conversationId: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  subject: string;
  propertyRef: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  staffName: string | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  senderName: string;
  body: string;
  attachments: { id: string; fileName: string; mimeType: string; url: string }[];
  createdAt: string;
}

export interface LeadDto {
  id: string;
  status: LeadStatus;
  propertyId: string;
  propertyRef: string;
  customerName: string;
  customerPhone: string | null;
  assignedEmployeeId: string | null;
  lostReason: string | null;
  createdAt: string;
}

export interface RentObligationDto {
  id: string;
  agreementId: string;
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  landlordShareCents: number;
  feeShareCents: number;
  totalCents: number;
  collectedCents: number;
  remainingCents: number;
  status: RentObligationStatus;
}

export interface AgreementDto {
  id: string;
  ref: string;
  status: AgreementStatus;
  propertyRef: string;
  startDate: string;
  endDate: string;
  dueDay: number;
  pricingMode: RentalPricingMode;
  landlordNetCents: number;
  platformFeeCents: number;
  tenantTotalCents: number;
  depositCents: number;
  termsVersion: string;
}

export interface OwnerStatementLine {
  obligationId: string;
  period: string;
  agreedNetRentCents: number;
  collectedForOwnerCents: number;
  paidOutCents: number;
  payableCents: number;
  payouts: { date: string; reference: string; amountCents: number }[];
}

export interface SaleObligationDto {
  party: 'BUYER' | 'SELLER';
  amountDueCents: number;
  collectedCents: number;
  status: SaleObligationStatus;
}

export interface PaymentRecordInput {
  amountCents: number;
  method: PaymentMethod;
  receivedOn: string;
  reference?: string;
  idempotencyKey: string;
}

export interface DashboardOverview {
  listings: Record<ListingStatus, number>;
  leads: Record<LeadStatus, number>;
  viewingsNext7Days: number;
  activeRentals: number;
  salesClosedThisMonth: number;
  money: {
    moneyCollectedCents: number;
    brokerageRevenueEarnedCents: number;
    brokerageFeesUnpaidCents: number;
    rentOwedToLandlordsCents: number;
    landlordPayoutsCents: number;
  };
  overdueObligations: number;
}
