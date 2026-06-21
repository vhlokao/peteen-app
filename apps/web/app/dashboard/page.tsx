import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";

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
