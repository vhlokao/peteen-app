"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { TopNavLinks } from "@/components/layout/top-nav-links";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { getVariantForRole, getHomeHrefForVariant } from "@/lib/navigation/app-navigation";
import type { AppShellVariant, ShellSessionUser } from "@/types";

type TopBarProps = {
  /** Persona ativa — normalmente "marketing" na landing pública. */
  variant?: AppShellVariant;
  /** Usuário serializado vindo do AppShell (Server Component). Null se não autenticado. */
  user?: ShellSessionUser | null;
  notificationCount?: number;
  notificationsHref?: string;
};

export function TopBar({
  variant = "marketing",
  user,
  notificationCount = 0,
  notificationsHref,
}: TopBarProps) {
  const pathname = usePathname();
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
        {/* Logo — sempre visível, leva à home da persona (autenticado) ou
            pública (visitante). Wordmark oficial completo, versão para fundo
            CLARO (logo-horizontal.png — este header é `bg-background/90`,
            quase branco; a versão clara/branca usada no header e footer
            públicos ficaria ilegível aqui). Substitui o quadrado "P" +
            texto condicional (`sr-only` até `sm`) que existia antes: aquele
            escondia o nome da marca em mobile por falta de um wordmark
            compacto o bastante; agora uma única imagem, dimensionada menor
            em mobile e maior a partir de `sm`, resolve sem esconder nada —
            ver docs/BRAND_DOMAIN_PUBLIC_SURFACE.md §3. */}
        <Link href={logoHref} aria-label="Peteen — página inicial" className="flex shrink-0 items-center">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Peteen"
            width={96}
            height={32}
            priority
            className="h-6 w-auto sm:h-7"
          />
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

          {/* Toggle de tema REMOVIDO da superfície do piloto (decisão de
              produto — item 10 da missão Minha Conta). A infraestrutura dark
              continua intacta (ThemeProvider, tokens e variantes `dark:` no
              CSS): só a escolha deixou de ser exposta, porque o modo escuro
              nunca passou por QA visual e o piloto precisa de uma experiência
              única e coerente. Reexpor é trocar uma constante em
              app/providers.tsx e devolver este bloco. */}

          {/* Menu da conta — central operacional do ator logado */}
          {isAuthenticated && user ? (
            <AvatarMenu variant={effectiveVariant} user={user} />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
