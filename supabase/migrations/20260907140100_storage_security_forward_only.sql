-- GATE-18-PHASE-A-SECURITY-SOURCE-OF-TRUTH-017
--
-- Source of truth das policies de `storage.objects`, e correcao FORWARD-ONLY do
-- caso avatars.
--
-- POR QUE NAO ESTA EM prisma/migrations/
-- `storage.objects` pertence a `supabase_storage_admin`. CREATE POLICY exige ser
-- dono da tabela, e o papel `postgres` -- que e quem o Prisma usa -- NAO pertence
-- a esse papel nem e superuser (verificado por pg_has_role, inclusive
-- transitivamente). Uma migration Prisma com estas policies falharia. A divisao
-- nao e estilistica: e imposta pela posse da tabela, e coincide com a matriz de
-- ownership ja registrada em docs/MIGRATION_DEPLOY_RUNBOOK.md.
--
-- APLICAR com um papel administrativo (SQL editor do Supabase).
--
-- CORRECAO FORWARD-ONLY DO INCIDENTE P1
-- `supabase/migrations/20260720000000_avatars_bucket_rls_policies.sql` declara
-- duas policies de escrita que checam apenas `bucket_id = 'avatars'`, sem
-- verificar dono -- a forma exata do incidente P1, em que qualquer autenticado
-- sobrescrevia o avatar de qualquer outro. Elas NAO existem em PROD nem em DEMO;
-- o arquivo e uma regressao latente, perigosa apenas se replayada.
--
-- Aquele arquivo NAO foi editado: historico aplicado nao se reescreve. Esta
-- migration remove os nomes stale (se existirem) e declara a forma segura, tudo
-- na mesma transacao -- nao ha instante em que o bucket fique sem policy ou com
-- a forma permissiva.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. REMOCAO DAS POLICIES PERMISSIVAS CONHECIDAS (nomes stale do P1)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2. FORMA SEGURA ATUAL (10 policies)
-- ---------------------------------------------------------------------------
-- Transcritas do catalogo vivo, confirmadas identicas entre PROD e DEMO.
-- As policies de escrita de `avatars` e `pets` verificam posse por
-- `(storage.foldername(name))[1] = auth.uid()::text`.
--
-- `care-media` e `care-media-video` NAO tem policy, e isso e proposital: sao
-- buckets privados servidos por service-role + signed URL, que contorna RLS por
-- design. Criar policy para eles seria inventar superficie de acesso que a
-- arquitetura atual nao tem.

DROP POLICY IF EXISTS "Public read access for avatars" ON storage."objects";
CREATE POLICY "Public read access for avatars" ON storage."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "avatars: authenticated upload" ON storage."objects";
CREATE POLICY "avatars: authenticated upload" ON storage."objects"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "avatars: owner delete" ON storage."objects";
CREATE POLICY "avatars: owner delete" ON storage."objects"
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "avatars: owner update" ON storage."objects";
CREATE POLICY "avatars: owner update" ON storage."objects"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "documents: owner read" ON storage."objects";
CREATE POLICY "documents: owner read" ON storage."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((bucket_id = 'documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "documents: owner upload" ON storage."objects";
CREATE POLICY "documents: owner upload" ON storage."objects"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "pets: authenticated upload" ON storage."objects";
CREATE POLICY "pets: authenticated upload" ON storage."objects"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "pets: owner delete" ON storage."objects";
CREATE POLICY "pets: owner delete" ON storage."objects"
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "pets: owner update" ON storage."objects";
CREATE POLICY "pets: owner update" ON storage."objects"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "pets: public read specific" ON storage."objects";
CREATE POLICY "pets: public read specific" ON storage."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((bucket_id = 'pets'::text) AND (name IS NOT NULL)));

COMMIT;
