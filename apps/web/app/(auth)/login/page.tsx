import type { Metadata } from "next";

import { LoginForm } from "@/modules/identity/components/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

/**
 * LoginPage — Server Component.
 *
 * searchParams é lido no servidor e passado como prop ao LoginForm (Client Component).
 * Evita o uso de useSearchParams() no client, que exige Suspense boundary.
 * Padrão: RSC-first — dados da URL são lidos no servidor.
 *
 * LoginForm possui seu próprio header/hero — esta página não adiciona chrome extra.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <LoginForm errorCode={error} />;
}
