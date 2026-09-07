-- GATE-18-PHASE-C-STORAGE-SOURCE-OF-TRUTH-023
--
-- Source of truth EXECUTAVEL da EXISTENCIA e CONFIGURACAO dos 5 buckets.
--
-- POR QUE ESTA MIGRATION EXISTE
-- Ate aqui, um ambiente reconstruido apenas a partir deste repositorio chegava
-- com o schema relacional completo (Fase B) e a seguranca aplicada (Fase A) --
-- e sem nenhum bucket. As policies de `storage.objects` existiam, mas nao havia
-- o que proteger: sem bucket, todo upload falha.
--
-- O caso mais grave era `care-media-video`: existe em PROD e em DEMO, esta em
-- uso ativo (4 objetos no DEMO) e NUNCA teve fonte versionada de criacao. Esta
-- e a primeira.
--
-- ESCOPO: SOMENTE BUCKET E CONFIGURACAO
-- As 10 policies de `storage.objects` pertencem a Fase A
-- (`20260907140100_storage_security_forward_only.sql`) e NAO sao duplicadas
-- aqui. Este arquivo nao contem CREATE/DROP POLICY, ENABLE ROW LEVEL SECURITY,
-- CREATE FUNCTION/TRIGGER/EVENT TRIGGER, GRANT nem REVOKE.
--
-- OWNERSHIP: CADEIA SUPABASE, NAO PRISMA
-- Medido no GATE-017: `storage.buckets` pertence a `supabase_storage_admin`, e
-- o papel `postgres` -- que o Prisma usa -- nao pertence a esse papel nem e
-- superuser (verificado por `pg_has_role`, inclusive transitivamente). Uma
-- migration Prisma tocando `storage` falharia. A divisao nao e estilistica.
--
-- FORWARD-ONLY E CONVERGENTE
-- `ON CONFLICT (id) DO UPDATE` faz a configuracao convergir para o estado
-- desejado sem depender de o bucket existir ou nao. Em ambiente vazio, cria os
-- 5; em DEMO/PROD, confirma o que ja esta la.
--
-- NENHUM ARQUIVO E TOCADO. So ha um INSERT em `storage.buckets`. Nao existe
-- DELETE, TRUNCATE, DROP de bucket, nem qualquer statement contra
-- `storage.objects` -- os objetos armazenados, seus paths, donos e metadados
-- ficam exatamente como estao. Trocar o `file_size_limit` de um bucket nao
-- apaga o que ja foi enviado.
--
-- PROVENIENCIA DOS VALORES
-- Estado vivo de PROD e DEMO (confirmado identico no GATE-015), conferido
-- contra as constantes da aplicacao -- nao copiado de documentacao:
--   CARE_MEDIA_MAX_BYTES     = 5 * 1024 * 1024  -> 5242880
--   CARE_VIDEO_MAX_BYTES     = 50 * 1024 * 1024 -> 52428800
--   CARE_VIDEO_ALLOWED_TYPES = video/mp4, video/quicktime
--   PET_PHOTO_MAX_BYTES      = 5 * 1024 * 1024  -> 5242880
--   PET_PHOTO_ALLOWED_TYPES  = image/jpeg, image/png, image/webp
--
-- Onde o historico divergir do estado vivo, o ESTADO VIVO vence: o arquivo
-- historico `supabase/history/recovered/20260616031040_storage_buckets.sql` e
-- evidencia do que rodou um dia, nao declaracao do estado desejado hoje. Ele
-- nao foi editado, e esta migration e forward-only.
--
-- APLICAR com papel administrativo (SQL editor do Supabase).
--
-- COLUNAS DELIBERADAMENTE NAO TOCADAS: `owner`, `owner_id`, `created_at`,
-- `updated_at`, `avif_autodetection`, `type`, `versioning_status`. As duas
-- ultimas sao colunas mais novas do Supabase com default proprio; referencia-las
-- quebraria a migration em projetos com schema de storage mais antigo, sem
-- ganho nenhum para o estado desejado.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Fotos de perfil. Publico: a leitura da foto nao exige sessao.
  -- A escrita e restringida por policy ownership-scoped da Fase A.
  (
    'avatars',
    'avatars',
    true,
    5242880,                                                        -- 5 MiB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),

  -- Fotos de pet. Publico pelo mesmo motivo de `avatars`.
  (
    'pets',
    'pets',
    true,
    5242880,                                                        -- 5 MiB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),

  -- Documentos. PRIVADO. Existe em PROD e DEMO com esta configuracao, mas hoje
  -- tem ZERO objetos e ZERO referencias no codigo da aplicacao (confirmado por
  -- busca no AUDIT-012 e reconfirmado nesta missao). E versionado para que a
  -- reconstrucao reproduza o estado atual -- nao porque haja feature usando.
  -- Segue classificado como OBSOLETE_CANDIDATE; removê-lo seria decisao de
  -- produto, nao de reconstrucao, e mudaria o estado em vez de reproduzi-lo.
  (
    'documents',
    'documents',
    false,
    10485760,                                                       -- 10 MiB
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  ),

  -- Fotos do Diario de Cuidado. PRIVADO, servido por service-role + signed URL.
  -- A ausencia de policy e intencional: o acesso nao passa por RLS.
  (
    'care-media',
    'care-media',
    false,
    5242880,                                                        -- 5 MiB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),

  -- Videos do Diario. PRIVADO, mesma arquitetura service-role + signed URL.
  --
  -- Bucket separado do de foto por decisao de CUSTO: `file_size_limit` no
  -- Supabase e por bucket, nao por MIME. Um bucket unico com teto de 50 MiB
  -- autorizaria FOTOS de 50 MiB no upload -- rejeitadas depois pela aplicacao,
  -- mas ja ocupando espaco. Com dois buckets, o `allowed_mime_types` impede
  -- FISICAMENTE video no bucket de foto e imagem no de video, independentemente
  -- de qualquer bug de aplicacao.
  --
  -- ESTE BLOCO E A PRIMEIRA FONTE VERSIONADA DESTE BUCKET.
  (
    'care-media-video',
    'care-media-video',
    false,
    52428800,                                                       -- 50 MiB
    ARRAY['video/mp4', 'video/quicktime']
  )
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
