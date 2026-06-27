-- Etapa 7.6 — Disponibilidade semanal indicativa do profissional (MVP)
-- Aplicado via `prisma db push` quando migrate history está em drift.

CREATE TABLE IF NOT EXISTS "professional_availabilities" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "professional_availabilities_professionalProfileId_weekday_key"
  ON "professional_availabilities"("professionalProfileId", "weekday");

CREATE INDEX IF NOT EXISTS "professional_availabilities_professionalProfileId_idx"
  ON "professional_availabilities"("professionalProfileId");

ALTER TABLE "professional_availabilities"
  DROP CONSTRAINT IF EXISTS "professional_availabilities_professionalProfileId_fkey";

ALTER TABLE "professional_availabilities"
  ADD CONSTRAINT "professional_availabilities_professionalProfileId_fkey"
  FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
