# Golden Baseline — SQL manual e fora do schema Prisma

## Objetivo

Versionar, de forma reproduzível, tudo que compõe o "Golden Baseline" de um
banco Peteen (schema estrutural completo, sem dados) e que **não** é
totalmente representado pelo `prisma/schema.prisma` — porque o Prisma não tem
sintaxe para isso (índices parciais, RLS, policies) ou porque o item nunca foi
capturado em uma migration versionada.

Sem este arquivo, recriar um banco novo a partir de `prisma migrate deploy`
sozinho reproduziria o schema de tabelas/colunas/FKs, mas ficaria com RLS sem
nenhuma policy (banco inutilizável por qualquer client autenticado) e sem o
índice parcial `verification_requests_one_pending_per_entity`, que não existe
em nenhuma migration do repositório.

Este documento é puramente estrutural. **Não contém dados, usuários,
segredos, senhas, URLs assinadas, dump de conteúdo ou valores de env
sensíveis** — só DDL (definição de estrutura).

## Proveniência de cada item

Cada bloco abaixo é rotulado com uma das quatro origens possíveis:

- **Prisma** — já representado em `prisma/schema.prisma`; `prisma db push` ou
  `migrate deploy` recriam sozinhos.
- **Migration existente** — já existe em `prisma/migrations/*/migration.sql`;
  `migrate deploy` recria sozinho. Citado aqui só para completude do
  inventário, reexecutar é seguro (idempotente) mas redundante.
- **SQL manual** — não existe em nenhuma migration nem é representável no
  schema Prisma. Este documento é a única fonte de verdade versionada.
- **Default de plataforma Supabase** — já existe em qualquer projeto Supabase
  novo, antes de qualquer ação do time. Documentado aqui só para deixar claro
  que não precisa ser recriado manualmente.

## Ordem de aplicação do baseline

Em um projeto Supabase novo, vazio, nesta ordem exata:

1. `prisma db push` (ou `prisma migrate deploy`, se as migrations já
   estiverem íntegras) — cria as 29 tabelas de domínio, colunas, FKs, enums,
   índices normais.
2. Extensions (seção 1 abaixo).
3. Os 2 índices únicos parciais (seção 2).
4. RLS habilitado por tabela (seção 3) — na prática, redundante: ver nota da
   seção 3 sobre `rls_auto_enable`.
5. Funções custom + trigger (seção 5) — **antes** das policies, porque 27 das
   29 policies chamam `get_current_user_id()`.
6. Buckets de Storage (seção 6).
7. Policies de `public` (seção 4).
8. Policies de `storage.objects` (seção 7).
9. Validar parity contra o banco de referência (contagem de tabelas, policies,
   funções, extensions, buckets, índices parciais) antes de considerar o
   baseline completo.

---

## 1. Extensions

**Proveniência:** SQL manual (não representável em `schema.prisma`) — mas a
maioria delas coincide com o que o Supabase já cria por padrão em projeto
novo (marcado abaixo).

```sql
CREATE EXTENSION IF NOT EXISTS "cube";              -- manual — usado por earthdistance (busca por raio geográfico)
CREATE EXTENSION IF NOT EXISTS "earthdistance";     -- manual — cálculo de distância entre tutor e profissional
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- default de plataforma Supabase
CREATE EXTENSION IF NOT EXISTS "pg_trgm";           -- manual — busca textual (similaridade) usada em módulos de busca
CREATE EXTENSION IF NOT EXISTS "pgcrypto";          -- default de plataforma Supabase
CREATE EXTENSION IF NOT EXISTS "supabase_vault";    -- default de plataforma Supabase
CREATE EXTENSION IF NOT EXISTS "unaccent";          -- manual — normalização de acentos em busca por cidade/bairro
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";         -- default de plataforma Supabase
```

Confirmado por comparação direta contra um projeto Supabase recém-criado
vazio (Cutover Phase 1, 2026-08-31): `pg_stat_statements`, `pgcrypto`,
`supabase_vault` e `uuid-ossp` já vêm instaladas em qualquer projeto novo,
antes de qualquer DDL do time. As outras quatro (`cube`, `earthdistance`,
`pg_trgm`, `unaccent`) precisam ser criadas manualmente — são as únicas com
efeito real neste script.

## 2. Índices únicos parciais

