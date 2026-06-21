/**
 * Tipos de domínio do módulo identity.
 *
 * Regra: estes tipos não dependem de Prisma nem de Supabase.
 * São contratos puros de domínio — o que o aplicativo "entende" por identidade.
 *
 * Alinhamento: PersonaRole reflete o enum PersonaRole do schema Prisma.
 * Em minúsculo aqui para facilitar uso em URLs, guards e condicionais.
 */

export type PersonaRole = "TUTOR" | "PROFESSIONAL" | "PARTNER" | "ADMIN";

/**
 * Usuário autenticado com suas personas ativas.
 * Derivado da sessão Supabase + consulta ao Prisma.
 */
export type SessionUser = {
  id: string;               // Prisma User.id (cuid)
  authId: string;           // Supabase auth.users.id (uuid) — IMUTÁVEL
  email: string;
  roles: PersonaRole[];     // todas as personas que o user possui
  primaryRole: PersonaRole | null;  // User.activePrimaryRole — qual persona está ativa

  // Metadados de estado do usuário
  onboardingCompletedAt: Date | null;
  lastSeenAt: Date | null;
};

/**
 * Contexto de auth disponível em Server Components e Server Actions.
 * Discriminated union — garante type narrowing correto em todo o código.
 */
export type AuthContext =
  | { authenticated: false; user: null }
  | { authenticated: true; user: SessionUser };

/**
 * Payload mínimo para sincronizar um usuário Supabase com o banco Prisma.
 * Utilizado em auth-actions.ts no callback de login.
 */
export type SyncUserPayload = {
  authId: string;  // uuid do Supabase
  email: string;
};

/**
 * Resultado do fluxo de onboarding — qual persona foi criada e para onde redirecionar.
 */
export type OnboardingResult = {
  userId: string;
  role: PersonaRole;
  redirectTo: string;
};

/**
 * Providers de autenticação suportados pelo Peteen.
 */
export type AuthProvider = "google" | "magic_link" | "whatsapp";
