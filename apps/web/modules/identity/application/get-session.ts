import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma/client"
import type { Prisma } from "@prisma/client"
import { VERIFIED_AUTH_ID_HEADER } from "../domain/verified-auth-header"
import type { AuthContext, PersonaRole, SessionUser } from "../domain/types"

const USER_WITH_PERSONAS_SELECT = {
  id: true,
  authId: true,
  email: true,
  activePrimaryRole: true,
  onboardingCompletedAt: true,
  lastSeenAt: true,
  tutorProfile: { select: { id: true, avatarUrl: true } },
  professionalProfile: { select: { id: true, avatarUrl: true } },
  partnerProfile: { select: { id: true, avatarUrl: true } },
  adminProfile: { select: { id: true } },
} satisfies Prisma.UserSelect

type UserWithPersonas = Prisma.UserGetPayload<{ select: typeof USER_WITH_PERSONAS_SELECT }>

/**
 * Monta o `AuthContext` a partir da linha do Prisma — mesma lógica de
 * roles/primaryRole/avatar de sempre, só extraída para ser compartilhada
 * pelos dois caminhos de `getAuthContext` (com e sem o header validado).
 * `dbUser === null` cobre tanto "usuário não existe" quanto "existe no
 * Supabase mas ainda não sincronizou com public.users" (primeira sessão,
 * antes do trigger/onboarding) — os dois casos sempre foram tratados como
 * não-autenticado, comportamento inalterado por esta missão.
 */
function toAuthContext(dbUser: UserWithPersonas | null): AuthContext {
  if (!dbUser) {
    return { authenticated: false, user: null }
  }

  const roles: PersonaRole[] = []
  if (dbUser.tutorProfile) roles.push("TUTOR")
  if (dbUser.professionalProfile) roles.push("PROFESSIONAL")
  if (dbUser.partnerProfile) roles.push("PARTNER")
  if (dbUser.adminProfile) roles.push("ADMIN")

  const primaryRole = (dbUser.activePrimaryRole as PersonaRole) ?? roles[0] ?? null

  // Avatar da persona ativa — cada persona tem sua própria foto de perfil
  // (TutorProfile/ProfessionalProfile/PartnerProfile). ADMIN não tem avatar.
  const avatarUrl =
    primaryRole === "TUTOR"
      ? (dbUser.tutorProfile?.avatarUrl ?? null)
      : primaryRole === "PROFESSIONAL"
        ? (dbUser.professionalProfile?.avatarUrl ?? null)
        : primaryRole === "PARTNER"
          ? (dbUser.partnerProfile?.avatarUrl ?? null)
          : null

  const sessionUser: SessionUser = {
    id: dbUser.id,
    authId: dbUser.authId,
    email: dbUser.email,
    roles,
    primaryRole,
    avatarUrl,
    onboardingCompletedAt: dbUser.onboardingCompletedAt,
    lastSeenAt: dbUser.lastSeenAt,
  }

  return { authenticated: true, user: sessionUser }
}

/**
 * getAuthContext — retorna o usuário autenticado com suas personas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE-3-AUTH-LATENCY-005 — evita uma SEGUNDA validação de rede por request
 *
 * `middleware.ts` já chamou `supabase.auth.getUser()` (valida o JWT contra o
 * servidor do Supabase) para TODO request que chega até aqui — é o próprio
 * matcher do middleware que garante isso. Repetir essa chamada aqui dentro
 * era pagar a MESMA validação de rede duas vezes no mesmo request HTTP.
 *
 * `middleware.ts` escreve o `authId` já validado num header interno
 * (`VERIFIED_AUTH_ID_HEADER`) — ver o comentário de segurança lá, e em
 * `verified-auth-header.ts`, para a garantia central: o middleware SEMPRE
 * apaga qualquer valor deste header vindo do cliente antes de decidir se
 * escreve um novo, então o que chega até aqui, quando presente, é sempre o
 * que `getUser()` validou segundos atrás — nunca o que o cliente mandou.
 *
 * Mesmo assim, este código NUNCA confia em identidade/roles a partir do
 * header sozinho: o `authId` só vira `AuthContext` depois de uma consulta
 * real ao Prisma (idêntica à que já existia) — a MESMA trava de sempre
 * (usuário existir em `public.users`, personas reais) continua valendo. O
 * único custo eliminado é a validação de JWT redundante, não a consulta ao
 * banco.
 *
 * FALLBACK: se o header não estiver presente — rota fora do matcher do
 * middleware, ambiente de teste, ou qualquer caminho não coberto —, o
 * comportamento é EXATAMENTE o de antes desta missão: chama
 * `supabase.auth.getUser()` normalmente. Nunca menos seguro, só sem o
 * atalho quando ele não pode ser provado seguro.
 *
 * cache(): deduplica chamadas dentro do mesmo request de render.
 * Layouts, páginas e Server Actions compartilham o mesmo resultado sem N+1 queries.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const verifiedAuthId = (await headers()).get(VERIFIED_AUTH_ID_HEADER)

  if (verifiedAuthId) {
    const dbUser = await prisma.user.findUnique({
      where: { authId: verifiedAuthId },
      select: USER_WITH_PERSONAS_SELECT,
    })
    return toAuthContext(dbUser)
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (!supabaseUser) {
    return { authenticated: false, user: null }
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: supabaseUser.id },
    select: USER_WITH_PERSONAS_SELECT,
  })

  return toAuthContext(dbUser)
})

/**
 * requireAuth — lança erro se o usuário não estiver autenticado.
 * Usar em Server Actions que exigem autenticação obrigatória.
 */
