-- Agenda Foundation V0.3 — horário e duração
--
-- Migration ADITIVA. Nenhuma coluna existente é alterada, removida ou
-- renomeada. Nenhum dado histórico é tocado (sem UPDATE, sem backfill).
--
-- Compatibilidade com registros existentes:
--   * services.defaultDurationMin        → NULL   (serviço sem duração declarada)
--   * service_requests.durationMin       → NULL   (compromisso sem duração prevista)
--   * service_requests.endAt             → NULL   (sem fim previsto)
--   * service_requests.scheduledHasTime  → false  (via DEFAULT: todo registro
--       anterior a esta migration passa a ser explicitamente "precisão de dia",
--       que é exatamente a semântica correta — as âncoras 12:00/00:00 UTC nunca
--       representaram escolha de horário de ninguém)
--
-- Por que scheduledHasTime é NOT NULL DEFAULT false (e não nullable):
--   um Boolean nullable criaria um terceiro estado (NULL) sem significado
--   distinto de false, convidando a interpretações divergentes. O DEFAULT
--   preenche todas as linhas existentes na própria operação de ALTER, então a
--   compatibilidade é total sem backfill manual.
--
-- Índices: nenhum criado nesta etapa. A leitura da Agenda hoje filtra por
-- "professionalId" (índice já existente) e ordena por "createdAt"; a ordenação
-- por horário acontece em memória. O índice composto
-- ("professionalId", "scheduledAt") só se justifica junto da query de detecção
-- de conflito (R4) — criá-lo agora seria índice não exercitado.
--
-- Rollback: ver bloco comentado ao final. Não executar nesta missão.

-- ── services ────────────────────────────────────────────────────────────────
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "defaultDurationMin" INTEGER;

-- ── service_requests ────────────────────────────────────────────────────────
ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "scheduledHasTime" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "durationMin" INTEGER;

ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);

-- ────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (não executar nesta missão — exige autorização de Dados)
--
--   ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "endAt";
--   ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "durationMin";
--   ALTER TABLE "service_requests" DROP COLUMN IF EXISTS "scheduledHasTime";
--   ALTER TABLE "services"         DROP COLUMN IF EXISTS "defaultDurationMin";
--
-- Reverter apenas o CÓDIGO (sem DROP) é seguro: as colunas ficam órfãs e
-- ignoradas, e nenhum dado anterior à migration foi modificado.
-- ────────────────────────────────────────────────────────────────────────────
