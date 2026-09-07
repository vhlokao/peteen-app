-- TitiodePet — Foundation Migration
-- Infraestrutura de confiança recorrente para serviços pet

-- CreateEnum
CREATE TYPE "PersonaRole" AS ENUM ('TUTOR', 'PROFESSIONAL', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DOG_WALK', 'PET_SITTING', 'BOARDING', 'GROOMING', 'TRAINING', 'VET_ACCOMPANY', 'DAY_CARE', 'HOME_CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'BIRD', 'RABBIT', 'FISH', 'REPTILE', 'OTHER');

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
    "serviceTypes" "ServiceType"[],
    "specializations" TEXT[],
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'INITIAL',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "planExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id")
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
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
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
    "birthDate" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "weight" DOUBLE PRECISION,
    "notes" TEXT,
    "isNeutered" BOOLEAN,
    "hasSpecialNeeds" BOOLEAN NOT NULL DEFAULT false,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "parentRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "users_authId_key" ON "users"("authId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_authId_idx" ON "users"("authId");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_activePrimaryRole_idx" ON "users"("activePrimaryRole");
CREATE UNIQUE INDEX "tutor_profiles_userId_key" ON "tutor_profiles"("userId");
CREATE INDEX "tutor_profiles_city_idx" ON "tutor_profiles"("city");
CREATE INDEX "tutor_profiles_neighborhood_idx" ON "tutor_profiles"("neighborhood");
CREATE UNIQUE INDEX "professional_profiles_userId_key" ON "professional_profiles"("userId");
CREATE INDEX "professional_profiles_city_idx" ON "professional_profiles"("city");
CREATE INDEX "professional_profiles_neighborhood_idx" ON "professional_profiles"("neighborhood");
CREATE INDEX "professional_profiles_trustScore_idx" ON "professional_profiles"("trustScore");
CREATE INDEX "professional_profiles_trustLevel_idx" ON "professional_profiles"("trustLevel");
CREATE UNIQUE INDEX "partner_profiles_userId_key" ON "partner_profiles"("userId");
CREATE INDEX "partner_profiles_city_idx" ON "partner_profiles"("city");
CREATE INDEX "partner_profiles_type_idx" ON "partner_profiles"("type");
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");
CREATE INDEX "pets_tutorId_idx" ON "pets"("tutorId");
CREATE INDEX "services_professionalId_idx" ON "services"("professionalId");
CREATE INDEX "services_serviceType_idx" ON "services"("serviceType");
CREATE INDEX "service_requests_tutorId_idx" ON "service_requests"("tutorId");
CREATE INDEX "service_requests_professionalId_idx" ON "service_requests"("professionalId");
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");
CREATE INDEX "service_requests_petId_idx" ON "service_requests"("petId");
CREATE INDEX "service_requests_isRecurring_idx" ON "service_requests"("isRecurring");
CREATE UNIQUE INDEX "reviews_requestId_key" ON "reviews"("requestId");
CREATE INDEX "reviews_tutorId_idx" ON "reviews"("tutorId");
CREATE INDEX "reviews_requestId_idx" ON "reviews"("requestId");
CREATE INDEX "reviews_serviceType_idx" ON "reviews"("serviceType");
CREATE INDEX "reviews_isFlagged_idx" ON "reviews"("isFlagged");
CREATE INDEX "trust_events_targetId_idx" ON "trust_events"("targetId");
CREATE INDEX "trust_events_actorId_idx" ON "trust_events"("actorId");
CREATE INDEX "trust_events_type_idx" ON "trust_events"("type");
CREATE INDEX "trust_events_createdAt_idx" ON "trust_events"("createdAt");
CREATE INDEX "trust_events_targetId_createdAt_idx" ON "trust_events"("targetId", "createdAt");
CREATE INDEX "crm_clients_professionalId_idx" ON "crm_clients"("professionalId");
CREATE INDEX "crm_clients_isActiveClient_idx" ON "crm_clients"("isActiveClient");
CREATE UNIQUE INDEX "crm_clients_professionalId_tutorId_key" ON "crm_clients"("professionalId", "tutorId");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "fraud_signals_targetUserId_idx" ON "fraud_signals"("targetUserId");
CREATE INDEX "fraud_signals_status_idx" ON "fraud_signals"("status");
CREATE INDEX "fraud_signals_signalType_idx" ON "fraud_signals"("signalType");
CREATE INDEX "fraud_signals_severity_idx" ON "fraud_signals"("severity");

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pets" ADD CONSTRAINT "pets_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_clients" ADD CONSTRAINT "crm_clients_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;