**Não representáveis em `@@unique` do Prisma** (que não suporta cláusula
`WHERE`) — vivem fora do alcance de `prisma migrate diff` / `prisma db push`
inteiramente.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "services_professionalId_serviceType_active_key"
  ON public.services USING btree ("professionalId", "serviceType")
  WHERE ("isActive" = true);

CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_one_pending_per_entity
  ON public.verification_requests USING btree ("entityType", "entityId")
  WHERE (status = 'PENDING'::"VerificationRequestStatus");
```

**Proveniência de cada um, verificada por grep recursivo nas 9 pastas de
`prisma/migrations/`:**

- `services_professionalId_serviceType_active_key` — **Migration
  existente**: já é criado (com `IF NOT EXISTS`) por
  `prisma/migrations/20260801120000_service_uniqueness_concurrency_safety/migration.sql`.
  `prisma migrate deploy` recria sozinho. Citado aqui só para completude do
  inventário de índices parciais do baseline.

- `verification_requests_one_pending_per_entity` — **⚠️ SQL manual
  versionado obrigatório.** Não existe em nenhuma migration deste
  repositório. Foi aplicado diretamente ao banco em algum momento do
  histórico do projeto, sem qualquer rastro versionado até este documento.
  **Este bloco é a única fonte de verdade que resta para recriá-lo.** Sem
  ele, `prisma migrate deploy` sozinho NÃO o recria, e o sistema de
  verificação (Trust/Verification) fica sem a garantia de unicidade de
  solicitação pendente por entidade.

## 3. RLS (Row Level Security)

**Proveniência:** na prática, **default de plataforma Supabase** — não SQL
manual. Todo projeto Supabase novo vem com um event trigger de banco
(`ensure_rls`, disparado em `ddl_command_end`) que chama a função
`rls_auto_enable()` e habilita RLS automaticamente em toda tabela nova criada
em `public` — inclusive tabelas do próprio Prisma (`_prisma_migrations`
incluída). Confirmado na Cutover Phase 1: `prisma db push` sozinho, sem
nenhuma linha de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` rodada
manualmente, resultou nas 29 tabelas já com `relrowsecurity = true`.

O script abaixo é mantido por completude e por ser idempotente
(`ENABLE ROW LEVEL SECURITY` não falha se já habilitado) — mas não deve ser
tratado como o mecanismo real de proteção; o event trigger de plataforma é.

```sql
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
```

29 tabelas de domínio. A 30ª tabela eventualmente presente no schema
(`_prisma_migrations`, criada pelo próprio Prisma) recebe RLS pelo mesmo
event trigger, sem policies — inacessível via API pública (PostgREST),
acessível só por conexão direta com credencial de banco.

## 4. Policies de `public` (29)

**Proveniência:** SQL manual — não representável em `schema.prisma`.
Dependem de `get_current_user_id()` (seção 5), portanto devem ser criadas
depois das funções.

