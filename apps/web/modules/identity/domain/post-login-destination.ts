/**
 * Módulo: identity
 * Camada: domain — destino pós-login por persona (`/auth/callback`).
 *
 * Extraído de `app/auth/callback/route.ts` (GATE-6-TUTOR-POSTLOGIN-001) para
 * poder ser testado puro — o Route Handler importa `next/server`
 * (`NextResponse`), que não resolve fora do runtime do Next, então a lógica
 * de destino não podia ser exercitada por `node --test` enquanto morava lá.
 */

/**
 * Sinais de persona lidos do User (Prisma) — apenas o que
 * `resolvePostLoginDestination` precisa, não o registro inteiro.
 */
export type PostLoginPersonaSignals = {
  activePrimaryRole: string | null
  adminProfile: unknown | null
  partnerProfile: unknown | null
  professionalProfile: unknown | null
  tutorProfile: unknown | null
} | null

/**
 * Destinos de redirect por persona — centralizados para fácil manutenção.
 *
 * TUTOR → /tutor (GATE-6-TUTOR-POSTLOGIN-001): login normal do Tutor deve
 * abrir a Home do Tutor, não Discovery direto — a Home já dá contexto de
 * produto e um CTA claro para buscar profissional. `next` (quando presente e
 * seguro) continua tendo prioridade sobre este default — quem chama esta
 * função só o faz depois de `isSafeRedirectPath(next)` falhar — então deep
 * links/convites (`/p/[professionalId]`) não são afetados.
 */
export const PERSONA_REDIRECTS = {
  TUTOR: "/tutor",
  PROFESSIONAL: "/requests",
  PARTNER: "/partner",
  ADMIN: "/admin",
  ONBOARDING: "/onboarding",
} as const

/**
 * resolvePostLoginDestination — determina o destino pós-login quando não há
 * `next` seguro a honrar.
 *
 * Ordem de prioridade:
 *   1. activePrimaryRole (persona explicitamente escolhida pelo usuário)
 *   2. Primeira persona encontrada (para usuários com uma única persona)
 *   3. Nenhuma persona → onboarding
 *
 * Preparado para multi-persona: quando um usuário tiver TUTOR + PROFESSIONAL,
 * o activePrimaryRole define qual área ele acessa. O switcher de persona
 * (futuro) atualizará activePrimaryRole no banco.
 */
export function resolvePostLoginDestination(user: PostLoginPersonaSignals): string {
  if (!user) return PERSONA_REDIRECTS.ONBOARDING

  // Persona explicitamente ativa — respeita a escolha do usuário em multi-persona
  if (user.activePrimaryRole) {
    return (
      PERSONA_REDIRECTS[user.activePrimaryRole as keyof typeof PERSONA_REDIRECTS] ??
      PERSONA_REDIRECTS.ONBOARDING
    )
  }

  // Inferência: primeira persona existente
  if (user.adminProfile) return PERSONA_REDIRECTS.ADMIN
  if (user.partnerProfile) return PERSONA_REDIRECTS.PARTNER
  if (user.professionalProfile) return PERSONA_REDIRECTS.PROFESSIONAL
  if (user.tutorProfile) return PERSONA_REDIRECTS.TUTOR

  // Usuário novo sem persona
  return PERSONA_REDIRECTS.ONBOARDING
}
