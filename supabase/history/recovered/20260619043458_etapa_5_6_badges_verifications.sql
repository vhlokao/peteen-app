-- Etapa 5.6 — Selos de verificação no ProfessionalProfile
-- verifiedProfile já existe como isVerified (mantemos retrocompat)
-- Adicionamos os selos futuros já na arquitetura

ALTER TABLE professional_profiles
  ADD COLUMN IF NOT EXISTS "verifiedIdentity" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "verifiedPhone"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "verifiedPartner"  BOOLEAN NOT NULL DEFAULT FALSE;