```sql
CREATE POLICY "admin_profiles: select own" ON public."admin_profiles"
  FOR SELECT
  USING (("userId" = get_current_user_id()));

CREATE POLICY "audit_logs: select own" ON public."audit_logs"
  FOR SELECT
  USING (("userId" = get_current_user_id()));

CREATE POLICY "crm_clients: insert own professional" ON public."crm_clients"
  FOR INSERT
  WITH CHECK (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

CREATE POLICY "crm_clients: select own professional" ON public."crm_clients"
  FOR SELECT
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

CREATE POLICY "crm_clients: update own professional" ON public."crm_clients"
  FOR UPDATE
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

CREATE POLICY "fraud_signals: select own target" ON public."fraud_signals"
  FOR SELECT
  USING (("targetUserId" = get_current_user_id()));

CREATE POLICY "partner_profiles: insert own" ON public."partner_profiles"
  FOR INSERT
  WITH CHECK (("userId" = get_current_user_id()));

CREATE POLICY "partner_profiles: select public" ON public."partner_profiles"
  FOR SELECT
  USING (("deletedAt" IS NULL));

CREATE POLICY "partner_profiles: update own" ON public."partner_profiles"
  FOR UPDATE
  USING (("userId" = get_current_user_id()));

CREATE POLICY "pets: insert own" ON public."pets"
  FOR INSERT
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

CREATE POLICY "pets: select own tutor" ON public."pets"
  FOR SELECT
  USING (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

CREATE POLICY "pets: update own" ON public."pets"
  FOR UPDATE
  USING (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

CREATE POLICY "professional_profiles: insert own" ON public."professional_profiles"
  FOR INSERT
  WITH CHECK (("userId" = get_current_user_id()));

CREATE POLICY "professional_profiles: select public" ON public."professional_profiles"
  FOR SELECT
  USING (("deletedAt" IS NULL));

CREATE POLICY "professional_profiles: update own" ON public."professional_profiles"
  FOR UPDATE
  USING (("userId" = get_current_user_id()));

CREATE POLICY "reviews: insert own tutor" ON public."reviews"
  FOR INSERT
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

CREATE POLICY "reviews: select visible" ON public."reviews"
  FOR SELECT
  USING ((("isVisible" = true) AND ("isFlagged" = false)));

CREATE POLICY "service_requests: insert tutor only" ON public."service_requests"
  FOR INSERT
  WITH CHECK (("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))));

CREATE POLICY "service_requests: select participants" ON public."service_requests"
  FOR SELECT
  USING ((("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))) OR ("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id())))));

CREATE POLICY "service_requests: update participants" ON public."service_requests"
  FOR UPDATE
  USING ((("tutorId" IN ( SELECT tutor_profiles.id
   FROM tutor_profiles
  WHERE (tutor_profiles."userId" = get_current_user_id()))) OR ("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id())))));

CREATE POLICY "services: insert own" ON public."services"
  FOR INSERT
  WITH CHECK (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

CREATE POLICY "services: select public" ON public."services"
  FOR SELECT
  USING (("isActive" = true));

CREATE POLICY "services: update own" ON public."services"
  FOR UPDATE
  USING (("professionalId" IN ( SELECT professional_profiles.id
   FROM professional_profiles
  WHERE (professional_profiles."userId" = get_current_user_id()))));

CREATE POLICY "trust_events: select own" ON public."trust_events"
  FOR SELECT
  USING ((("actorId" = get_current_user_id()) OR ("targetId" = get_current_user_id())));

CREATE POLICY "tutor_profiles: insert own" ON public."tutor_profiles"
  FOR INSERT
  WITH CHECK (("userId" = get_current_user_id()));

CREATE POLICY "tutor_profiles: select public" ON public."tutor_profiles"
  FOR SELECT
  USING (("deletedAt" IS NULL));

CREATE POLICY "tutor_profiles: update own" ON public."tutor_profiles"
  FOR UPDATE
  USING (("userId" = get_current_user_id()));

CREATE POLICY "users: select own" ON public."users"
  FOR SELECT
  USING (("authId" = ( SELECT auth.uid() AS uid)));

CREATE POLICY "users: update own" ON public."users"
  FOR UPDATE
  USING (("authId" = ( SELECT auth.uid() AS uid)));
```

29 policies. Tabelas de domínio sem policy própria (ex.: `care_media`,
`care_updates`, `disputes`, `neighborhoods`, `regions`, `push_subscriptions`,
`push_deliveries`, `trust_connections`, `tutor_professional_relationships`,
`operational_flags`, `admin_audit_logs`, `invite_visits`,
`notification_reads`) ficam com RLS habilitado e **zero policies** — ou seja,
bloqueadas por padrão para qualquer role que não seja `service_role`. Acesso
a essas tabelas acontece via Server Actions/rotas Node.js usando a chave de
serviço, nunca via cliente Supabase direto do browser — decisão deliberada de
superfície, não lacuna.

## 5. Funções custom e trigger

**Proveniência mista:**

- `get_current_user_id()` — **SQL manual**, código específico do domínio
  Peteen (mapeia `auth.uid()` para o `id` interno em `public.users`).
- `handle_new_user()` — **SQL manual**, específico do domínio (cria a linha
  em `public.users` no cadastro).
- `rls_auto_enable()` — **default de plataforma Supabase**. Já existe em
  qualquer projeto novo, com corpo idêntico, antes de qualquer ação do time.
  Incluída aqui só por completude do inventário (recriar não tem efeito,
  `CREATE OR REPLACE` é idempotente).
- Trigger `on_auth_user_created` — **SQL manual**, liga `handle_new_user()` ao
  evento de criação de usuário no Supabase Auth.

