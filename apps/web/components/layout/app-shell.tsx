/**
 * AppShell — Server Component central do Peteen.
 *
 * Responsabilidades:
 *  1. Auth guard: redireciona para /login se não autenticado.
 *  2. Lê a sessão do usuário (getAuthContext) e serializa para Client Components.
 *  3. Compõe o layout: TopBar (header de produto + AvatarMenu) + BottomNav (mobile) + children.
 *
 * Arquitetura de navegação (UX 3.0.2):
 *  - Nenhuma persona logada usa sidebar hoje. O header (TopBar) mostra
 *    navegação GERAL da Peteen; o que é específico do ator (painel,
 *    solicitações, pets, etc.) vive no AvatarMenu.
 *  - shellLayoutByVariant continua existindo para permitir voltar a uma
 *    sidebar/rail no futuro sem reestruturar a navegação central.
 *
 * Por que Server Component?
 *  - Acesso direto ao Supabase e Prisma sem expor tokens ao cliente.
 *  - Redirect server-side evita flash de conteúdo não autorizado.
 *  - Dados do usuário são serializados como props simples para os Client Components filhos.
 *
 * Fluxo de persona:
 *  - O `variant` vem do layout de cada route group ((tutor), (professional), (admin)).
 *  - O AppShell valida que o usuário está autenticado, mas não restringe por role aqui.
 *  - Restrição por role é feita nas Server Actions individuais (requireRole).
 *  - Futuramente: adicionar verificação de role no AppShell para evitar acesso cross-persona.
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { cn } from "@/lib/utils";
import type { AppShellVariant, ShellSessionUser } from "@/types";

type AppShellProps = {
  variant: AppShellVariant;
  children: ReactNode;
  className?: string;
  showTopBar?: boolean;
  notificationCount?: number;
  notificationsHref?: string;
};

export async function AppShell({
  variant,
  children,
  className,
  showTopBar = true,
  notificationCount = 0,
  notificationsHref,
}: AppShellProps) {
  const hasNav = variant !== "marketing";

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Rotas de marketing não exigem autenticação (sem redirect), mas ainda
  // assim leem a sessão: se um usuário autenticado visitar a landing pública,
  // o header deve mostrar o avatar dele, não tratá-lo como visitante.
  // Todas as outras rotas exigem sessão válida (guard com redirect).
  let sessionUser: ShellSessionUser | null = null;

  if (hasNav) {
    const ctx = await getAuthContext();

    if (!ctx.authenticated) {
      redirect("/login");
    }

    // Usuário autenticado mas sem persona → onboarding ainda não concluído
    if (!ctx.user.primaryRole) {
      redirect("/onboarding");
    }

    // Serializa para Client Components — sem Date, sem funções, sem referências circulares.
    sessionUser = {
      id: ctx.user.id,
      email: ctx.user.email,
      primaryRole: ctx.user.primaryRole,
      roles: ctx.user.roles,
      avatarUrl: ctx.user.avatarUrl,
    };
  } else {
    // Marketing: leitura opcional, sem guard e sem redirect.
    const ctx = await getAuthContext();
    if (ctx.authenticated && ctx.user.primaryRole) {
      sessionUser = {
        id: ctx.user.id,
        email: ctx.user.email,
        primaryRole: ctx.user.primaryRole,
        roles: ctx.user.roles,
        avatarUrl: ctx.user.avatarUrl,
      };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col">
      {showTopBar ? (
        <TopBar
          variant={variant}
          user={sessionUser}
          notificationCount={notificationCount}
          notificationsHref={notificationsHref}
        />
      ) : null}

      <main
        className={cn(
          "flex-1 overflow-y-auto",
          // Mobile: padding-bottom para o BottomNav fixo não cobrir conteúdo
          hasNav && "pb-[calc(var(--bottom-nav-height)+1rem)] lg:pb-0",
          className
        )}
      >
        {children}
      </main>

      {/* BottomNav só aparece em rotas autenticadas e em mobile (lg:hidden via CSS) */}
      {hasNav ? <BottomNav variant={variant} /> : null}
    </div>
  );
}
