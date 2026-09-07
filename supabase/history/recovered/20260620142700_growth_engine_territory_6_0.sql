-- Etapa 6.0 — Growth Engine territorial

CREATE TABLE IF NOT EXISTS "regions" (
  "id" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "regions_city_state_slug_key" ON "regions"("city", "state", "slug");
CREATE INDEX IF NOT EXISTS "regions_city_state_idx" ON "regions"("city", "state");

CREATE TABLE IF NOT EXISTS "neighborhoods" (
  "id" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "regionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "neighborhoods_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "neighborhoods_city_state_slug_key" ON "neighborhoods"("city", "state", "slug");
CREATE INDEX IF NOT EXISTS "neighborhoods_city_state_idx" ON "neighborhoods"("city", "state");
CREATE INDEX IF NOT EXISTS "neighborhoods_regionId_idx" ON "neighborhoods"("regionId");

ALTER TABLE "tutor_profiles" ADD COLUMN IF NOT EXISTS "neighborhoodId" TEXT;
ALTER TABLE "tutor_profiles" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

ALTER TABLE "professional_profiles" ADD COLUMN IF NOT EXISTS "serviceRadiusKm" DOUBLE PRECISION DEFAULT 10;
ALTER TABLE "professional_profiles" ADD COLUMN IF NOT EXISTS "neighborhoodId" TEXT;
ALTER TABLE "professional_profiles" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

ALTER TABLE "partner_profiles" ADD COLUMN IF NOT EXISTS "neighborhoodId" TEXT;
ALTER TABLE "partner_profiles" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "neighborhoodId" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "regionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partners" ADD CONSTRAINT "partners_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partners" ADD CONSTRAINT "partners_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "tutor_profiles_neighborhoodId_idx" ON "tutor_profiles"("neighborhoodId");
CREATE INDEX IF NOT EXISTS "tutor_profiles_regionId_idx" ON "tutor_profiles"("regionId");
CREATE INDEX IF NOT EXISTS "professional_profiles_neighborhoodId_idx" ON "professional_profiles"("neighborhoodId");
CREATE INDEX IF NOT EXISTS "professional_profiles_regionId_idx" ON "professional_profiles"("regionId");
CREATE INDEX IF NOT EXISTS "partner_profiles_neighborhoodId_idx" ON "partner_profiles"("neighborhoodId");
CREATE INDEX IF NOT EXISTS "partner_profiles_regionId_idx" ON "partner_profiles"("regionId");
CREATE INDEX IF NOT EXISTS "partners_neighborhoodId_idx" ON "partners"("neighborhoodId");
CREATE INDEX IF NOT EXISTS "partners_regionId_idx" ON "partners"("regionId");