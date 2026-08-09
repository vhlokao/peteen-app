-- Push Notifications Foundation V0 — subscription de device + registro de
-- despacho por evento lógico.
--
-- Migration ADITIVA. Cria DUAS tabelas novas. NÃO altera nenhuma tabela
-- existente, NÃO faz backfill, NÃO toca dados. Não usa `prisma db push` —
-- segue o mesmo mecanismo versionado das migrations anteriores do projeto.
--
-- ⚠ REEXECUTÁVEL SOMENTE APÓS PRÉ-CHECK DO ESTADO ESPERADO — NÃO é idempotente.
--
-- As cláusulas IF NOT EXISTS abaixo NÃO validam estrutura, apenas NOME:
--
--   * CREATE TABLE IF NOT EXISTS pula silenciosamente se já existir uma tabela
--     homônima, ainda que com colunas completamente diferentes. Os CREATE INDEX
--     seguintes então falhariam (colunas inexistentes) — ou, pior, teriam
--     sucesso sobre a estrutura errada.
--   * CREATE INDEX IF NOT EXISTS pula se já existir índice de mesmo NOME, ainda
--     que sobre outras colunas. A migration reportaria sucesso enquanto o índice
--     pretendido não existe.
--
-- Ou seja: tabela ou índice homônimo INCOMPATÍVEL não é protegido por nada aqui.
-- A segurança da aplicação vem do PRÉ-CHECK OBRIGATÓRIO, que é parte inseparável
-- do procedimento — não das cláusulas IF NOT EXISTS.
--
-- PRÉ-CHECK (ambas as consultas DEVEM retornar 0; se não, PARE):
--
--   SELECT COUNT(*) FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('push_subscriptions','push_deliveries');
--
--   SELECT COUNT(*) FROM pg_indexes
--    WHERE schemaname='public' AND indexname LIKE 'push_%';
--
-- O corpo está envolvido em BEGIN/COMMIT: o Postgres tem DDL transacional, então
-- uma falha em qualquer statement reverte a migration inteira (atômica), em vez
-- de deixar um estado parcial retomável. Isso também elimina a janela transitória
-- sem FK criada pelo par DROP CONSTRAINT / ADD CONSTRAINT numa reexecução.
--
-- `users` NÃO recebe coluna: as relações inversas declaradas em schema.prisma
-- (pushSubscriptions / pushDeliveries) são virtuais do Prisma; as FKs vivem
-- aqui, nas tabelas filhas. As duas únicas linhas que mencionam `users` abaixo
-- são REFERENCES de FK, não alterações de estrutura.
--
-- ────────────────────────────────────────────────────────────────────────
-- push_subscriptions
--
-- Identidade do device = `endpoint` (contrato do padrão Web Push). Sem
-- fingerprint de userAgent: o endpoint já é único por browser+origem e é o
-- único identificador que o push service reconhece.
--
-- `endpoint`, `p256dh` e `auth` são NULLABLE de propósito. A revogação anula
-- os três e preenche revokedAt/revokedReason, preservando `endpointHash`:
--
--   1. Libera o unique de `endpoint` para o mesmo device voltar a assinar sem
--      apagarmos a linha antiga (apagar destruiria a trilha de qual usuário
--      usou este device e até quando).
--   2. Remove material de chave no instante em que perde utilidade — endpoint
--      + p256dh + auth juntos permitem ENVIAR push para o aparelho.
--   3. `endpointHash` (SHA-256) sobrevive e permite correlacionar devices sem
--      guardar o segredo.
--
-- Por que não um índice único parcial (WHERE "revokedAt" IS NULL), como foi
-- feito em services_professionalId_serviceType_active_key: lá o predicado era
-- inevitável porque as colunas do unique não podiam ser anuladas. Aqui, anular
-- o endpoint resolve o mesmo problema de forma DECLARÁVEL em schema.prisma
-- (Prisma v7 não suporta WHERE em @@unique) — evitando o drift permanente entre
-- schema e banco que um índice parcial invisível ao Prisma introduziria. No
-- Postgres, NULLs são distintos por padrão em índice único: infinitas linhas
-- revogadas convivem com no máximo uma ativa por endpoint.
--
-- ────────────────────────────────────────────────────────────────────────
-- push_deliveries
--
-- Um evento lógico para um destinatário em um canal.
--
-- O unique (eventKey, recipientUserId, channel) É a trava de idempotência: o
-- INSERT acontece ANTES de qualquer envio e uma violação (P2002) significa
-- "já processado" — retorna em silêncio, sem segundo envio. Garante
-- at-most-once, viés correto porque a central in-app é a fonte da verdade
-- (perder push é aceitável; duplicar é spam). Sem advisory lock: é um único
-- INSERT atômico, não um read-then-write como o caso da agenda.
--
-- `eventType` e `entityId` são desnormalizados e descritivos — existem só para
-- observabilidade e NUNCA participam do dedup, mantendo `eventKey` opaco e
-- evolutivo sem perder as dimensões de análise.
--
-- `acceptedCount` = aceite pelo PUSH SERVICE, não entrega ao device. Não
-- existem `deliveredCount` nem `readCount`: não são observáveis por Web Push.
--
-- Privacidade: nenhuma coluna guarda title, body, URL, endpoint ou conteúdo de
-- entidade. Só ids técnicos, rótulos e contadores. `lastError` é código/motivo
-- curto (VARCHAR(120)), nunca corpo de resposta.
--
-- Rollback: ver bloco comentado ao final. Não executar nesta missão.
-- ────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" VARCHAR(1000),
  "p256dh" TEXT,
  "auth" TEXT,
  "endpointHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" VARCHAR(40),

  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "push_deliveries" (
  "id" TEXT NOT NULL,
  "eventKey" VARCHAR(200) NOT NULL,
  "eventType" VARCHAR(60) NOT NULL,
  "entityId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "channel" VARCHAR(20) NOT NULL DEFAULT 'push',
  "attemptedCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- Identidade do device enquanto ativo. NULLs (revogados) são distintos no
-- Postgres — por isso infinitas linhas revogadas convivem com uma ativa.
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
  ON "push_subscriptions"("endpoint");

-- Índice quente: é exatamente o WHERE do dispatch (subscriptions ativas de um
-- destinatário) e o do teto de devices por usuário.
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_revokedAt_idx"
  ON "push_subscriptions"("userId", "revokedAt");

-- Correlação de device pós-revogação, sem o segredo.
CREATE INDEX IF NOT EXISTS "push_subscriptions_endpointHash_idx"
  ON "push_subscriptions"("endpointHash");

-- TRAVA DE IDEMPOTÊNCIA — o INSERT que viola este índice é o próprio sinal de
-- "evento já despachado".
CREATE UNIQUE INDEX IF NOT EXISTS "push_deliveries_eventKey_recipientUserId_channel_key"
  ON "push_deliveries"("eventKey", "recipientUserId", "channel");

-- Observabilidade: taxa de aceite por tipo de evento numa janela.
CREATE INDEX IF NOT EXISTS "push_deliveries_eventType_createdAt_idx"
  ON "push_deliveries"("eventType", "createdAt");

-- Observabilidade: todos os despachos de uma entidade.
CREATE INDEX IF NOT EXISTS "push_deliveries_entityId_idx"
  ON "push_deliveries"("entityId");

-- Varredura de retenção (90 dias) pelo cron diário já existente.
CREATE INDEX IF NOT EXISTS "push_deliveries_createdAt_idx"
  ON "push_deliveries"("createdAt");

-- FKs. ON DELETE CASCADE: device binding e telemetria de push não têm
-- significado sem o usuário, e apagá-los junto é o comportamento correto para
-- direito de exclusão. Na prática o caminho real é o soft delete
-- (users.deletedAt), que exige revogação lógica explícita na aplicação —
-- cascade cobre apenas o hard delete.
--
-- push_deliveries: o CASCADE aqui é DECISÃO DELIBERADA, e diverge do padrão que
-- o banco usa para as demais tabelas de histórico ligadas a users
-- (audit_logs, admin_audit_logs, care_updates, disputes, fraud_signals e
-- trust_events usam RESTRICT). A divergência é intencional porque PushDelivery é
-- TELEMETRIA OPERACIONAL com retenção limitada (90 dias), NÃO registro
-- probatório como AuditLog, TrustEvent ou Dispute: não sustenta reputação, não
-- serve de evidência em disputa e não precisa sobreviver ao titular. Para
-- exclusão de dados do usuário, apagar junto é exatamente o comportamento
-- desejado.
--
-- Nota factual: na prática este CASCADE é inerte para usuário real — as 7
-- constraints RESTRICT acima já impedem hard delete de qualquer User com
-- histórico (e audit_logs é escrito em praticamente toda ação relevante).
ALTER TABLE "push_subscriptions"
  DROP CONSTRAINT IF EXISTS "push_subscriptions_userId_fkey";

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_deliveries"
  DROP CONSTRAINT IF EXISTS "push_deliveries_recipientUserId_fkey";

ALTER TABLE "push_deliveries"
  ADD CONSTRAINT "push_deliveries_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────
-- ROLLBACK (não executar nesta missão — exige autorização de Dados)
--
--   DROP TABLE IF EXISTS "push_deliveries";
--   DROP TABLE IF EXISTS "push_subscriptions";
--
-- Ordem irrelevante entre as duas (não se referenciam). Os índices e as FKs
-- caem junto com as tabelas.
--
-- Reverter é seguro e NÃO perde nenhum dado pré-existente: as duas tabelas são
-- criadas vazias por esta migration e nenhuma linha de tabela anterior é lida,
-- escrita ou alterada. O único dado perdido no rollback é o que a própria
-- funcionalidade de push tiver produzido depois de aplicada.
-- ────────────────────────────────────────────────────────────────────────
