import { cache } from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma/client"
import type { AuthContext, PersonaRole, SessionUser } from "../domain/types"

/**
 * getAuthContext — retorna o usuário autenticado com suas personas.
 *
 * Fluxo:
 *   1. Lê sessão Supabase (JWT validado no servidor)
 *   2. Busca o User correspondente no Prisma com todas as personas
 *   3. Determina quais personas este user possui
 *   4. Retorna AuthContext tipado — discriminated union para type narrowing seguro
 *
 * Usar em Server Components e Server Actions. Nunca chamar no browser.
 *
 * cache(): deduplica chamadas dentro do mesmo request de render.
 * Layouts, páginas e Server Actions compartilham o mesmo resultado sem N+1 queries.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (!supabaseUser) {
    return { authenticated: false, user: null }
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: supabaseUser.id },
    select: {
      id: true,
      authId: true,
      email: true,
      activePrimaryRole: true,
      onboardingCompletedAt: true,
      lastSeenAt: true,
      tutorProfile: { select: { id: true } },
      professionalProfile: { select: { id: true } },
      partnerProfile: { select: { id: true } },
      adminProfile: { select: { id: true } },
    },
  })

  if (!dbUser) {
    // Usuário existe no Supabase mas ainda não sincronizou com public.users.
    // Ocorre na primeira sessão antes do trigger processar ou antes do onboarding.
    return { authenticated: false, user: null }
  }

  const roles: PersonaRole[] = []
  if (dbUser.tutorProfile) roles.push("TUTOR")
  if (dbUser.professionalProfile) roles.push("PROFESSIONAL")
  if (dbUser.partnerProfile) roles.push("PARTNER")
  if (dbUser.adminProfile) roles.push("ADMIN")

  const sessionUser: SessionUser = {
    id: dbUser.id,
    authId: dbUser.authId,
    email: dbUser.email,
    roles,
    primaryRole: (dbUser.activePrimaryRole as PersonaRole) ?? roles[0] ?? null,
    onboardingCompletedAt: dbUser.onboardingCompletedAt,
    lastSeenAt: dbUser.lastSeenAt,
  }

  return { authenticated: true, user: sessionUser }
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
