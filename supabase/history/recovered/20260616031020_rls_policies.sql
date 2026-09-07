-- ============================================================
-- RLS (Row Level Security) — TitiodePet Foundation
-- Princípio: acesso mínimo necessário por default
-- Leitura pública somente onde faz sentido de negócio
-- Escrita sempre restrita ao próprio usuário
-- ============================================================

-- Helper: retorna o User.id interno a partir do JWT do Supabase
-- Usado como função auxiliar em todas as policies
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE "authId" = auth.uid()
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver apenas seus próprios dados
CREATE POLICY "users: select own"
  ON public.users FOR SELECT
  USING ("authId" = auth.uid());

-- Usuário pode atualizar apenas seus próprios dados
CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING ("authId" = auth.uid());

-- ─────────────────────────────────────────────
-- TUTOR PROFILES
-- ─────────────────────────────────────────────
ALTER TABLE public.tutor_profiles ENABLE ROW LEVEL SECURITY;

-- Perfis de tutores são visíveis publicamente
-- (necessário para que profissionais possam ver quem os contratou)
CREATE POLICY "tutor_profiles: select public"
  ON public.tutor_profiles FOR SELECT
  USING ("deletedAt" IS NULL);

-- Tutor pode inserir seu próprio perfil
CREATE POLICY "tutor_profiles: insert own"
  ON public.tutor_profiles FOR INSERT
  WITH CHECK ("userId" = public.get_current_user_id());

-- Tutor pode atualizar seu próprio perfil
CREATE POLICY "tutor_profiles: update own"
  ON public.tutor_profiles FOR UPDATE
  USING ("userId" = public.get_current_user_id());

-- ─────────────────────────────────────────────
-- PROFESSIONAL PROFILES
-- ─────────────────────────────────────────────
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;

-- Perfis de profissionais são visíveis publicamente (marketplace)
CREATE POLICY "professional_profiles: select public"
  ON public.professional_profiles FOR SELECT
  USING ("deletedAt" IS NULL);

-- Profissional pode inserir seu próprio perfil
CREATE POLICY "professional_profiles: insert own"
  ON public.professional_profiles FOR INSERT
  WITH CHECK ("userId" = public.get_current_user_id());

-- Profissional pode atualizar seu próprio perfil
CREATE POLICY "professional_profiles: update own"
  ON public.professional_profiles FOR UPDATE
  USING ("userId" = public.get_current_user_id());

-- ─────────────────────────────────────────────
-- PARTNER PROFILES
-- ─────────────────────────────────────────────
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_profiles: select public"
  ON public.partner_profiles FOR SELECT
  USING ("deletedAt" IS NULL);

CREATE POLICY "partner_profiles: insert own"
  ON public.partner_profiles FOR INSERT
  WITH CHECK ("userId" = public.get_current_user_id());

CREATE POLICY "partner_profiles: update own"
  ON public.partner_profiles FOR UPDATE
  USING ("userId" = public.get_current_user_id());

-- ─────────────────────────────────────────────
-- ADMIN PROFILES
-- ─────────────────────────────────────────────
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Perfis de admin são visíveis somente por admins
-- (implementação simplificada: usuário vê apenas o próprio)
CREATE POLICY "admin_profiles: select own"
  ON public.admin_profiles FOR SELECT
  USING ("userId" = public.get_current_user_id());

-- ─────────────────────────────────────────────
-- PETS
-- ─────────────────────────────────────────────
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- Pets são visíveis para o próprio tutor e para profissionais vinculados
-- Policy simplificada: pets visíveis publicamente (por enquanto)
-- TODO: restringir por service_request ao implementar o módulo de solicitações
CREATE POLICY "pets: select own tutor"
  ON public.pets FOR SELECT
  USING (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

CREATE POLICY "pets: insert own"
  ON public.pets FOR INSERT
  WITH CHECK (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

CREATE POLICY "pets: update own"
  ON public.pets FOR UPDATE
  USING (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- ─────────────────────────────────────────────
-- SERVICES (catálogo de serviços do profissional)
-- ─────────────────────────────────────────────
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Serviços ativos são públicos (para descoberta)
CREATE POLICY "services: select public"
  ON public.services FOR SELECT
  USING ("isActive" = true);

CREATE POLICY "services: insert own"
  ON public.services FOR INSERT
  WITH CHECK (
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

CREATE POLICY "services: update own"
  ON public.services FOR UPDATE
  USING (
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- ─────────────────────────────────────────────
-- SERVICE REQUESTS
-- ─────────────────────────────────────────────
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Solicitações visíveis para tutor ou profissional envolvidos
CREATE POLICY "service_requests: select participants"
  ON public.service_requests FOR SELECT
  USING (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
    OR
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- Apenas tutores criam solicitações
CREATE POLICY "service_requests: insert tutor only"
  ON public.service_requests FOR INSERT
  WITH CHECK (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- Ambos podem atualizar (para mudar status)
CREATE POLICY "service_requests: update participants"
  ON public.service_requests FOR UPDATE
  USING (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
    OR
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews visíveis são públicas (sem flags)
CREATE POLICY "reviews: select visible"
  ON public.reviews FOR SELECT
  USING ("isVisible" = true AND "isFlagged" = false);

-- Tutor cria review para sua própria solicitação
CREATE POLICY "reviews: insert own tutor"
  ON public.reviews FOR INSERT
  WITH CHECK (
    "tutorId" IN (
      SELECT id FROM public.tutor_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- ─────────────────────────────────────────────
-- TRUST EVENTS (append-only: sem update, sem delete)
-- ─────────────────────────────────────────────
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver eventos onde é ator ou alvo
CREATE POLICY "trust_events: select own"
  ON public.trust_events FOR SELECT
  USING (
    "actorId" = public.get_current_user_id()
    OR
    "targetId" = public.get_current_user_id()
  );

-- Apenas serviços backend podem inserir (sem policy de INSERT para roles públícos)
-- A inserção ocorre via service_role (prisma client no servidor)

-- ─────────────────────────────────────────────
-- CRM CLIENTS
-- ─────────────────────────────────────────────
ALTER TABLE public.crm_clients ENABLE ROW LEVEL SECURITY;

-- Profissional vê apenas seus próprios clientes
CREATE POLICY "crm_clients: select own professional"
  ON public.crm_clients FOR SELECT
  USING (
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

CREATE POLICY "crm_clients: insert own professional"
  ON public.crm_clients FOR INSERT
  WITH CHECK (
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

CREATE POLICY "crm_clients: update own professional"
  ON public.crm_clients FOR UPDATE
  USING (
    "professionalId" IN (
      SELECT id FROM public.professional_profiles
      WHERE "userId" = public.get_current_user_id()
    )
  );

-- ─────────────────────────────────────────────
-- AUDIT LOGS (imutável: sem update, sem delete)
-- ─────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios audit logs
CREATE POLICY "audit_logs: select own"
  ON public.audit_logs FOR SELECT
  USING ("userId" = public.get_current_user_id());

-- ─────────────────────────────────────────────
-- FRAUD SIGNALS (visível apenas para admins e o próprio alvo)
-- ─────────────────────────────────────────────
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;

-- Alvo pode ver os sinais sobre si (transparência)
CREATE POLICY "fraud_signals: select own target"
  ON public.fraud_signals FOR SELECT
  USING ("targetUserId" = public.get_current_user_id());