```sql
CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.users
  WHERE "authId" = auth.uid()
  LIMIT 1;
$function$
;

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
$function$
;

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
$function$
;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

## 6. Buckets de Storage (5)

**Proveniência:** SQL manual — Storage não é modelado pelo Prisma de forma
alguma.

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('care-media', 'care-media', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('care-media-video', 'care-media-video', false, 52428800, ARRAY['video/mp4','video/quicktime'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 10485760, ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pets', 'pets', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
```

## 7. Policies de `storage.objects` (10)

**Proveniência:** SQL manual.

```sql
CREATE POLICY "Public read access for avatars" ON storage."objects"
  FOR SELECT
  USING ((bucket_id = 'avatars'::text));

CREATE POLICY "avatars: authenticated upload" ON storage."objects"
  FOR INSERT
  WITH CHECK (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "avatars: owner delete" ON storage."objects"
  FOR DELETE
  USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "avatars: owner update" ON storage."objects"
  FOR UPDATE
  USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "documents: owner read" ON storage."objects"
  FOR SELECT
  USING (((bucket_id = 'documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "documents: owner upload" ON storage."objects"
  FOR INSERT
  WITH CHECK (((bucket_id = 'documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "pets: authenticated upload" ON storage."objects"
  FOR INSERT
  WITH CHECK (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "pets: owner delete" ON storage."objects"
  FOR DELETE
  USING (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "pets: owner update" ON storage."objects"
  FOR UPDATE
  USING (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "pets: public read specific" ON storage."objects"
  FOR SELECT
  USING (((bucket_id = 'pets'::text) AND (name IS NOT NULL)));
```

`care-media` e `care-media-video` não têm policy própria em
`storage.objects` — são buckets privados acessados exclusivamente por
Server Actions com a service role key (URLs assinadas geradas no servidor),
nunca pelo cliente Supabase do browser diretamente. Ausência deliberada, não
lacuna.

## Resumo de proveniência

| Item | Proveniência |
|---|---|
| 29 tabelas, colunas, FKs, enums | Prisma (`schema.prisma`) |
| `services_professionalId_serviceType_active_key` | Migration existente (`20260801120000_service_uniqueness_concurrency_safety`) |
| `verification_requests_one_pending_per_entity` | **SQL manual — obrigatório** |
| RLS habilitado (29 tabelas de domínio + `_prisma_migrations`) | Default de plataforma Supabase (`ensure_rls` / `rls_auto_enable`) |
| 29 policies de `public` | SQL manual |
| `get_current_user_id()`, `handle_new_user()` | SQL manual |
| `rls_auto_enable()` | Default de plataforma Supabase |
| Trigger `on_auth_user_created` | SQL manual |
| 5 buckets de Storage | SQL manual |
| 10 policies de `storage.objects` | SQL manual |
| `pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp` | Default de plataforma Supabase |
| `cube`, `earthdistance`, `pg_trgm`, `unaccent` | SQL manual |

---

## FUTURE MIGRATION CONTRACT

A partir do banco PROD novo (Cutover Phase 1, projeto `peteen-prod`), o
workflow de mudança de schema muda:

- **Toda mudança de schema → migration.** `prisma migrate dev` (local) gera o
  arquivo; nunca editar `_prisma_migrations` ou o banco de produção à mão.
- **Produção → `prisma migrate deploy`.** Nunca `db push` contra o banco de
  produção — `db push` não gera histórico em `_prisma_migrations` e é
  exatamente o mecanismo que criou o débito que este documento existe para
  reparar.
- **`db push` fica restrito a ambientes descartáveis** (local, DEMO/QA) onde
  não há necessidade de histórico auditável.
- **DDL manual novo (índice parcial, policy, função, bucket) deve ser
  versionado e documentado no mesmo ciclo em que é aplicado** — atualizando
  este arquivo (ou um novo `*_DDL_GATE.md` para uma mudança isolada e
  significativa, seguindo a convenção de `docs/CARE_TIMELINE_VIDEO_V0_DDL_GATE.md`).
  Nunca aplicar DDL diretamente no banco vivo sem esse registro: é exatamente
  esse hábito que deixou `verification_requests_one_pending_per_entity` sem
  nenhum rastro por todo o histórico anterior do projeto.
