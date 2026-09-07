-- Etapa 6.1 — Partner Onboarding & Activation

CREATE TYPE "PartnerOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "PartnerVerificationStatus" AS ENUM ('NONE', 'PENDING_VERIFICATION', 'VERIFIED');

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "onboardingStatus" "PartnerOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationStatus" "PartnerVerificationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "yearsInBusiness" INTEGER,
  ADD COLUMN IF NOT EXISTS "hasCnpj" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationRequestedAt" TIMESTAMP(3);

-- Parceiros já ativos (backoffice) → onboarding concluído
UPDATE "partners"
SET
  "onboardingStatus" = 'COMPLETED',
  "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", "updatedAt"),
  "verificationStatus" = CASE WHEN "isVerified" = true THEN 'VERIFIED'::"PartnerVerificationStatus" ELSE "verificationStatus" END
WHERE "isActive" = true AND "onboardingStatus" = 'NOT_STARTED';

CREATE INDEX IF NOT EXISTS "partners_onboardingStatus_idx" ON "partners"("onboardingStatus");
CREATE INDEX IF NOT EXISTS "partners_verificationStatus_idx" ON "partners"("verificationStatus");