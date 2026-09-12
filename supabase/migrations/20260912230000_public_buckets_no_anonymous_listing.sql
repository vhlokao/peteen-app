-- PETEEN-PRE-PILOT-P2-HARDENING-001 — SEAL-P2-01
--
-- Fecha a ENUMERACAO anonima dos buckets publicos `avatars` e `pets`, mantendo a
-- exibicao publica por URL conhecida.
--
-- CAUSA
-- As duas policies de SELECT abaixo valiam para `public` com predicado aberto
-- (`bucket_id = 'avatars'` e `bucket_id = 'pets' AND name IS NOT NULL`). Na API de
-- Storage, SELECT em `storage.objects` nao autoriza so abrir um objeto: autoriza
-- LISTAR o bucket. Resultado medido no Security Seal (PROD e DEMO): qualquer
-- visitante sem sessao listava as pastas (UUID Auth de cada usuario com foto) e
-- chegava a todas as fotos.
--
-- POR QUE A URL PUBLICA CONTINUA FUNCIONANDO
-- Os dois buckets seguem `public = true` (fonte: 20260907150000_storage_buckets_
-- source_of_truth.sql, nao tocada aqui). Download por `/object/public/<bucket>/
-- <path>` e `getPublicUrl()` NAO consultam policy de `storage.objects` — a
-- documentacao do storage-js declara "objects table permissions: none" para
-- `getPublicUrl`. Quem conhece a URL (a pagina que a exibe) continua vendo a foto;
-- quem nao conhece deixa de conseguir descobri-la.
--
-- POR QUE SELECT CONTINUA EXISTINDO, MAS SO PARA O DONO
-- `remove()` exige `delete` E `select` (storage-js: "objects table permissions:
-- delete and select"). O app apaga a foto antiga do proprio usuario ao trocar
-- avatar/foto de pet (lib/storage/avatar-photo.ts e pet-photo.ts, com a sessao do
-- usuario). Sem nenhum SELECT, essa limpeza passaria a falhar em silencio e
-- acumular arquivos orfaos. O SELECT novo tem exatamente o mesmo predicado de
-- posse das policies de escrita ja existentes: autenticado e primeira pasta do
-- path = auth.uid(). Um usuario lista no maximo a propria pasta.
--
-- NAO FAZ
-- - nao altera configuracao de bucket (public, limite, MIME);
-- - nao le, regrava ou apaga nenhum objeto;
-- - nao toca `care-media`, `care-media-video` nem `documents`;
-- - nao edita migration aplicada (historico aplicado nao se reescreve).
--
-- APLICAR com papel administrativo (SQL editor do Supabase), como a
-- 20260907140100_storage_security_forward_only.sql. Idempotente.

BEGIN;

DROP POLICY IF EXISTS "Public read access for avatars" ON storage."objects";
DROP POLICY IF EXISTS "pets: public read specific" ON storage."objects";

DROP POLICY IF EXISTS "avatars: owner read" ON storage."objects";
CREATE POLICY "avatars: owner read" ON storage."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "pets: owner read" ON storage."objects";
CREATE POLICY "pets: owner read" ON storage."objects"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((bucket_id = 'pets'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

COMMIT;
