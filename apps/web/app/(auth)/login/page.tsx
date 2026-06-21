import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/modules/identity/components/login-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Entrar",
};

/**
 * LoginPage — Server Component.
 *
 * searchParams é lido no servidor e passado como prop ao LoginForm (Client Component).
 * Evita o uso de useSearchParams() no client, que exige Suspense boundary.
 * Padrão: RSC-first — dados da URL são lidos no servidor.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="space-y-6">
      {/* Cabeçalho: marca + badge de segurança */}
      <div className="space-y-2 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-heading text-xl font-semibold"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            P
          </span>
          Peteen
        </Link>

        <div className="flex justify-center">
          <Badge variant="secondary">Acesso seguro</Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Entre para continuar construindo relações de confiança.
        </p>
      </div>

      {/* Formulário de login — recebe errorCode do servidor (evita useSearchParams) */}
      <LoginForm errorCode={error} />
    </div>
  );
}
