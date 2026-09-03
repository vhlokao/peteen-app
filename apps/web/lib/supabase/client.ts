"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client — use only in Client Components.
 *
 * Responsabilidades:
 *   - escutar mudanças de auth state (onAuthStateChange)
 *   - upload de arquivos via Supabase Storage
 *   - login/logout UI-driven
 *
 * NÃO usar para:
 *   - mutações de trust score, ranking, CRM
 *   - leitura de dados de negócio (use Server Actions + Prisma)
 *
 * `autoRefreshToken: false` — GATE 1 (persistência de sessão iPhone/PWA).
 *
 * `middleware.ts` já chama `supabase.auth.getUser()` em toda navegação
 * server-side, o que revalida e renova a sessão via HTTP `Set-Cookie` real
 * quando necessário — o caminho robusto, porque o browser recebe o cookie
 * novo como parte da própria resposta de navegação.
 *
 * Com o default do SDK (`autoRefreshToken: true`), este client MONTADO EM
 * TODA PÁGINA (`SupabaseAuthProvider`, no layout raiz) também arma um timer
 * próprio de refresh, que escreve o token renovado via `document.cookie` (não
 * há resposta HTTP para o client anexar um header). O refresh_token do
 * Supabase é ROTATIVO e de uso único: se o timer do client e o refresh do
 * middleware dispararem perto um do outro — cold start é exatamente o cenário
 * em que os dois primeiros requests (servidor e client) acontecem quase
 * juntos, depois de o app ter passado um tempo em segundo plano — o segundo a
 * chegar reusa um refresh_token que o primeiro já invalidou, recebe
 * "already used" do Supabase Auth, e a sessão é encerrada localmente.
 *
 * Isso explica a assimetria observada: navegador desktop mantém o processo
 * vivo continuamente, então os dois refreshes raramente colidem; um PWA iOS
 * fechado por completo e reaberto força os dois primeiros requests (server +
 * client) a nascerem juntos, no pior momento possível para essa corrida.
 *
 * `persistSession` continua no default (true): o client ainda precisa LER a
 * sessão existente dos cookies para `onAuthStateChange` e para decidir estado
 * de UI — só o timer de renovação PROATIVA é removido, porque já é
 * redundante com o do middleware.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
      },
    }
  );
}
