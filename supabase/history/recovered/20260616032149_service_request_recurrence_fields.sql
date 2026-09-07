-- Campos de suporte à recorrência futura em service_requests
-- isRecurring + parentRequestId já existiam (cadeia histórica)
-- Adicionando: seriesId, recurrenceRule, recurrenceEndsAt, nextScheduledAt
-- Todos nullable — zero impacto em requests únicos (Fase 3)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS "seriesId"         TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceRule"   TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextScheduledAt"  TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "service_requests_seriesId_idx"
  ON public.service_requests ("seriesId");