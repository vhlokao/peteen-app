-- ─────────────────────────────────────────────────────────────────────────────
-- Etapa 5.5 — Moderação, Antifraude e Segurança Operacional
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Novos enums
CREATE TYPE "FlagTargetType" AS ENUM ('USER', 'PROFESSIONAL', 'REVIEW', 'REQUEST');
CREATE TYPE "FlagSeverity"   AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FlagSource"     AS ENUM ('SYSTEM', 'USER_REPORT', 'ADMIN');
CREATE TYPE "FlagStatus"     AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "DisputeStatus"  AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- 2. Tabela: operational_flags
CREATE TABLE operational_flags (
  id           TEXT             NOT NULL,
  "targetType" "FlagTargetType" NOT NULL,
  "targetId"   TEXT             NOT NULL,
  reason       TEXT             NOT NULL,
  severity     "FlagSeverity"   NOT NULL DEFAULT 'LOW',
  source       "FlagSource"     NOT NULL DEFAULT 'SYSTEM',
  status       "FlagStatus"     NOT NULL DEFAULT 'OPEN',
  "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  CONSTRAINT operational_flags_pkey PRIMARY KEY (id)
);
CREATE INDEX operational_flags_target_idx   ON operational_flags ("targetType", "targetId");
CREATE INDEX operational_flags_status_idx   ON operational_flags (status);
CREATE INDEX operational_flags_severity_idx ON operational_flags (severity);

-- 3. Tabela: disputes
CREATE TABLE disputes (
  id          TEXT            NOT NULL,
  "requestId" TEXT            NOT NULL,
  "openedBy"  TEXT            NOT NULL,
  reason      TEXT            NOT NULL,
  description TEXT,
  status      "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  CONSTRAINT disputes_pkey          PRIMARY KEY (id),
  CONSTRAINT disputes_requestId_fkey FOREIGN KEY ("requestId") REFERENCES service_requests(id) ON DELETE RESTRICT,
  CONSTRAINT disputes_openedBy_fkey  FOREIGN KEY ("openedBy")  REFERENCES users(id)            ON DELETE RESTRICT
);
CREATE INDEX disputes_requestId_idx ON disputes ("requestId");
CREATE INDEX disputes_status_idx    ON disputes (status);

-- 4. Tabela: admin_audit_logs
CREATE TABLE admin_audit_logs (
  id           TEXT         NOT NULL,
  "adminId"    TEXT         NOT NULL,
  action       TEXT         NOT NULL,
  "entityType" TEXT         NOT NULL,
  "entityId"   TEXT         NOT NULL,
  metadata     JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_audit_logs_pkey        PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_adminId_fkey FOREIGN KEY ("adminId") REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX admin_audit_logs_adminId_idx  ON admin_audit_logs ("adminId");
CREATE INDEX admin_audit_logs_entity_idx   ON admin_audit_logs ("entityType", "entityId");
CREATE INDEX admin_audit_logs_createdAt_idx ON admin_audit_logs ("createdAt");

-- 5. Colunas de moderação na tabela reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "hiddenByAdmin" BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "hiddenAt"      TIMESTAMP(3);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS "hiddenReason"  TEXT;