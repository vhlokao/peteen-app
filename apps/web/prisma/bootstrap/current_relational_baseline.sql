-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CareUpdateCategory" AS ENUM ('CHECK_IN', 'FEEDING', 'WALK', 'ACTIVITY', 'REST', 'NOTE', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "CareMediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "PersonaRole" AS ENUM ('TUTOR', 'PROFESSIONAL', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DOG_WALK', 'PET_SITTING', 'BOARDING', 'GROOMING', 'TRAINING', 'VET_ACCOMPANY', 'DAY_CARE', 'HOME_CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'BIRD', 'RODENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PetGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_TUTOR', 'CANCELLED_BY_PROFESSIONAL', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrustEventType" AS ENUM ('REVIEW_POSITIVE', 'REVIEW_NEGATIVE', 'REVIEW_NEUTRAL', 'RECURRENCE_COMPLETED', 'CANCELLATION_BY_PRO', 'CANCELLATION_BY_TUTOR', 'RECOMMENDATION', 'IDENTITY_VERIFIED', 'FRAUD_FLAG', 'FRAUD_FLAG_RESOLVED');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('INITIAL', 'BUILDING', 'ESTABLISHED', 'TRUSTED', 'ELITE');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PROFESSIONAL', 'PROFESSIONAL_PLUS');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('VET', 'PET_SHOP', 'CLINIC', 'PET_HOTEL', 'DAY_CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('MODERATOR', 'SENIOR_MODERATOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "FraudSignalType" AS ENUM ('FAKE_REVIEW', 'ARTIFICIAL_RECURRENCE', 'DUPLICATE_ACCOUNT', 'SUSPICIOUS_NETWORK', 'RANKING_MANIPULATION', 'UNUSUAL_REVIEW_VELOCITY');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudSignalStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RelationshipLevel" AS ENUM ('NEW', 'KNOWN', 'RECURRING', 'TRUSTED', 'PARTNER');

-- CreateEnum
CREATE TYPE "FlagTargetType" AS ENUM ('USER', 'PROFESSIONAL', 'REVIEW', 'REQUEST');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FlagSource" AS ENUM ('SYSTEM', 'USER_REPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TrustConnectionType" AS ENUM ('PARTNER_RECOMMENDS_PROFESSIONAL', 'TUTOR_RECOMMENDS_PROFESSIONAL', 'PROFESSIONAL_RECOMMENDS_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TrustSourceType" AS ENUM ('PARTNER', 'TUTOR', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TrustTargetType" AS ENUM ('PROFESSIONAL');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('PET_SHOP', 'VETERINARY_CLINIC', 'PET_HOTEL', 'DAYCARE', 'TRAINING_CENTER', 'NGO', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PartnerVerificationStatus" AS ENUM ('NONE', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationEntityType" AS ENUM ('PROFESSIONAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "activePrimaryRole" "PersonaRole",
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "neighborhoodId" TEXT,
    "regionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tutor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "serviceRadiusKm" DOUBLE PRECISION DEFAULT 10,
    "neighborhoodId" TEXT,
    "regionId" TEXT,
    "serviceTypes" "ServiceType"[],
    "specializations" TEXT[],
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'INITIAL',
    "trustUpdatedAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedIdentity" BOOLEAN NOT NULL DEFAULT false,
    "verifiedPhone" BOOLEAN NOT NULL DEFAULT false,
    "verifiedPartner" BOOLEAN NOT NULL DEFAULT false,
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_availabilities" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "neighborhoodId" TEXT,
    "regionId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "linkedPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "regionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "PartnerCategory" NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "neighborhood" TEXT,
    "neighborhoodId" TEXT,
    "regionId" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "logoUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingStatus" "PartnerOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "onboardingCompletedAt" TIMESTAMP(3),
    "verificationStatus" "PartnerVerificationStatus" NOT NULL DEFAULT 'NONE',
    "yearsInBusiness" INTEGER,
    "hasCnpj" BOOLEAN NOT NULL DEFAULT false,
    "verificationRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breed" TEXT,
    "gender" "PetGender",
    "birthDate" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "size" "PetSize",
    "avatarUrl" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "isNeutered" BOOLEAN,
    "hasSpecialNeeds" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultDurationMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "petId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "scheduledHasTime" BOOLEAN NOT NULL DEFAULT false,
    "durationMin" INTEGER,
    "endAt" TIMESTAMP(3),
    "notes" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "parentRequestId" TEXT,
    "seriesId" TEXT,
    "recurrenceRule" TEXT,
    "recurrenceEndsAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_updates" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "petId" TEXT,
    "professionalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" "CareUpdateCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,

    CONSTRAINT "care_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_media" (
    "id" TEXT NOT NULL,
    "careUpdateId" TEXT NOT NULL,
    "type" "CareMediaType" NOT NULL DEFAULT 'PHOTO',
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "displayWidth" INTEGER,
    "displayHeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "petContext" JSONB NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "hiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "TrustEventType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "context" JSONB,
    "relatedRequestId" TEXT,
    "relatedReviewId" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_clients" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[],
    "totalServices" INTEGER NOT NULL DEFAULT 0,
    "lastServiceAt" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3),
    "isActiveClient" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_signals" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "signalType" "FraudSignalType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL DEFAULT 'LOW',
    "description" TEXT,
    "evidence" JSONB,
    "status" "FraudSignalStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_professional_relationships" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "completedServices" INTEGER NOT NULL DEFAULT 0,
    "reviewsGiven" INTEGER NOT NULL DEFAULT 0,
    "cancelledByTutor" INTEGER NOT NULL DEFAULT 0,
    "cancelledByPro" INTEGER NOT NULL DEFAULT 0,
    "disputedServices" INTEGER NOT NULL DEFAULT 0,
    "firstServiceAt" TIMESTAMP(3),
    "lastServiceAt" TIMESTAMP(3),
    "relationshipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relationshipLevel" "RelationshipLevel" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_professional_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_flags" (
    "id" TEXT NOT NULL,
    "targetType" "FlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "FlagSeverity" NOT NULL DEFAULT 'LOW',
    "source" "FlagSource" NOT NULL DEFAULT 'SYSTEM',
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "operational_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_connections" (
    "id" TEXT NOT NULL,
    "sourceType" "TrustSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourcePartnerId" TEXT,
    "targetType" "TrustTargetType" NOT NULL DEFAULT 'PROFESSIONAL',
    "targetId" TEXT NOT NULL,
    "connectionType" "TrustConnectionType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "entityType" "VerificationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" VARCHAR(1000),
    "p256dh" TEXT,
    "auth" TEXT,
    "endpointHash" VARCHAR(64) NOT NULL,
    "vapidKeyFingerprint" VARCHAR(64),
    "runtimeEnvironment" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(40),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" TEXT NOT NULL,
    "eventKey" VARCHAR(200) NOT NULL,
    "eventType" VARCHAR(60) NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "channel" VARCHAR(20) NOT NULL DEFAULT 'push',
    "attemptedCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationKey" VARCHAR(200) NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_visits" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "visitorKey" VARCHAR(64) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedUserId" TEXT,
    "signedUpAt" TIMESTAMP(3),
    "petCreatedAt" TIMESTAMP(3),
    "requestCreatedAt" TIMESTAMP(3),
    "serviceCompletedAt" TIMESTAMP(3),

    CONSTRAINT "invite_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_authId_key" ON "users"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_authId_idx" ON "users"("authId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_activePrimaryRole_idx" ON "users"("activePrimaryRole");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_profiles_userId_key" ON "tutor_profiles"("userId");

-- CreateIndex
CREATE INDEX "tutor_profiles_city_idx" ON "tutor_profiles"("city");

-- CreateIndex
CREATE INDEX "tutor_profiles_neighborhood_idx" ON "tutor_profiles"("neighborhood");

-- CreateIndex
CREATE INDEX "tutor_profiles_neighborhoodId_idx" ON "tutor_profiles"("neighborhoodId");

-- CreateIndex
CREATE INDEX "tutor_profiles_regionId_idx" ON "tutor_profiles"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profiles_userId_key" ON "professional_profiles"("userId");

-- CreateIndex
CREATE INDEX "professional_profiles_city_idx" ON "professional_profiles"("city");

-- CreateIndex
CREATE INDEX "professional_profiles_neighborhood_idx" ON "professional_profiles"("neighborhood");

-- CreateIndex
CREATE INDEX "professional_profiles_neighborhoodId_idx" ON "professional_profiles"("neighborhoodId");

-- CreateIndex
CREATE INDEX "professional_profiles_regionId_idx" ON "professional_profiles"("regionId");

-- CreateIndex
CREATE INDEX "professional_profiles_trustScore_idx" ON "professional_profiles"("trustScore");

-- CreateIndex
CREATE INDEX "professional_profiles_trustLevel_idx" ON "professional_profiles"("trustLevel");

-- CreateIndex
CREATE INDEX "professional_availabilities_professionalProfileId_idx" ON "professional_availabilities"("professionalProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "professional_availabilities_professionalProfileId_weekday_key" ON "professional_availabilities"("professionalProfileId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_userId_key" ON "partner_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_linkedPartnerId_key" ON "partner_profiles"("linkedPartnerId");

-- CreateIndex
CREATE INDEX "partner_profiles_city_idx" ON "partner_profiles"("city");

-- CreateIndex
CREATE INDEX "partner_profiles_type_idx" ON "partner_profiles"("type");

-- CreateIndex
CREATE INDEX "partner_profiles_neighborhoodId_idx" ON "partner_profiles"("neighborhoodId");

-- CreateIndex
CREATE INDEX "partner_profiles_regionId_idx" ON "partner_profiles"("regionId");

-- CreateIndex
CREATE INDEX "partner_profiles_linkedPartnerId_idx" ON "partner_profiles"("linkedPartnerId");

-- CreateIndex
CREATE INDEX "regions_city_state_idx" ON "regions"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "regions_city_state_slug_key" ON "regions"("city", "state", "slug");

-- CreateIndex
CREATE INDEX "neighborhoods_city_state_idx" ON "neighborhoods"("city", "state");

-- CreateIndex
CREATE INDEX "neighborhoods_regionId_idx" ON "neighborhoods"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_city_state_slug_key" ON "neighborhoods"("city", "state", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE INDEX "partners_city_idx" ON "partners"("city");

-- CreateIndex
CREATE INDEX "partners_category_idx" ON "partners"("category");

-- CreateIndex
CREATE INDEX "partners_isActive_idx" ON "partners"("isActive");

-- CreateIndex
CREATE INDEX "partners_neighborhoodId_idx" ON "partners"("neighborhoodId");

-- CreateIndex
CREATE INDEX "partners_regionId_idx" ON "partners"("regionId");

-- CreateIndex
CREATE INDEX "partners_onboardingStatus_idx" ON "partners"("onboardingStatus");

-- CreateIndex
CREATE INDEX "partners_verificationStatus_idx" ON "partners"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE INDEX "pets_tutorId_idx" ON "pets"("tutorId");

-- CreateIndex
CREATE INDEX "pets_tutorId_isActive_idx" ON "pets"("tutorId", "isActive");

-- CreateIndex
CREATE INDEX "services_professionalId_idx" ON "services"("professionalId");

-- CreateIndex
CREATE INDEX "services_serviceType_idx" ON "services"("serviceType");

-- CreateIndex
CREATE INDEX "service_requests_tutorId_idx" ON "service_requests"("tutorId");

-- CreateIndex
CREATE INDEX "service_requests_professionalId_idx" ON "service_requests"("professionalId");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_petId_idx" ON "service_requests"("petId");

-- CreateIndex
CREATE INDEX "service_requests_isRecurring_idx" ON "service_requests"("isRecurring");

-- CreateIndex
CREATE INDEX "service_requests_seriesId_idx" ON "service_requests"("seriesId");

-- CreateIndex
CREATE INDEX "care_updates_requestId_idx" ON "care_updates"("requestId");

-- CreateIndex
CREATE INDEX "care_updates_requestId_occurredAt_idx" ON "care_updates"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "care_updates_requestId_deletedAt_idx" ON "care_updates"("requestId", "deletedAt");

-- CreateIndex
CREATE INDEX "care_updates_authorId_idx" ON "care_updates"("authorId");

-- CreateIndex
CREATE INDEX "care_updates_createdAt_idx" ON "care_updates"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_updates_requestId_idempotencyKey_key" ON "care_updates"("requestId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "care_media_storagePath_key" ON "care_media"("storagePath");

-- CreateIndex
CREATE INDEX "care_media_careUpdateId_idx" ON "care_media"("careUpdateId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_requestId_key" ON "reviews"("requestId");

-- CreateIndex
CREATE INDEX "reviews_tutorId_idx" ON "reviews"("tutorId");

-- CreateIndex
CREATE INDEX "reviews_requestId_idx" ON "reviews"("requestId");

-- CreateIndex
CREATE INDEX "reviews_serviceType_idx" ON "reviews"("serviceType");

-- CreateIndex
CREATE INDEX "reviews_isFlagged_idx" ON "reviews"("isFlagged");

-- CreateIndex
CREATE INDEX "reviews_hiddenByAdmin_idx" ON "reviews"("hiddenByAdmin");

-- CreateIndex
CREATE INDEX "trust_events_targetId_idx" ON "trust_events"("targetId");

-- CreateIndex
CREATE INDEX "trust_events_actorId_idx" ON "trust_events"("actorId");

-- CreateIndex
CREATE INDEX "trust_events_type_idx" ON "trust_events"("type");

-- CreateIndex
CREATE INDEX "trust_events_createdAt_idx" ON "trust_events"("createdAt");

-- CreateIndex
CREATE INDEX "trust_events_targetId_createdAt_idx" ON "trust_events"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_clients_professionalId_idx" ON "crm_clients"("professionalId");

-- CreateIndex
CREATE INDEX "crm_clients_isActiveClient_idx" ON "crm_clients"("isActiveClient");

-- CreateIndex
CREATE UNIQUE INDEX "crm_clients_professionalId_tutorId_key" ON "crm_clients"("professionalId", "tutorId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "fraud_signals_targetUserId_idx" ON "fraud_signals"("targetUserId");

-- CreateIndex
CREATE INDEX "fraud_signals_status_idx" ON "fraud_signals"("status");

-- CreateIndex
CREATE INDEX "fraud_signals_signalType_idx" ON "fraud_signals"("signalType");

-- CreateIndex
CREATE INDEX "fraud_signals_severity_idx" ON "fraud_signals"("severity");

-- CreateIndex
CREATE INDEX "tutor_professional_relationships_professionalId_idx" ON "tutor_professional_relationships"("professionalId");

-- CreateIndex
CREATE INDEX "tutor_professional_relationships_professionalId_relationshi_idx" ON "tutor_professional_relationships"("professionalId", "relationshipLevel");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_professional_relationships_tutorId_professionalId_key" ON "tutor_professional_relationships"("tutorId", "professionalId");

-- CreateIndex
CREATE INDEX "operational_flags_targetType_targetId_idx" ON "operational_flags"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "operational_flags_status_idx" ON "operational_flags"("status");

-- CreateIndex
CREATE INDEX "operational_flags_severity_idx" ON "operational_flags"("severity");

-- CreateIndex
CREATE INDEX "disputes_requestId_idx" ON "disputes"("requestId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_entityType_entityId_idx" ON "admin_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "trust_connections_targetId_idx" ON "trust_connections"("targetId");

-- CreateIndex
CREATE INDEX "trust_connections_isActive_idx" ON "trust_connections"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "trust_connections_sourceId_targetId_connectionType_key" ON "trust_connections"("sourceId", "targetId", "connectionType");

-- CreateIndex
CREATE INDEX "verification_requests_entityType_entityId_idx" ON "verification_requests"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");

-- CreateIndex
CREATE INDEX "verification_requests_requestedAt_idx" ON "verification_requests"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_revokedAt_idx" ON "push_subscriptions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_vapidKeyFingerprint_idx" ON "push_subscriptions"("vapidKeyFingerprint");

-- CreateIndex
CREATE INDEX "push_subscriptions_endpointHash_idx" ON "push_subscriptions"("endpointHash");

-- CreateIndex
CREATE INDEX "push_deliveries_eventType_createdAt_idx" ON "push_deliveries"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "push_deliveries_entityId_idx" ON "push_deliveries"("entityId");

-- CreateIndex
CREATE INDEX "push_deliveries_createdAt_idx" ON "push_deliveries"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_deliveries_eventKey_recipientUserId_channel_key" ON "push_deliveries"("eventKey", "recipientUserId", "channel");

-- CreateIndex
CREATE INDEX "notification_reads_userId_readAt_idx" ON "notification_reads"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_userId_notificationKey_key" ON "notification_reads"("userId", "notificationKey");

-- CreateIndex
CREATE INDEX "invite_visits_professionalId_openedAt_idx" ON "invite_visits"("professionalId", "openedAt");

-- CreateIndex
CREATE INDEX "invite_visits_convertedUserId_idx" ON "invite_visits"("convertedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_visits_visitorKey_professionalId_key" ON "invite_visits"("visitorKey", "professionalId");

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_availabilities" ADD CONSTRAINT "professional_availabilities_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_linkedPartnerId_fkey" FOREIGN KEY ("linkedPartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhoods" ADD CONSTRAINT "neighborhoods_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_updates" ADD CONSTRAINT "care_updates_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_updates" ADD CONSTRAINT "care_updates_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_updates" ADD CONSTRAINT "care_updates_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_updates" ADD CONSTRAINT "care_updates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_media" ADD CONSTRAINT "care_media_careUpdateId_fkey" FOREIGN KEY ("careUpdateId") REFERENCES "care_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_professional_relationships" ADD CONSTRAINT "tutor_professional_relationships_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_professional_relationships" ADD CONSTRAINT "tutor_professional_relationships_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_connections" ADD CONSTRAINT "trust_connections_sourcePartnerId_fkey" FOREIGN KEY ("sourcePartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_connections" ADD CONSTRAINT "trust_connections_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_visits" ADD CONSTRAINT "invite_visits_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_visits" ADD CONSTRAINT "invite_visits_convertedUserId_fkey" FOREIGN KEY ("convertedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

