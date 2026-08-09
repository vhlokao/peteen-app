/**
 * Sequência de logout com revogação de push.
 *
 * ORDEM OBRIGATÓRIA — derivada de fato auditado, não de preferência:
 *
 *   1. revogar no servidor (autenticado)   ← ÚNICA janela com sessão válida
 *   2. pushManager.unsubscribe()           ← mata a subscription na origem
 *   3. supabase.auth.signOut({ local })    ← sessão morre por último
 *
 * Por que 1 precisa vir antes: `signOut()` destrói a sessão, e depois dele
 * qualquer Server Action com `requireAuth()` falha com UNAUTHENTICATED. Não há
 * como revogar de forma autenticada após o logout.
 *
 * Por que NÃO basta `onAuthStateChange(SIGNED_OUT)`: ele roda sem sessão, então
 * só consegue agir no browser. Expor um endpoint de revogação não autenticado
 * seria vetor de DoS (qualquer um derrubaria subscriptions alheias adivinhando
 * endpoints). Ele permanece como defesa complementar, nunca como mecanismo
 * principal.
 *
 * Por que `scope: "local"`: o default do Supabase é GLOBAL — sair no celular
 * derrubaria a sessão do notebook. Com push isso fica pior: Web Push e Supabase
 * Auth são sistemas INDEPENDENTES, e nenhum signOut (nem global) invalida uma
 * subscription no push service. O device remoto ficaria sem sessão mas seguiria
 * com subscription viva, e nenhum 404/410 apareceria para curar o estado —
 * porque a subscription não morreu. "Sair de todos os dispositivos" precisa ser
 * uma ação explícita que revogue TODAS as subscriptions no servidor; é evolução
 * futura, deliberadamente fora desta missão.
 *
 * BEST-EFFORT: nada aqui pode impedir o logout. Logout é ação de segurança e
 * precisa sempre concluir — mesmo princípio já documentado em
 * app/auth/force-logout/route.ts ("signOut nunca deve impedir o redirect").
 */

import { desinscreverLocalmente, obterEndpointAtual } from "./client"

/** Teto para a etapa de revogação. Estourou, segue para o signOut mesmo assim. */
const REVOKE_TIMEOUT_MS = 2000

function comTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

/**
 * Executa os passos 1 e 2. O chamador faz o passo 3 (`signOut`) logo depois.
 *
 * Nunca lança: toda falha é engolida de propósito.
 */
export async function revogarPushAntesDoLogout(): Promise<void> {
  try {
    const endpoint = await comTimeout(obterEndpointAtual(), REVOKE_TIMEOUT_MS)
    if (endpoint) {
      // Import dinâmico: mantém a Server Action fora do bundle inicial dos
      // botões de logout, que são renderizados em toda navegação.
      const { revokePushOnLogoutAction } = await import(
        "@/modules/notifications/application/push-actions"
      )
      await comTimeout(revokePushOnLogoutAction(endpoint), REVOKE_TIMEOUT_MS)
    }
    await comTimeout(desinscreverLocalmente(), REVOKE_TIMEOUT_MS)
  } catch {
    // Silencioso por contrato — logout tem prioridade absoluta.
  }
}
