-- Service Uniqueness Concurrency Safety — última linha de defesa contra
-- mais de um Service ativo por (professionalId, serviceType).
--
-- Migration ADITIVA. Não altera dados, não remove índices existentes.
-- Idempotente via IF NOT EXISTS. Não usa `prisma db push` — aplicada via
-- o mesmo mecanismo versionado das migrations anteriores do projeto.
--
-- Por que parcial (WHERE "isActive" = true) e não um @@unique pleno:
--   Services inativos são histórico legítimo — um profissional pode ter
--   vários registros inativos do mesmo tipo (ex.: recriou o serviço com
--   preço diferente). Só o conjunto de ATIVOS precisa ser único por tipo.
--
-- Por que a proteção continua existindo também na aplicação
-- (hasActiveServiceOfType em modules/professional/infrastructure/repository.ts):
--   o guard de aplicação dá a mensagem amigável ANTES da tentativa de escrita
--   (boa UX); este índice é a garantia atômica de que, mesmo sob concorrência
--   real (duas escritas simultâneas), o banco nunca persiste dois ativos do
--   mesmo tipo — o guard sozinho não garante isso (TOCTOU comprovado em QA).
--
-- Nomenclatura: segue o padrão já usado no projeto para unique composto
-- (ver professional_availabilities_professionalProfileId_weekday_key, em
-- 20250620120000_professional_availability_7_6/migration.sql), com o sufixo
-- _active_ para deixar explícito que é parcial, não um unique pleno.
--
-- schema.prisma: o Prisma (v7) não suporta predicado WHERE em @@unique/@@index
-- — não há forma nativa de declarar um índice único parcial na DSL do schema.
-- Por isso este índice existe SOMENTE nesta migration SQL, com um comentário
-- em schema.prisma apontando para cá (ver model Service).
--
-- Rollback: ver bloco comentado ao final. Não executar nesta missão.

CREATE UNIQUE INDEX IF NOT EXISTS "services_professionalId_serviceType_active_key"
  ON "services" ("professionalId", "serviceType")
  WHERE "isActive" = true;

-- ────────────────────────────────────────────────────────────────────────
-- ROLLBACK (não executar nesta missão — exige autorização de Dados)
--
--   DROP INDEX IF EXISTS "services_professionalId_serviceType_active_key";
--
-- Reverter é seguro e não perde dados: remove só a restrição, nenhuma linha
-- é tocada.
-- ────────────────────────────────────────────────────────────────────────
