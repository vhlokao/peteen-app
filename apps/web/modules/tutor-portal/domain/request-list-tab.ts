/**
 * Módulo: tutor-portal
 * Camada: domain — normalização da aba (Ativos/Anteriores) de /tutor/requests
 * e construção dos hrefs que preservam esse contexto na volta do detalhe.
 *
 * GATE-5-NAV-CONTEXT-001: a aba selecionada não sobrevivia à navegação para
 * o detalhe e volta — `TutorRequestsTabs` guardava a aba só em `useState`
 * local, o card do detalhe não carregava contexto nenhum, e o botão Voltar
 * apontava fixo para `/tutor/requests` (sempre reabre em Ativos). A correção
 * é pôr a aba na URL (`?tab=previous`), que sobrevive a navegação, refresh e
 * deep link sem precisar de estado global.
 */

export type TutorRequestsTab = "active" | "previous"

const DEFAULT_TAB: TutorRequestsTab = "active"

/** Normaliza o `tab` recebido de `searchParams` (string | string[] | undefined). */
export function parseTutorRequestsTab(raw: string | string[] | undefined): TutorRequestsTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === "previous" ? "previous" : DEFAULT_TAB
}

/** URL da lista que restaura a aba indicada — omite o parâmetro no caso padrão. */
export function tutorRequestsListHref(tab: TutorRequestsTab): string {
  return tab === "previous" ? "/tutor/requests?tab=previous" : "/tutor/requests"
}

/** URL do detalhe carregando a aba de origem, para o botão Voltar poder restaurá-la. */
export function tutorRequestDetailHref(requestId: string, tab: TutorRequestsTab): string {
  return tab === "previous"
    ? `/tutor/requests/${requestId}?tab=previous`
    : `/tutor/requests/${requestId}`
}
