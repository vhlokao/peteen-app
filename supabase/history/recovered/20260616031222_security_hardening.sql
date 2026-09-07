-- ============================================================
-- Security Hardening — correções dos advisors
-- ============================================================

-- 1. Mover extensões do schema public para extensions
-- O Supabase recomenda instalar extensões no schema 'extensions'
-- para não expor funções geoespaciais e de texto na API pública
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP EXTENSION IF EXISTS unaccent CASCADE;
DROP EXTENSION IF EXISTS cube CASCADE;
DROP EXTENSION IF EXISTS earthdistance CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS cube WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS earthdistance WITH SCHEMA extensions;

-- 2. Revogar EXECUTE de funções SECURITY DEFINER públicas
-- get_current_user_id: helper interno de RLS, não deve ser chamado via REST API
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_id() FROM authenticated;

-- rls_auto_enable: função de gestão interna do Supabase
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- 3. Corrigir policies dos buckets públicos
-- Substituir SELECT amplo por acesso por objeto (sem listagem do bucket)
DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
DROP POLICY IF EXISTS "pets: public read" ON storage.objects;

-- Acesso apenas a objetos específicos pelo nome (sem listar o bucket)
CREATE POLICY "avatars: public read specific"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND name IS NOT NULL
  );

CREATE POLICY "pets: public read specific"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pets'
    AND name IS NOT NULL
  );