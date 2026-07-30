import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * /dashboard — hub de redirecionamento server-side.
 *
 * Esta página NÃO tem UI. Seu único propósito é ler a sessão e
 * redirecionar o usuário para a área correta da sua persona.
 *
 * Por que existe?
 *   O middleware (Edge Runtime) não tem acesso ao Prisma para consultar a persona.
 *   Quando um usuário autenticado acessa /login, o middleware o manda para /dashboard.
 *   O /dashboard (Node.js runtime) lê a sessão do Prisma e redireciona corretamente.
 *
 * Personas → destinos:
 *   TUTOR        → /discover
 *   PROFESSIONAL → /requests
 *   ADMIN        → /admin
 *   PARTNER      → /partner
 *   (sem persona) → /onboarding
 *
 * Guard contra o loop de desync (auditoria Q1):
 *   O middleware considera "autenticado" só pela existência de um JWT válido.
 *   getAuthContext() exige, além do JWT, uma linha em public.users. Quando o
 *   JWT é válido mas essa linha não existe, os dois critérios divergem: o
 *   middleware manda /login → aqui, e aqui mandaríamos de volta a /login —
 *   loop infinito (ERR_TOO_MANY_REDIRECTS), sem UI de logout alcançável.
 *
 *   getAuthContext() não distingue "sem JWT" de "JWT válido sem
 *   public.users" — os dois colapsam em `authenticated: false`. Por isso,
 *   só neste ramo raro (usuário não autenticado), checamos o JWT
 *   diretamente: se ele existir, a sessão está "presa" e precisa ser
 *   encerrada de verdade (não apenas redirecionada) — daí /auth/force-logout.
 *   Não cria public.users, não atribui role, não infere persona.
 */
export const runtime = "nodejs";

const ROLE_DESTINATIONS = {
  TUTOR: "/discover",
  PROFESSIONAL: "/requests",
  ADMIN: "/admin",
  PARTNER: "/partner",
} as const;

export default async function DashboardRedirectPage() {
  const ctx = await getAuthContext();

  if (!ctx.authenticated) {
    // Sem sessão de aplicação. Antes de mandar para /login, confirma se há
    // um JWT Supabase válido — só esse caso raro (desync) exige encerrar a
    // sessão de verdade; um visitante genuinamente anônimo segue como
    // sempre. Custo extra só neste ramo, nunca no caminho feliz.
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (supabaseUser) {
      redirect("/auth/force-logout");
    }

    redirect("/login");
  }

  const { user } = ctx;

  if (!user.primaryRole) {
    // Usuário autenticado mas sem persona — ainda não fez onboarding
    redirect("/onboarding");
  }

  const destination =
    ROLE_DESTINATIONS[user.primaryRole as keyof typeof ROLE_DESTINATIONS] ?? "/onboarding";

  redirect(destination);
}
