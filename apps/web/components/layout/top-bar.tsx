"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button, buttonVariants } from "@/components/ui/button";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { TopNavLinks } from "@/components/layout/top-nav-links";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { getVariantForRole, getHomeHrefForVariant } from "@/lib/navigation/app-navigation";
import type { AppShellVariant, ShellSessionUser } from "@/types";

type TopBarProps = {
  showThemeToggle?: boolean;
  /** Persona ativa — normalmente "marketing" na landing pública. */
  variant?: AppShellVariant;
  /** Usuário serializado vindo do AppShell (Server Component). Null se não autenticado. */
  user?: ShellSessionUser | null;
  notificationCount?: number;
  notificationsHref?: string;
};

export function TopBar({
  showThemeToggle = true,
  variant = "marketing",
  user,
  notificationCount = 0,
  notificationsHref,
}: TopBarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isAuthenticated = !!user;

  // Persona efetiva: quando um usuário autenticado acessa a landing pública,
  // `variant` continua "marketing" (prop vinda do layout), mas o header deve
  // mostrar a navegação/avatar da persona real dele — não tratá-lo como
  // visitante. Fora da landing, `variant` já é a persona real.
  const effectiveVariant: AppShellVariant =
    isAuthenticated && user.primaryRole
      ? getVariantForRole(user.primaryRole) ?? variant
      : variant;

  // Visitante = não autenticado, na landing pública.
  const isVisitor = !isAuthenticated && pathname === "/";

  // Logo leva à home da persona quando autenticado (ex: /professional),
  // à home pública quando visitante — nunca joga o usuário logado pra fora
  // do produto.
  const logoHref = isAuthenticated ? getHomeHrefForVariant(effectiveVariant) : "/";

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--content-max-width)] items-center justify-between gap-4 px-[var(--page-padding-x)]">
        {/* Logo — sempre visível, leva à home da persona (autenticado) ou pública (visitante) */}
        <Link
          href={logoHref}
          aria-label="Peteen — página inicial"
          className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            P
          </span>
          <span className="sr-only sm:not-sr-only">Peteen</span>
        </Link>

        {/* Navegação contextual mínima — só existe para persona autenticada com itens reais */}
        {isAuthenticated ? <TopNavLinks variant={effectiveVariant} /> : null}

        {/* Ações à direita */}
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Visitante: uma única CTA — o onboarding decide tutor/profissional depois */}
          {isVisitor ? (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Começar
            </Link>
          ) : null}

          {/* Sino de notificações — sempre no topo, nunca no bottom nav */}
          {isAuthenticated && notificationsHref ? (
            <NotificationBell href={notificationsHref} count={notificationCount} />
          ) : null}

          {/* Toggle de tema */}
          {showThemeToggle ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Alternar tema"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
          ) : null}

          {/* Menu da conta — central operacional do ator logado */}
          {isAuthenticated && user ? (
            <AvatarMenu variant={effectiveVariant} user={user} />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
