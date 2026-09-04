import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleAuthCallback } from "@/modules/identity/infrastructure/auth-actions";
import { getUserByAuthId } from "@/modules/identity/infrastructure/sync-user";
import { isSafeRedirectPath } from "@/modules/identity/domain/safe-redirect";
import { resolvePostLoginDestination } from "@/modules/identity/domain/post-login-destination";

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
 *      - TUTOR           → /tutor (GATE-6-TUTOR-POSTLOGIN-001 — Home do
 *                          Tutor, não mais Discovery direto)
 *      - PROFESSIONAL    → /requests
 *      - ADMIN           → /admin
 *
 * Segurança:
 *   - Nunca redirecionar para URLs externas (origin é sempre a própria aplicação)
 *   - Erros são redirecionados para /login?error=... com códigos genéricos
 *   - O code é single-use — o Supabase rejeita replay attacks automaticamente
 *
 * Nota: esta rota usa o runtime Node.js (não Edge) para ter acesso ao Prisma.
 *
 * O destino por persona (incluindo a prioridade de `next`) vive em
 * `modules/identity/domain/post-login-destination.ts` — função pura, testada
 * separadamente porque este arquivo importa `next/server` e não roda sob
 * `node --test`.
 */
export const runtime = "nodejs";

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
    const destination = isSafeRedirectPath(next) ? next : resolvePostLoginDestination(dbUser);

    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }
}
