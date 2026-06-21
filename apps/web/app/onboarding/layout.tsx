import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Layout do onboarding — minimalista, sem AppShell.
 *
 * Por que sem AppShell:
 *   - O usuário ainda não tem persona — sidebar e bottom nav não fazem sentido
 *   - Foco total na tarefa: criar o primeiro perfil
 *   - Sem distrações de navegação
 *
 * Estrutura:
 *   - Header fixo simples com logo
 *   - Conteúdo centralizado, max-w-md (mobile-first)
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header simples — só logo, sem navegação */}
      <header className="safe-top sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--content-max-width)] items-center px-[var(--page-padding-x)]">
          <Link
            href="/"
            className="flex items-center gap-2 font-heading text-base font-semibold text-foreground"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
              P
            </span>
            Peteen
          </Link>
        </div>
      </header>

      {/* Área de conteúdo — centralizada horizontalmente, alinhada ao topo */}
      <main className="flex flex-1 flex-col items-center px-[var(--page-padding-x)] py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
