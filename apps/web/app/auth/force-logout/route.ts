import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/force-logout
 *
 * Rompe o loop /login <-> /dashboard causado por uma sessão Supabase
 * "presa": JWT válido, mas sem linha correspondente em public.users.
 *
 * Por que precisa ser um Route Handler (não uma função chamada direto do
 * Server Component de /dashboard): lib/supabase/server.ts já engole em
 * silêncio qualquer tentativa de escrever cookies feita durante o render de
 * um Server Component — é assim que o Next.js funciona, e o catch existe
 * exatamente para não derrubar a página nesse caso. Um Route Handler é o
 * único contexto, além de Server Action disparada pelo client, em que a
 * escrita de cookie realmente é aplicada na resposta.
 *
 * Escopo estrito — o que este handler NÃO faz:
 *   - não consulta nem escreve em public.users;
 *   - não cria perfil de nenhuma persona;
 *   - não atribui role;
 *   - não decide se o usuário "deveria" ter uma conta — só encerra a sessão
 *     Supabase corrente e manda para /login com uma mensagem humana.
 *
 * Microcorreção Q1 — signOut nunca deve impedir o redirect:
 *   Se signOut() retornar { error } ou lançar uma exceção (rede fora do ar,
 *   etc.), o usuário precisa sair do loop de qualquer forma. O redirect para
 *   /login?error=account_sync_required é o objetivo desta rota — ele não
 *   pode depender do sucesso do signOut. Nenhum dado de sessão (token,
 *   cookie, authId, e-mail, resposta do Supabase) é logado.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth/force-logout] signOut retornou erro");
    }
  } catch {
    console.error("[auth/force-logout] signOut lançou exceção");
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("error", "account_sync_required");
  return NextResponse.redirect(url);
}
