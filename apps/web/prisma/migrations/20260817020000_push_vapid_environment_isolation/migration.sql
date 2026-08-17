-- Push Reliability — isolamento de ambiente por fingerprint da chave VAPID.
--
-- CONTEXTO (incidente reproduzido): produção e localhost usam pares VAPID
-- diferentes e compartilham o mesmo Supabase. O dispatcher local enxergava as
-- subscriptions criadas em produção e tentava assiná-las com a chave errada;
-- o FCM respondia 403 "the VAPID credentials in the authorization header do
-- not correspond to the credentials used to create the subscriptions". Sem
-- barreira, um ambiente de desenvolvimento também poderia acordar o aparelho
-- de um usuário real.
--
-- Migration ADITIVA. Adiciona UMA coluna NULLABLE a `push_subscriptions` e UM
-- índice. NÃO faz backfill, NÃO altera dado existente, NÃO remove nada, NÃO
-- revoga subscription alguma.
--
-- POR QUE NULLABLE E SEM BACKFILL: as linhas existentes são, quase certamente,
-- de produção — mas "quase certamente" não é prova. Preencher tudo com o
-- fingerprint de produção seria afirmar no banco algo que não foi verificado.
-- O valor só é gravado quando o próprio push service confirma compatibilidade
-- (ver a política `legacy_producao` em dispatch-push.ts). NULL significa
-- exatamente "ainda não sabemos", e é assim que deve ser lido.
--
-- ⚠ REEXECUTÁVEL SOMENTE APÓS PRÉ-CHECK DO ESTADO ESPERADO — NÃO é idempotente.
--
-- Mesma ressalva das migrations anteriores deste projeto: `IF NOT EXISTS`
-- valida apenas NOME, nunca estrutura. A segurança vem do PRÉ-CHECK, que é
-- parte inseparável do procedimento.
--
-- PRÉ-CHECK (as duas consultas DEVEM retornar 0; se não, PARE):
--
--   SELECT COUNT(*) FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='push_subscriptions'
--      AND column_name='vapidKeyFingerprint';
--
--   SELECT COUNT(*) FROM pg_indexes
--    WHERE schemaname='public' AND indexname='push_subscriptions_vapidKeyFingerprint_idx';
--
-- PÓS-CHECK esperado: a coluna existe e TODAS as linhas seguem com NULL —
-- nenhuma migration deve preencher fingerprint.
--
--   SELECT COUNT(*) FROM push_subscriptions WHERE "vapidKeyFingerprint" IS NOT NULL;
--   -- deve retornar 0 imediatamente após a migration.

ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "vapidKeyFingerprint" VARCHAR(64);

-- O dispatcher filtra por (userId, revokedAt) e depois compara fingerprint.
-- Este índice serve à observação operacional ("quantas linhas ainda são
-- legado?") e a uma futura reconciliação — não ao caminho quente do envio.
CREATE INDEX IF NOT EXISTS "push_subscriptions_vapidKeyFingerprint_idx"
  ON "push_subscriptions" ("vapidKeyFingerprint");
