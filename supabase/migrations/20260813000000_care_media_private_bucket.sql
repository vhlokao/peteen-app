-- Care Operations V0 — R1: fundação de Storage privado para mídia do Diário de cuidado.
--
-- Cria o bucket `care-media`, PRIVADO, onde ficarão as fotos publicadas pelo
-- profissional dentro de um atendimento. Nenhum código de produto usa este
-- bucket ainda: R1 entrega apenas a fundação (bucket + política + helper +
-- autorização). CareMedia, upload visual e publicação chegam em R2.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE ESTE BUCKET NÃO PODE SEGUIR O PADRÃO DE `pets`/`avatars`
--
-- Os buckets existentes são PÚBLICOS e servem por `getPublicUrl()`, uma URL
-- permanente e não revogável: quem tem o link vê para sempre, sem nenhuma
-- verificação de que ainda é participante de nada. Para foto de perfil isso é
-- aceitável. Para a foto do pet de outra pessoa dentro de um atendimento,
-- não é — é conteúdo privado de um serviço entre duas partes.
--
-- Aqui o acesso é SEMPRE por URL assinada de curta duração, emitida pelo
-- servidor só depois de verificar, no domínio, que quem pede é participante
-- daquela ServiceRequest.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE NENHUMA POLICY DE RLS É CRIADA PARA ESTE BUCKET
--
-- Intencional, e a ausência É a política. `storage.objects` tem RLS habilitado
-- (verificado: relrowsecurity = true) e, sem nenhuma policy permissiva que
-- case, o Postgres NEGA. Auditoria das policies existentes no banco real
-- confirmou que TODAS são escopadas por `bucket_id = '<nome>'`
-- (avatars, pets, documents) — nenhuma delas alcança um bucket novo. Portanto
-- `care-media` nasce inacessível para os papéis `anon` e `authenticated`:
-- nem leitura, nem escrita, nem listagem, nem com a anon key vazada.
--
-- O acesso legítimo acontece por dois caminhos, ambos fora do alcance de RLS:
--   1. service_role no servidor (bypassa RLS) — emite as URLs assinadas;
--   2. as próprias URLs assinadas, validadas pela API de Storage como
--      capabilities de uso único/curta duração.
--
-- Uma policy de RLS NÃO conseguiria expressar a regra real ("é o profissional
-- desta request, que está IN_PROGRESS, sem disputa aberta") sem consultar
-- tabelas do schema `public` de dentro do schema `storage`. Isso criaria uma
-- SEGUNDA fonte de verdade de autorização, capaz de divergir silenciosamente
-- da regra do domínio. Preferimos uma única porta de autorização, no domínio,
-- e um bucket que nega tudo por padrão.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LIMITES NO PRÓPRIO BUCKET
--
-- `file_size_limit` e `allowed_mime_types` são a PRIMEIRA barreira, aplicada
-- pelo próprio Storage no momento do upload — inclusive em upload direto por
-- URL assinada, quando o servidor não vê os bytes. Não substituem a validação
-- por magic bytes: `allowed_mime_types` confere o Content-Type DECLARADO, que
-- é escolhido pelo cliente. A verificação do conteúdo real acontece no
-- servidor, depois do upload e antes de a mídia ser publicada (ver
-- lib/storage/care-media.ts → readCareMediaHeader).
--
-- 5 MB e JPEG/PNG/WebP espelham exatamente o contrato já validado em
-- lib/storage/pet-photo-signature.ts. HEIC continua fora: não existe pipeline
-- de conversão no projeto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'care-media',
  'care-media',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nenhum `create policy` para bucket_id = 'care-media'. Ver bloco acima:
-- a ausência é deliberada e é o mecanismo de negação.

-- ─────────────────────────────────────────────────────────────────────────────
-- GUARD DE REGRESSÃO
--
-- Toda a segurança deste bucket depende de UMA propriedade externa a ele:
-- que nenhuma policy de `storage.objects` seja escrita sem filtro de
-- `bucket_id`. Uma policy aparentemente inocente como
--
--     create policy "leitura autenticada" on storage.objects
--       for select to authenticated using (auth.role() = 'authenticated');
--
-- abriria `care-media` INTEIRO, silenciosamente, sem tocar em nada deste
-- arquivo. O comentário acima documenta a decisão; este bloco a TESTA.
--
-- Auditoria no banco real (revisão independente) confirmou 13 policies em
-- storage.objects, todas escopadas por bucket_id, e 0 abrangentes — então
-- isto passa hoje. Se um dia falhar, a migration recusa aplicar e obriga
-- alguém a ler o porquê antes de seguir.
--
-- A checagem exige que NENHUMA das duas cláusulas mencione bucket_id: policies
-- de INSERT têm apenas `with_check` (qual é nulo) e são legítimas.
do $$
declare abrangentes int;
begin
  select count(*) into abrangentes
  from pg_policies
  where schemaname = 'storage'
    and tablename  = 'objects'
    and coalesce(qual, '')       not like '%bucket_id%'
    and coalesce(with_check, '') not like '%bucket_id%';

  if abrangentes > 0 then
    raise exception
      'care-media: % policy(ies) em storage.objects sem filtro de bucket_id — care-media deixaria de ser negado por padrão',
      abrangentes;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
--
-- Remover o bucket SOMENTE se estiver vazio e sem uso.
--
--   select count(*) from storage.objects where bucket_id = 'care-media';
--   -- Precisa ser 0. Se for > 0, PARE: apagar objetos aqui destrói evidência
--   -- de atendimento, que é preservada de propósito para auditoria/disputa
--   -- (ver apps/web/docs/care-media-orphans.md).
--
--   delete from storage.buckets where id = 'care-media';
--
-- Não há policy a derrubar, não há coluna a reverter e nenhuma tabela do
-- schema `public` foi tocada — o rollback é uma linha e não afeta os demais
-- buckets. Enquanto não existir `CareMedia`, um bucket vazio também pode
-- simplesmente permanecer: remover é opcional.
