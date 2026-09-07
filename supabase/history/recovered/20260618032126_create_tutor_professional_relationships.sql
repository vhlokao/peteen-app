-- Etapa 5.3 — Relationship Engine
-- Cria enum RelationshipLevel e tabela tutor_professional_relationships

CREATE TYPE "RelationshipLevel" AS ENUM ('NEW', 'KNOWN', 'RECURRING', 'TRUSTED', 'PARTNER');

CREATE TABLE "tutor_professional_relationships" (
  "id"                TEXT NOT NULL,
  "tutorId"           TEXT NOT NULL,
  "professionalId"    TEXT NOT NULL,
  "totalRequests"     INTEGER NOT NULL DEFAULT 0,
  "completedServices" INTEGER NOT NULL DEFAULT 0,
  "reviewsGiven"      INTEGER NOT NULL DEFAULT 0,
  "cancelledByTutor"  INTEGER NOT NULL DEFAULT 0,
  "cancelledByPro"    INTEGER NOT NULL DEFAULT 0,
  "disputedServices"  INTEGER NOT NULL DEFAULT 0,
  "firstServiceAt"    TIMESTAMP(3),
  "lastServiceAt"     TIMESTAMP(3),
  "relationshipScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "relationshipLevel" "RelationshipLevel" NOT NULL DEFAULT 'NEW',
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tutor_professional_relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tutor_professional_relationships_tutorId_professionalId_key"
    UNIQUE ("tutorId", "professionalId")
);

CREATE INDEX "tutor_professional_relationships_professionalId_idx"
  ON "tutor_professional_relationships"("professionalId");

CREATE INDEX "tutor_professional_relationships_professionalId_relationshipLevel_idx"
  ON "tutor_professional_relationships"("professionalId", "relationshipLevel");

ALTER TABLE "tutor_professional_relationships"
  ADD CONSTRAINT "tutor_professional_relationships_tutorId_fkey"
  FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_professional_relationships"
  ADD CONSTRAINT "tutor_professional_relationships_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;