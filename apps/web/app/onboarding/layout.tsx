import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { PRIVATE_AREA_METADATA } from "@/lib/seo/private-area";

/** Área privada — nunca indexada. Ver lib/seo/private-area.ts. */
export const metadata: Metadata = PRIVATE_AREA_METADATA;

/**
 * Layout do onboarding — minimalista, sem AppShell.
 *
 * Por que sem AppShell:
 *   - O usuário ainda não tem persona — sidebar e bottom nav não fazem sentido
 *   - Foco total na tarefa: criar o primeiro perfil
 *   - Sem distrações de navegação
 *
 * Estrutura:
 *   - Header fixo simples com o wordmark oficial
 *   - Conteúdo centralizado, max-w-md (mobile-first)
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header simples — só logo, sem navegação */}
      <header className="safe-top sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--content-max-width)] items-center px-[var(--page-padding-x)]">
          {/* Wordmark oficial, versão para fundo CLARO — este header é
              `bg-background/90`, exatamente como o do app (ver
              components/layout/top-bar.tsx, que carrega a mesma imagem nas
              mesmas dimensões). Antes havia aqui o quadrado "P" + texto que o
              top-bar já tinha aposentado ao adotar o wordmark: quem vinha do
              site público para o onboarding via a marca TROCAR no meio do
              caminho. Mesmo asset, sem cópia — a logo definitiva, quando o
              fundador fechar, entra em /public/brand e chega aqui de graça. */}
          <Link href="/" aria-label="Peteen — página inicial" className="flex items-center">
            <Image
              src="/brand/logo-horizontal.png"
              alt="Peteen"
              width={96}
              height={32}
              priority
              className="h-6 w-auto sm:h-7"
            />
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
