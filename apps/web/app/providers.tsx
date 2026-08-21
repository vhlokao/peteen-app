"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ReactQueryProvider } from "@/lib/react-query/provider";
import { SupabaseAuthProvider } from "@/lib/supabase/auth-provider";

type ProvidersProps = {
  children: ReactNode;
  /**
   * Usuário Supabase do servidor — evita flash de estado não autenticado.
   * Passado pelo root layout via getUser() server-side.
   */
  initialUser?: User | null;
};

/**
 * Providers globais do Peteen
 *
 * Ordem de composição (do mais externo ao mais interno):
 *   ThemeProvider → SupabaseAuthProvider → ReactQueryProvider → TooltipProvider
 *
 * Regra: nunca adicionar lógica de negócio aqui.
 * Providers são infraestrutura de UI e estado, não domínio.
 */
export function Providers({ children, initialUser }: ProvidersProps) {
  // PILOTO: tema fixo em light e `enableSystem` desligado.
  // `defaultTheme="system"` fazia um usuário com o SO em modo escuro receber o
  // app inteiro em dark sem nunca ter escolhido — e o modo escuro nunca passou
  // por QA visual. Com o toggle removido da superfície (ver top-bar.tsx),
  // manter "system" significaria expor exatamente a experiência não validada,
  // sem nenhuma forma de sair dela. A infraestrutura dark permanece intacta:
  // reativar é devolver `defaultTheme="system"` + `enableSystem` e reexibir o
  // toggle.
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SupabaseAuthProvider initialUser={initialUser}>
        <ReactQueryProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors closeButton position="top-center" />
          </TooltipProvider>
        </ReactQueryProvider>
      </SupabaseAuthProvider>
    </NextThemesProvider>
  );
}
