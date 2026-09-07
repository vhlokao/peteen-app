-- Etapa 6.2 — Verification Engine

CREATE TYPE "VerificationEntityType" AS ENUM ('PROFESSIONAL', 'PARTNER');
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

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

CREATE INDEX "verification_requests_entityType_entityId_idx" ON "verification_requests"("entityType", "entityId");
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");
CREATE INDEX "verification_requests_requestedAt_idx" ON "verification_requests"("requestedAt");