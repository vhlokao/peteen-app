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
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
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
