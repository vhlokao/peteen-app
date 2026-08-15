-- Care Operations V0 — R2A: mídia do Diário de cuidado (foto) + idempotência
-- de publicação.
--
-- Migration ADITIVA. Cria UMA tabela nova (`care_media`), UM enum novo
-- (`CareMediaType`) e adiciona UMA coluna nullable a `care_updates`. NÃO faz
-- backfill, NÃO altera dado existente, NÃO remove nada.
--
-- ⚠ REEXECUTÁVEL SOMENTE APÓS PRÉ-CHECK DO ESTADO ESPERADO — NÃO é idempotente.
--
-- Mesma ressalva das migrations anteriores deste projeto: as cláusulas
-- IF NOT EXISTS abaixo validam apenas NOME, nunca estrutura. Uma tabela ou
-- índice homônimo com colunas diferentes passaria silenciosamente e deixaria a
-- migration reportando sucesso sobre a estrutura errada. A segurança vem do
-- PRÉ-CHECK, que é parte inseparável do procedimento.
--
-- PRÉ-CHECK (as três consultas DEVEM retornar 0; se não, PARE):
--
--   SELECT COUNT(*) FROM information_schema.tables
--    WHERE table_schema='public' AND table_name = 'care_media';
--
--   SELECT COUNT(*) FROM pg_type WHERE typname = 'CareMediaType';
--
--   SELECT COUNT(*) FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='care_updates'
--      AND column_name='idempotencyKey';
--
-- O corpo está em BEGIN/COMMIT: o Postgres tem DDL transacional, então falha em
-- qualquer statement reverte a migration inteira, em vez de deixar estado
-- parcial.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SOBRE O UNIQUE (requestId, idempotencyKey)
--
-- É ele — e não nenhum lock de UI — que garante que a mesma intenção de
-- publicação não vira duas atualizações. `idempotencyKey` é NULLABLE e no
-- Postgres NULLs são DISTINTOS entre si num índice único: toda linha anterior
-- a esta migration tem a coluna nula e nenhuma delas colide com outra. Não é
-- preciso backfill.
--
-- O unique é COMPOSTO com requestId de propósito. Um unique global na chave
-- deixaria uma colisão entre requests diferentes devolver ao chamador uma
-- CareUpdate de OUTRO atendimento — vazamento por adivinhação de chave.
-- Escopado por request, a colisão só pode acontecer dentro de um atendimento
-- cuja posse o chamador já provou.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SOBRE care_media.storagePath UNIQUE
--
-- Impede que o mesmo objeto do bucket seja anexado a duas atualizações — por
-- retry, por corrida ou por um cliente reenviando o mesmo path. O path carrega
-- um UUID gerado no servidor, então em uso legítimo nunca colide; o unique
-- existe para o uso ILEGÍTIMO.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SOBRE A AUSÊNCIA DE ON DELETE CASCADE
--
-- A FK é RESTRICT (default). CareUpdate usa SOFT delete (deletedAt) — nunca é
-- removida fisicamente — então cascade não teria uso legítimo e só criaria um
-- caminho para destruir evidência de atendimento em massa por engano. Mesma
-- postura das demais FKs de care_updates.

BEGIN;

-- 1. Enum de tipo de mídia. Só PHOTO no V0.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CareMediaType') THEN
    CREATE TYPE "CareMediaType" AS ENUM ('PHOTO');
  END IF;
END $$;

-- 2. Coluna de idempotência em care_updates (nullable, sem backfill).
ALTER TABLE "care_updates" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "care_updates_requestId_idempotencyKey_key"
  ON "care_updates" ("requestId", "idempotencyKey");

-- 3. Tabela de mídia.
CREATE TABLE IF NOT EXISTS "care_media" (
  "id"           TEXT NOT NULL,
  "careUpdateId" TEXT NOT NULL,
  "type"         "CareMediaType" NOT NULL DEFAULT 'PHOTO',
  "storagePath"  TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "sizeBytes"    INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "care_media_storagePath_key"
  ON "care_media" ("storagePath");

CREATE INDEX IF NOT EXISTS "care_media_careUpdateId_idx"
  ON "care_media" ("careUpdateId");

-- FK explícita: a relação declarada em schema.prisma é virtual do lado do pai.
ALTER TABLE "care_media"
  DROP CONSTRAINT IF EXISTS "care_media_careUpdateId_fkey";

ALTER TABLE "care_media"
  ADD CONSTRAINT "care_media_careUpdateId_fkey"
  FOREIGN KEY ("careUpdateId") REFERENCES "care_updates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
--
--   BEGIN;
--   DROP TABLE IF EXISTS "care_media";
--   DROP TYPE  IF EXISTS "CareMediaType";
--   DROP INDEX IF EXISTS "care_updates_requestId_idempotencyKey_key";
--   ALTER TABLE "care_updates" DROP COLUMN IF EXISTS "idempotencyKey";
--   COMMIT;
--
-- ⚠ `DROP TABLE care_media` DESTRÓI o vínculo entre atendimento e arquivo. Os
-- objetos no bucket sobrevivem, mas viram órfãos indistinguíveis — a evidência
-- de qual foto pertence a qual atendimento é perdida. Só execute com o bucket
-- comprovadamente sem mídia publicada, ou com dump prévio da tabela.
