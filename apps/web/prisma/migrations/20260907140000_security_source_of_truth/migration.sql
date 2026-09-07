-- GATE-18-PHASE-A-SECURITY-SOURCE-OF-TRUTH-017
--
-- Source of truth EXECUTAVEL da camada de seguranca do schema `public`.
--
-- POR QUE ESTA MIGRATION EXISTE
-- Ate aqui, nada no repositorio criava as 29 policies de `public`, as funcoes
-- auxiliares de autenticacao, o RLS das tabelas ou o event trigger. Um ambiente
-- reconstruido apenas a partir deste repo nasceria com as tabelas SEM RLS. Sob o
-- default ACL do Supabase isso significa leitura e escrita abertas via anon key.
-- O estado aqui declarado foi medido e confirmado IDENTICO em PROD e DEMO
-- (GATE-18-PROD-RECONSTRUCTION-RECONCILIATION-015).
--
-- FORWARD-ONLY E IDEMPOTENTE
-- Segura para: ambiente vazio, DEMO atual e PROD atual. Nao apaga dados, nao
-- recria tabela, nao altera coluna, nao mexe em GRANT/default ACL e nao altera
-- semantica de Trust/Ranking/Recommendation/Antifraude -- as policies dessas
-- areas sao reproduzidas exatamente como ja existem.
--
-- ORDEM: funcoes antes das policies, porque 27 das 29 chamam get_current_user_id().

-- ---------------------------------------------------------------------------
-- 1. FUNCOES AUXILIARES DE IDENTIDADE
-- ---------------------------------------------------------------------------
-- Corpos transcritos do catalogo vivo (SHA-256 conferido identico entre PROD e
-- DEMO). `CREATE OR REPLACE` e idempotente por natureza.

CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.users
  WHERE "authId" = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id TEXT;
BEGIN
  -- Gera um ID único compatível com cuid (prefixo 'c' + timestamp + random)
  new_id := 'c' || to_hex(extract(epoch from now())::bigint) || substr(md5(random()::text), 1, 16);

  INSERT INTO public.users (
    id,
    "authId",
    email,
    "createdAt",
    "updatedAt"
  ) VALUES (
    new_id,
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT ("authId") DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. SINCRONIA auth.users -> public.users
-- ---------------------------------------------------------------------------
-- `auth.users` pertence a `supabase_auth_admin`, mas `postgres` tem privilegio
-- TRIGGER sobre ela (verificado via has_table_privilege), entao esta migration
-- pode gerenciar o trigger. DROP + CREATE porque CREATE TRIGGER nao aceita
-- OR REPLACE em todas as versoes suportadas.
--
-- UNICO ponto deste arquivo que NAO e transcricao literal do catalogo: o
-- `pg_get_triggerdef` emite `EXECUTE FUNCTION handle_new_user()` sem schema, o
-- que depende do search_path na hora da execucao. Aqui esta qualificado como
-- `public.handle_new_user()`. Nao muda comportamento -- a funcao so existe em
-- `public` -- apenas remove a fragilidade em ambiente novo.

DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. RLS AUTOMATICO EM TABELAS NOVAS (defesa em profundidade)
-- ---------------------------------------------------------------------------
-- Existe em PROD e DEMO com corpo byte-identico. A origem historica NAO esta
-- provada: nao aparece em nenhuma das 27 migrations conhecidas, e o perfil de
-- posse (dono `postgres`, schema `public`) nao bate com o dos event triggers de
-- plataforma do Supabase (dono `supabase_admin`, schema `extensions`).
-- Ate que a origem seja provada, tratamos como estado desejado do produto.
--
-- Isto e um BACKSTOP, nao a protecao principal: a secao 4 liga RLS
-- explicitamente em cada tabela atual, sem depender deste gatilho.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- CREATE EVENT TRIGGER nao aceita IF NOT EXISTS, e criar event trigger exige
-- privilegio elevado que o papel `postgres` do Supabase pode nao ter
-- (rolsuper = false). Em PROD e DEMO o gatilho JA existe, entao este bloco e
-- no-op. Num ambiente novo, se faltar privilegio, emitimos WARNING em vez de
-- abortar a migration inteira -- a protecao real (secao 4) nao depende disto.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    BEGIN
      CREATE EVENT TRIGGER ensure_rls
        ON ddl_command_end
        WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
        EXECUTE FUNCTION public.rls_auto_enable();
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE WARNING 'ensure_rls nao criado: privilegio insuficiente. Crie-o com um papel administrativo. O RLS explicito da secao 4 permanece valido.';
      WHEN OTHERS THEN
        RAISE WARNING 'ensure_rls nao criado (%): %. O RLS explicito da secao 4 permanece valido.', SQLSTATE, SQLERRM;
    END;
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY EXPLICITO
-- ---------------------------------------------------------------------------
-- 29 tabelas de dominio. Idempotente: ENABLE em tabela que ja tem RLS e no-op.
--
-- `_prisma_migrations` fica DE FORA de proposito: e metadado da ferramenta, nao
-- dado de dominio. Hoje ela aparece com RLS no banco apenas como efeito colateral
-- do event trigger acima, nunca por decisao. Inclui-la criaria dependencia entre a
-- camada de seguranca e a tabela que rastreia esta propria migration, sem ganho:
-- `postgres` e dono e contorna RLS de qualquer forma.

ALTER TABLE public."admin_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."care_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."care_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fraud_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."invite_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."neighborhoods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operational_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partner_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."professional_availabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."professional_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."trust_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."trust_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tutor_professional_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tutor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."verification_requests" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. POLICIES DE public (29)
-- ---------------------------------------------------------------------------
-- Transcritas do catalogo vivo. DROP IF EXISTS + CREATE torna a aplicacao
-- convergente: o estado final e exatamente o declarado aqui, venha o banco de
-- onde vier. Como as expressoes sao as MESMAS ja vigentes em PROD e DEMO,
-- nenhum ambiente e afrouxado.
--
-- As policies de `trust_events` e `fraud_signals` sao reproducao literal do que
-- ja existe -- nenhuma regra de Trust ou Antifraude foi criada ou reinterpretada.

DROP POLICY IF EXISTS "admin_profiles: select own" ON public."admin_profiles";
CREATE POLICY "admin_profiles: select own" ON public."admin_profiles"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "audit_logs: select own" ON public."audit_logs";
CREATE POLICY "audit_logs: select own" ON public."audit_logs"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "crm_clients: insert own professional" ON public."crm_clients";
CREATE POLICY "crm_clients: insert own professional" ON public."crm_clients"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "crm_clients: select own professional" ON public."crm_clients";
CREATE POLICY "crm_clients: select own professional" ON public."crm_clients"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "crm_clients: update own professional" ON public."crm_clients";
CREATE POLICY "crm_clients: update own professional" ON public."crm_clients"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "fraud_signals: select own target" ON public."fraud_signals";
CREATE POLICY "fraud_signals: select own target" ON public."fraud_signals"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("targetUserId" = get_current_user_id()));