export async function requireAuth(): Promise<SessionUser> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) {
    throw new Error("UNAUTHENTICATED")
  }
  return ctx.user
}

/**
 * requireRole — exige que o usuário tenha uma persona específica.
 * Usar em Server Actions restritas a uma persona (ex: apenas profissionais).
 */
export async function requireRole(role: PersonaRole): Promise<SessionUser> {
  const user = await requireAuth()
  if (!user.roles.includes(role)) {
    throw new Error(`FORBIDDEN: role '${role}' required`)
  }
  return user
}

/**
 * requireAdmin — exige role ADMIN.
 * Usar em Server Actions do backoffice.
 * Lança erro em vez de redirecionar — o redirect fica na camada de layout/action.
 */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN")
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTES PARA PÁGINAS E LAYOUTS (Server Components)
//
// Por que existem, além de requireAuth/requireRole/requireAdmin:
//   Aquelas sinalizam acesso negado com `throw new Error(...)`, o que é certo
//   em Server Actions (o try/catch da action converte em { success: false }).
//   Numa página/layout não há try/catch nem error.tsx: o throw vira erro não
//   tratado e o Next loga stack trace + digest para um fluxo ESPERADO,
//   poluindo a observabilidade e podendo mascarar falhas reais.
//
//   Estas variantes decidem pelo AuthContext (nunca por texto de Error) e usam
//   `redirect()` do Next, cujo sinal interno é tratado pelo roteador sem log de
//   erro — mesmo padrão que AdminShell já usava.
//
// Falhas reais (Prisma, timeout Supabase, TypeError) continuam propagando:
//   não há try/catch aqui, então qualquer exceção de getAuthContext sobe intacta.
// ─────────────────────────────────────────────────────────────────────────────

/** Destino padrão quando não há sessão válida na camada de aplicação. */
const UNAUTHENTICATED_REDIRECT = "/login"

/**
 * Destino padrão quando há sessão porém sem o papel exigido.
 * `/dashboard` roteia por persona (TUTOR → /discover, PROFESSIONAL → /requests,
 * PARTNER → /partner), que é exatamente o comportamento que AdminShell já
 * produzia — por isso nenhum destino novo é introduzido aqui.
 */
const FORBIDDEN_REDIRECT = "/dashboard"

/**
 * requireAuthOrRedirect — versão de `requireAuth` para páginas/layouts.
 * Redireciona em vez de lançar quando não há sessão de aplicação.
 */
export async function requireAuthOrRedirect(
  redirectTo: string = UNAUTHENTICATED_REDIRECT
): Promise<SessionUser> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) {
    redirect(redirectTo)
  }
  return ctx.user
}

/**
 * requireRoleOrRedirect — versão de `requireRole` para páginas/layouts.
 * Distingue explicitamente os dois casos esperados:
 *   - sem sessão de aplicação  → `unauthenticatedTo`
 *   - com sessão, sem o papel  → `forbiddenTo`
 */
export async function requireRoleOrRedirect(
  role: PersonaRole,
  options?: { unauthenticatedTo?: string; forbiddenTo?: string }
): Promise<SessionUser> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) {
    redirect(options?.unauthenticatedTo ?? UNAUTHENTICATED_REDIRECT)
  }
  if (!ctx.user.roles.includes(role)) {
    redirect(options?.forbiddenTo ?? FORBIDDEN_REDIRECT)
  }
  return ctx.user
}

/** requireAdminOrRedirect — versão de `requireAdmin` para páginas/layouts. */
export async function requireAdminOrRedirect(options?: {
  unauthenticatedTo?: string
  forbiddenTo?: string
}): Promise<SessionUser> {
  return requireRoleOrRedirect("ADMIN", options)
}
