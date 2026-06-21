"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "./sync-user";

/**
 * signInWithMagicLink — envia Magic Link para o email informado.
 * O Supabase redireciona para /auth/callback após confirmação.
 */
export async function signInWithMagicLink(email: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * signInWithGoogle — inicia OAuth com Google.
 * Redireciona o browser para a URL de autorização do Google.
 */
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * signInWithPassword — autenticação direta por e-mail + senha.
 *
 * Uso: ambiente de desenvolvimento com usuários criados manualmente no Supabase Auth.
 * Fluxo: credenciais → sessão imediata → sync Prisma → /dashboard.
 *
 * Não use em produção sem revisão de segurança (rate limiting, lockout, etc.).
 */
export async function signInWithPassword(email: string, password: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Credenciais inválidas.");
  }

  // Sincroniza com Prisma — idempotente, mesmo padrão do callback OAuth
  await syncSupabaseUser({
    authId: data.user.id,
    email: data.user.email!,
  });

  redirect("/dashboard");
}

/**
 * signOut — encerra a sessão Supabase e redireciona para home.
 */
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * handleAuthCallback — processa o callback OAuth/Magic Link.
 * Sincroniza o usuário Supabase com o Prisma.
 * Chamado pela rota /auth/callback.
 */
export async function handleAuthCallback(code: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    throw new Error(error?.message ?? "Auth callback failed");
  }

  // Sincronizar com Prisma — idempotente
  await syncSupabaseUser({
    authId: data.user.id,
    email: data.user.email!,
  });

  return data.user;
}
