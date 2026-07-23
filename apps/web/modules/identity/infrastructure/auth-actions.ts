"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "./sync-user";
import { isSafeRedirectPath } from "../domain/safe-redirect";

const EMAIL_RATE_LIMIT_MESSAGE =
  "Não conseguimos enviar um novo acesso agora porque o limite temporário de e-mails foi atingido. Aguarde alguns minutos e tente novamente.";

function buildMagicLinkRedirectUrl(next?: string): string {
  const base = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  if (isSafeRedirectPath(next)) {
    return `${base}?next=${encodeURIComponent(next)}`;
  }
  return base;
}

/**
 * signInWithMagicLink — envia Magic Link para o email informado.
 * O Supabase redireciona para /auth/callback após confirmação.
 *
 * Retorna um resultado tipado em vez de throw: "email rate limit exceeded"
 * é uma resposta esperada do provedor (cota de envio atingida), não uma
 * exceção. Um throw não-tratado numa Server Action vira, em produção, o
 * erro genérico "An error occurred in the Server Components render" no
 * client (Next sanitiza a mensagem real) e HTTP 500 — escondendo do usuário
 * o motivo real e impedindo qualquer orientação de retry.
 */
export async function signInWithMagicLink(
  email: string,
  next?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildMagicLinkRedirectUrl(next),
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      console.error("[auth] signInWithMagicLink: rate limit exceeded");
      return { success: false, error: EMAIL_RATE_LIMIT_MESSAGE };
    }
    console.error("[auth] signInWithMagicLink failed:", error.message);
    return {
      success: false,
      error: "Não foi possível enviar o link de acesso. Tente novamente em instantes.",
    };
  }

  return { success: true };
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
 * Credenciais inválidas são um caso esperado (usuário errou a senha), não uma
 * exceção — por isso retorna um resultado tipado em vez de throw. Um throw
 * não-tratado numa Server Action vira, em produção, o erro genérico "An error
 * occurred in the Server Components render" no client (Next sanitiza a
 * mensagem real), escondendo o motivo de verdade do usuário.
 *
 * Não use em produção sem revisão de segurança (rate limiting, lockout, etc.).
 */
export async function signInWithPassword(
  email: string,
  password: string,
  next?: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: "E-mail ou senha incorretos. Tente novamente." };
  }

  if (!data.user) {
    return { success: false, error: "Não foi possível autenticar. Tente novamente." };
  }

  // Sincroniza com Prisma — idempotente, mesmo padrão do callback OAuth
  await syncSupabaseUser({
    authId: data.user.id,
    email: data.user.email!,
  });

  redirect(isSafeRedirectPath(next) ? next : "/dashboard");
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
