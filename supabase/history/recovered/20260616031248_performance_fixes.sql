-- ============================================================
-- Correções de performance identificadas pelos advisors
-- ============================================================

-- 1. Índice ausente na FK crm_clients.tutorId
-- Necessário para joins eficientes tutor <-> crm
CREATE INDEX IF NOT EXISTS "crm_clients_tutorId_idx" ON public.crm_clients ("tutorId");

-- 2. Corrigir auth_rls_initplan na tabela users
-- auth.uid() dentro de USING re-avalia por linha, causando full scan
-- Solução: envolver em (SELECT auth.uid()) para avaliar uma única vez
DROP POLICY IF EXISTS "users: select own" ON public.users;
DROP POLICY IF EXISTS "users: update own" ON public.users;

CREATE POLICY "users: select own"
  ON public.users FOR SELECT
  USING ("authId" = (SELECT auth.uid()));

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING ("authId" = (SELECT auth.uid()));