DROP POLICY IF EXISTS "partner_profiles: insert own" ON public."partner_profiles";
CREATE POLICY "partner_profiles: insert own" ON public."partner_profiles"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "partner_profiles: select public" ON public."partner_profiles";
CREATE POLICY "partner_profiles: select public" ON public."partner_profiles"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("deletedAt" IS NULL));

DROP POLICY IF EXISTS "partner_profiles: update own" ON public."partner_profiles";
CREATE POLICY "partner_profiles: update own" ON public."partner_profiles"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "pets: insert own" ON public."pets";
CREATE POLICY "pets: insert own" ON public."pets"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "pets: select own tutor" ON public."pets";
CREATE POLICY "pets: select own tutor" ON public."pets"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "pets: update own" ON public."pets";
CREATE POLICY "pets: update own" ON public."pets"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "professional_profiles: insert own" ON public."professional_profiles";
CREATE POLICY "professional_profiles: insert own" ON public."professional_profiles"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "professional_profiles: select public" ON public."professional_profiles";
CREATE POLICY "professional_profiles: select public" ON public."professional_profiles"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("deletedAt" IS NULL));

DROP POLICY IF EXISTS "professional_profiles: update own" ON public."professional_profiles";
CREATE POLICY "professional_profiles: update own" ON public."professional_profiles"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "reviews: insert own tutor" ON public."reviews";
CREATE POLICY "reviews: insert own tutor" ON public."reviews"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "reviews: select visible" ON public."reviews";
CREATE POLICY "reviews: select visible" ON public."reviews"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((("isVisible" = true) AND ("isFlagged" = false)));

DROP POLICY IF EXISTS "service_requests: insert tutor only" ON public."service_requests";
CREATE POLICY "service_requests: insert tutor only" ON public."service_requests"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "service_requests: select participants" ON public."service_requests";
CREATE POLICY "service_requests: select participants" ON public."service_requests"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))) OR ("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id())))));

DROP POLICY IF EXISTS "service_requests: update participants" ON public."service_requests";
CREATE POLICY "service_requests: update participants" ON public."service_requests"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))) OR ("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id())))));

DROP POLICY IF EXISTS "services: insert own" ON public."services";
CREATE POLICY "services: insert own" ON public."services"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "services: select public" ON public."services";
CREATE POLICY "services: select public" ON public."services"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("isActive" = true));

DROP POLICY IF EXISTS "services: update own" ON public."services";
CREATE POLICY "services: update own" ON public."services"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

DROP POLICY IF EXISTS "trust_events: select own" ON public."trust_events";
CREATE POLICY "trust_events: select own" ON public."trust_events"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((("actorId" = get_current_user_id()) OR ("targetId" = get_current_user_id())));

DROP POLICY IF EXISTS "tutor_profiles: insert own" ON public."tutor_profiles";
CREATE POLICY "tutor_profiles: insert own" ON public."tutor_profiles"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "tutor_profiles: select public" ON public."tutor_profiles";
CREATE POLICY "tutor_profiles: select public" ON public."tutor_profiles"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("deletedAt" IS NULL));

DROP POLICY IF EXISTS "tutor_profiles: update own" ON public."tutor_profiles";
CREATE POLICY "tutor_profiles: update own" ON public."tutor_profiles"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("userId" = get_current_user_id()));

DROP POLICY IF EXISTS "users: select own" ON public."users";
CREATE POLICY "users: select own" ON public."users"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("authId" = ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS "users: update own" ON public."users";
CREATE POLICY "users: update own" ON public."users"
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (("authId" = ( SELECT auth.uid() AS uid)));
