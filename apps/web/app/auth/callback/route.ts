import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleAuthCallback } from "@/modules/identity/infrastructure/auth-actions";
import { getUserByAuthId } from "@/modules/identity/infrastructure/sync-user";
import { isSafeRedirectPath } from "@/modules/identity/domain/safe-redirect";

/**
 * GET /auth/callback
 *
 * Ponto de entrada após OAuth (Google) ou Magic Link.
 * O Supabase redireciona o browser para esta rota com ?code=... após confirmação.
 *
 * Responsabilidades:
 *   1. Trocar o code pelo JWT de sessão (exchangeCodeForSession)
 *   2. Sincronizar o usuário Supabase com o banco Prisma (syncSupabaseUser)
 *   3. Determinar para onde redirecionar baseado na persona do usuário:
 *      - Nenhuma persona → /onboarding (usuário novo)
 *      - TUTOR           → /discover
 *      - PROFESSIONAL    → /requests
 *      - ADMIN           → /admin
 *
 * Segurança:
 *   - Nunca redirecionar para URLs externas (origin é sempre a própria aplicação)
 *   - Erros são redirecionados para /login?error=... com códigos genéricos
 *   - O code é single-use — o Supabase rejeita replay attacks automaticamente
 *
 * Nota: esta rota usa o runtime Node.js (não Edge) para ter acesso ao Prisma.
 */
export const runtime = "nodejs";

/** Destinos de redirect por persona — centralizados para fácil manutenção */
const PERSONA_REDIRECTS = {
  TUTOR: "/discover",
  PROFESSIONAL: "/requests",
  PARTNER: "/partner",
  ADMIN: "/admin",
  ONBOARDING: "/onboarding",
} as const;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    // 1. Trocar code por sessão + sincronizar com Prisma
    const supabaseUser = await handleAuthCallback(code);

    // 2. Buscar o User Prisma com todas as personas
    const dbUser = await getUserByAuthId(supabaseUser.id);

    if (!dbUser) {
      // syncSupabaseUser falhou silenciosamente — edge case
      return NextResponse.redirect(`${origin}/login?error=sync_failed`);
    }

    // 3. Destino: ?next= (validado, path interno) tem prioridade sobre a
    // persona — preserva para onde o usuário estava indo antes do login.
    const destination = isSafeRedirectPath(next) ? next : resolveRedirectDestination(dbUser);

    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}

/**
 * resolveRedirectDestination — determina o destino pós-login.
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
function resolveRedirectDestination(dbUser: Awaited<ReturnType<typeof getUserByAuthId>>) {
  if (!dbUser) return PERSONA_REDIRECTS.ONBOARDING;

  // Persona explicitamente ativa — respeita a escolha do usuário em multi-persona
  if (dbUser.activePrimaryRole) {
    return PERSONA_REDIRECTS[dbUser.activePrimaryRole as keyof typeof PERSONA_REDIRECTS]
      ?? PERSONA_REDIRECTS.ONBOARDING;
  }

  // Inferência: primeira persona existente
  if (dbUser.adminProfile) return PERSONA_REDIRECTS.ADMIN;
  if (dbUser.partnerProfile) return PERSONA_REDIRECTS.PARTNER;
  if (dbUser.professionalProfile) return PERSONA_REDIRECTS.PROFESSIONAL;
  if (dbUser.tutorProfile) return PERSONA_REDIRECTS.TUTOR;

  // Usuário novo sem persona
  return PERSONA_REDIRECTS.ONBOARDING;
}
