-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'OWNER', 'EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE_VILLA', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'PAUSED', 'RENTED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RentalPricingMode" AS ENUM ('NET_PLUS_FEE', 'TOTAL_MINUS_FEE');

-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('AREA', 'TOWN', 'NEIGHBORHOOD');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT', 'MESSAGE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'VIEWING_SCHEDULED', 'VIEWED', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('VIEWING_REQUEST', 'MESSAGE', 'STAFF');

-- CreateEnum
CREATE TYPE "ViewingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SenderRole" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('LISTING', 'MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NoteEntity" AS ENUM ('LEAD', 'PROPERTY', 'CONVERSATION', 'AGREEMENT', 'USER', 'CLOSING');

-- CreateEnum
CREATE TYPE "SaleClosingStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleParty" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('PAYMENT', 'REVERSAL', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProrationPolicy" AS ENUM ('NONE', 'DAILY');

-- CreateEnum
CREATE TYPE "AcceptanceChannel" AS ENUM ('mobile', 'admin', 'in_person_recorded_by_staff');

-- CreateEnum
CREATE TYPE "DepositEntryKind" AS ENUM ('RECEIVED', 'RETURNED', 'APPLIED_TO_DAMAGES');

-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('PAYOUT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PushStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'SENT', 'FAILED', 'UNCONFIGURED');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LegalKind" AS ENUM ('TERMS', 'PRIVACY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "roles" "Role"[] DEFAULT ARRAY['CUSTOMER']::"Role"[],
    "canRecordCollections" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "termsAcceptedVersion" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "userAgent" TEXT,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "notes" TEXT,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "kind" "LocationKind" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "appliesTo" "PropertyType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "refNo" SERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "listingType" "ListingType",
    "propertyType" "PropertyType",
    "titleAr" TEXT,
    "titleEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "areaId" TEXT,
    "townId" TEXT,
    "neighborhoodId" TEXT,
    "exactAddress" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "ownerContactName" TEXT,
    "ownerContactPhone" TEXT,
    "ownerContactEmail" TEXT,
    "ownerNotesForStaff" TEXT,
    "contactFlags" JSONB,
    "priceCents" BIGINT,
    "rentPricingMode" "RentalPricingMode",
    "sizeSqm" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floor" INTEGER,
    "totalFloors" INTEGER,
    "furnished" BOOLEAN,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "otherAmenities" TEXT,
    "availableFrom" DATE,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredRank" INTEGER NOT NULL DEFAULT 0,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyRevision" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "contactFlags" JSONB,
    "status" "RevisionStatus" NOT NULL DEFAULT 'PENDING',
    "pendingKey" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewedById" TEXT,
    "uploaderId" TEXT NOT NULL,
    "propertyId" TEXT,
    "messageId" TEXT,
    "incomingKey" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "failureCode" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","propertyId")
);

-- CreateTable
CREATE TABLE "ViewingRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "leadId" TEXT,
    "assignedEmployeeId" TEXT,
    "status" "ViewingStatus" NOT NULL DEFAULT 'REQUESTED',
    "preferredSlots" JSONB NOT NULL,
    "customerNotes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "scheduledEndsAt" TIMESTAMP(3),
    "meetingInstructions" TEXT,
    "outcomeNotes" TEXT,
    "cancelledReason" TEXT,
    "disclosedKind" "ListingType" NOT NULL,
    "disclosedAmountCents" BIGINT NOT NULL,
    "disclosedRateBps" INTEGER,
    "termsVersion" TEXT NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL,
    "lostReason" TEXT,
    "openKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "wonAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromStatus" "LeadStatus",
    "toStatus" "LeadStatus",
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "party" TEXT NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "entityType" "NoteEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "propertyId" TEXT,
    "leadId" TEXT,
    "subject" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "SenderRole" NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRead" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "saleBuyerBps" INTEGER NOT NULL,
    "saleSellerBps" INTEGER NOT NULL,
    "rentalMonthlyFeeCents" BIGINT NOT NULL,
    "rentalPricingMode" "RentalPricingMode" NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "kind" "LegalKind" NOT NULL,
    "version" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "legalReviewPending" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SaleClosing" (
    "id" TEXT NOT NULL,
    "refNo" SERIAL NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leadId" TEXT,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "status" "SaleClosingStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedKey" TEXT,
    "finalPriceCents" BIGINT NOT NULL,
    "closingDate" DATE NOT NULL,
    "sellerBps" INTEGER NOT NULL,
    "buyerBps" INTEGER NOT NULL,
    "sellerCommissionCents" BIGINT NOT NULL,
    "buyerCommissionCents" BIGINT NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "overrideReason" TEXT,
    "buyerAcceptedAt" TIMESTAMP(3) NOT NULL,
    "buyerAcceptanceChannel" "AcceptanceChannel" NOT NULL,
    "sellerAcceptedAt" TIMESTAMP(3) NOT NULL,
    "sellerAcceptanceChannel" "AcceptanceChannel" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleObligation" (
    "id" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "party" "SaleParty" NOT NULL,
    "amountDueCents" BIGINT NOT NULL,
    "waivedAt" TIMESTAMP(3),
    "waivedById" TEXT,
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLedgerEntry" (
    "id" TEXT NOT NULL,
    "receiptNo" SERIAL NOT NULL,
    "obligationId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "receivedOn" DATE NOT NULL,
    "reference" TEXT,
    "reason" TEXT,
    "reversesEntryId" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalAgreement" (
    "id" TEXT NOT NULL,
    "refNo" SERIAL NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assignedEmployeeId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "activeKey" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "proration" "ProrationPolicy" NOT NULL DEFAULT 'NONE',
    "pricingMode" "RentalPricingMode" NOT NULL,
    "enteredAmountCents" BIGINT NOT NULL,
    "landlordNetCents" BIGINT NOT NULL,
    "platformFeeCents" BIGINT NOT NULL,
    "tenantTotalCents" BIGINT NOT NULL,
    "depositCents" BIGINT NOT NULL DEFAULT 0,
    "settingsVersion" INTEGER NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "feeOverrideApprovedById" TEXT,
    "feeOverrideReason" TEXT,
    "landlordAcceptedAt" TIMESTAMP(3),
    "landlordAcceptanceChannel" "AcceptanceChannel",
    "tenantAcceptedAt" TIMESTAMP(3),
    "tenantAcceptanceChannel" "AcceptanceChannel",
    "signedDocumentMediaId" TEXT,
    "terminationDate" DATE,
    "terminationReason" TEXT,
    "renewedFromId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementAmendment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "landlordNetCents" BIGINT NOT NULL,
    "platformFeeCents" BIGINT NOT NULL,
    "tenantTotalCents" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "landlordAcceptedAt" TIMESTAMP(3) NOT NULL,
    "tenantAcceptedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositEntry" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "kind" "DepositEntryKind" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "occurredOn" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentObligation" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "landlordShareCents" BIGINT NOT NULL,
    "feeShareCents" BIGINT NOT NULL,
    "totalCents" BIGINT NOT NULL,
    "prorated" BOOLEAN NOT NULL DEFAULT false,
    "amendmentId" TEXT,
    "originalLandlordShareCents" BIGINT,
    "originalFeeShareCents" BIGINT,
    "adjustedReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waivedById" TEXT,
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentLedgerEntry" (
    "id" TEXT NOT NULL,
    "receiptNo" SERIAL NOT NULL,
    "obligationId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "landlordCents" BIGINT NOT NULL,
    "feeCents" BIGINT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "receivedOn" DATE NOT NULL,
    "reference" TEXT,
    "reason" TEXT,
    "reversesEntryId" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerPayout" (
    "id" TEXT NOT NULL,
    "refNo" SERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "PayoutKind" NOT NULL DEFAULT 'PAYOUT',
    "totalCents" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidOn" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "notes" TEXT,
    "reversesPayoutId" TEXT,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerPayoutLine" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,

    CONSTRAINT "OwnerPayoutLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderSend" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "key" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "pushStatus" "PushStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "pushError" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "key" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "result" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roles_idx" ON "User"("roles");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_status_idx" ON "AccountDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE INDEX "Location_kind_active_idx" ON "Location"("kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Property_refNo_key" ON "Property"("refNo");

-- CreateIndex
CREATE INDEX "Property_status_listingType_areaId_idx" ON "Property"("status", "listingType", "areaId");

-- CreateIndex
CREATE INDEX "Property_status_townId_idx" ON "Property"("status", "townId");

-- CreateIndex
CREATE INDEX "Property_status_featured_featuredRank_idx" ON "Property"("status", "featured", "featuredRank");

-- CreateIndex
CREATE INDEX "Property_status_publishedAt_idx" ON "Property"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Property_priceCents_idx" ON "Property"("priceCents");

-- CreateIndex
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

-- CreateIndex
CREATE INDEX "Property_assignedEmployeeId_idx" ON "Property"("assignedEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyRevision_pendingKey_key" ON "PropertyRevision"("pendingKey");

-- CreateIndex
CREATE INDEX "PropertyRevision_propertyId_idx" ON "PropertyRevision"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyRevision_status_idx" ON "PropertyRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Media_incomingKey_key" ON "Media"("incomingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Media_propertyId_kind_sortOrder_idx" ON "Media"("propertyId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "Media_reviewStatus_idx" ON "Media"("reviewStatus");

-- CreateIndex
CREATE INDEX "Media_messageId_idx" ON "Media"("messageId");

-- CreateIndex
CREATE INDEX "Favorite_propertyId_idx" ON "Favorite"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewingRequest_idempotencyKey_key" ON "ViewingRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ViewingRequest_customerId_idx" ON "ViewingRequest"("customerId");

-- CreateIndex
CREATE INDEX "ViewingRequest_propertyId_idx" ON "ViewingRequest"("propertyId");

-- CreateIndex
CREATE INDEX "ViewingRequest_assignedEmployeeId_scheduledAt_idx" ON "ViewingRequest"("assignedEmployeeId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ViewingRequest_status_idx" ON "ViewingRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_openKey_key" ON "Lead"("openKey");

-- CreateIndex
CREATE INDEX "Lead_assignedEmployeeId_status_idx" ON "Lead"("assignedEmployeeId", "status");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_propertyId_idx" ON "Lead"("propertyId");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_leadId_idx" ON "Offer"("leadId");

-- CreateIndex
CREATE INDEX "InternalNote_entityType_entityId_createdAt_idx" ON "InternalNote"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_customerId_lastMessageAt_idx" ON "Conversation"("customerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_assignedEmployeeId_lastMessageAt_idx" ON "Conversation"("assignedEmployeeId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingSettings_version_key" ON "PricingSettings"("version");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_kind_version_key" ON "LegalDocument"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SaleClosing_refNo_key" ON "SaleClosing"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "SaleClosing_approvedKey_key" ON "SaleClosing"("approvedKey");

-- CreateIndex
CREATE INDEX "SaleClosing_status_idx" ON "SaleClosing"("status");

-- CreateIndex
CREATE INDEX "SaleClosing_propertyId_idx" ON "SaleClosing"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleObligation_closingId_party_key" ON "SaleObligation"("closingId", "party");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLedgerEntry_receiptNo_key" ON "SaleLedgerEntry"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLedgerEntry_reversesEntryId_key" ON "SaleLedgerEntry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLedgerEntry_idempotencyKey_key" ON "SaleLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SaleLedgerEntry_obligationId_idx" ON "SaleLedgerEntry"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAgreement_refNo_key" ON "RentalAgreement"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAgreement_activeKey_key" ON "RentalAgreement"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAgreement_renewedFromId_key" ON "RentalAgreement"("renewedFromId");

-- CreateIndex
CREATE INDEX "RentalAgreement_status_idx" ON "RentalAgreement"("status");

-- CreateIndex
CREATE INDEX "RentalAgreement_landlordId_idx" ON "RentalAgreement"("landlordId");

-- CreateIndex
CREATE INDEX "RentalAgreement_tenantId_idx" ON "RentalAgreement"("tenantId");

-- CreateIndex
CREATE INDEX "RentalAgreement_assignedEmployeeId_idx" ON "RentalAgreement"("assignedEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementAmendment_agreementId_effectiveFrom_key" ON "AgreementAmendment"("agreementId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DepositEntry_idempotencyKey_key" ON "DepositEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DepositEntry_agreementId_idx" ON "DepositEntry"("agreementId");

-- CreateIndex
CREATE INDEX "RentObligation_dueDate_idx" ON "RentObligation"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RentObligation_agreementId_periodIndex_key" ON "RentObligation"("agreementId", "periodIndex");

-- CreateIndex
CREATE UNIQUE INDEX "RentLedgerEntry_receiptNo_key" ON "RentLedgerEntry"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "RentLedgerEntry_reversesEntryId_key" ON "RentLedgerEntry"("reversesEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RentLedgerEntry_idempotencyKey_key" ON "RentLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RentLedgerEntry_obligationId_idx" ON "RentLedgerEntry"("obligationId");

-- CreateIndex
CREATE INDEX "RentLedgerEntry_receivedOn_idx" ON "RentLedgerEntry"("receivedOn");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayout_refNo_key" ON "OwnerPayout"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayout_reversesPayoutId_key" ON "OwnerPayout"("reversesPayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayout_idempotencyKey_key" ON "OwnerPayout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OwnerPayout_ownerId_paidOn_idx" ON "OwnerPayout"("ownerId", "paidOn");

-- CreateIndex
CREATE INDEX "OwnerPayoutLine_obligationId_idx" ON "OwnerPayoutLine"("obligationId");

-- CreateIndex
CREATE INDEX "OwnerPayoutLine_payoutId_idx" ON "OwnerPayoutLine"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSend_obligationId_reminderKey_key" ON "ReminderSend"("obligationId", "reminderKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_pushStatus_idx" ON "Notification"("pushStatus");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRevision" ADD CONSTRAINT "PropertyRevision_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingRequest" ADD CONSTRAINT "ViewingRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleClosing" ADD CONSTRAINT "SaleClosing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleClosing" ADD CONSTRAINT "SaleClosing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleClosing" ADD CONSTRAINT "SaleClosing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleObligation" ADD CONSTRAINT "SaleObligation_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "SaleClosing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLedgerEntry" ADD CONSTRAINT "SaleLedgerEntry_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "SaleObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAgreement" ADD CONSTRAINT "RentalAgreement_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "RentalAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAmendment" ADD CONSTRAINT "AgreementAmendment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositEntry" ADD CONSTRAINT "DepositEntry_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentObligation" ADD CONSTRAINT "RentObligation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RentalAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentLedgerEntry" ADD CONSTRAINT "RentLedgerEntry_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayout" ADD CONSTRAINT "OwnerPayout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayoutLine" ADD CONSTRAINT "OwnerPayoutLine_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "OwnerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayoutLine" ADD CONSTRAINT "OwnerPayoutLine_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSend" ADD CONSTRAINT "ReminderSend_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
