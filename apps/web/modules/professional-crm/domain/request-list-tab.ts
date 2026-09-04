/**
 * Módulo: professional-crm
 * Camada: domain — normalização da aba (Novas/Em andamento/Histórico) de
 * /requests (visão do profissional) e construção dos hrefs que preservam
 * esse contexto na volta do detalhe.
 *
 * GATE-5-NAV-CONTEXT-001: mesmo padrão confirmado em Tutor Requests —
 * `ProfessionalRequestsTabs` guardava a aba só em `useState` local, sem
 * sobreviver a navegação/refresh. Mesma correção: aba na URL (`?tab=...`).
 */

export type ProfessionalRequestsTab = "new" | "ongoing" | "history"

const VALID_TABS = new Set<string>(["new", "ongoing", "history"])
const DEFAULT_TAB: ProfessionalRequestsTab = "new"

/**
 * Normaliza o `tab` recebido de `searchParams`. Sem parâmetro válido, cai no
 * mesmo default sensível a dados que a tela sempre teve: começa em "new"
 * quando há solicitações novas aguardando, senão em "ongoing".
 */
export function parseProfessionalRequestsTab(
  raw: string | string[] | undefined,
  newCount: number
): ProfessionalRequestsTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && VALID_TABS.has(value)) return value as ProfessionalRequestsTab
  return newCount > 0 ? DEFAULT_TAB : "ongoing"
}

/** URL da lista que restaura a aba indicada — omite o parâmetro no caso padrão. */
export function professionalRequestsListHref(tab: ProfessionalRequestsTab): string {
  return tab === DEFAULT_TAB ? "/requests" : `/requests?tab=${tab}`
}

/**
 * Resolve o href de volta para a lista a partir do `tab` cru vindo da URL do
 * detalhe — usado pelo botão Voltar, que não tem acesso a `newCount` (esse
 * dado pertence à lista, não ao detalhe). Sem `tab` explícito e válido,
 * volta para `/requests` sem parâmetro: a lista decide seu próprio default
 * sensível a dados ao montar, exatamente como antes desta correção.
 */
export function professionalRequestsBackHref(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && VALID_TABS.has(value)
    ? professionalRequestsListHref(value as ProfessionalRequestsTab)
    : "/requests"
}

/** URL do detalhe carregando a aba de origem, para o botão Voltar poder restaurá-la. */
export function professionalRequestDetailHref(
  requestId: string,
  tab: ProfessionalRequestsTab
): string {
  return tab === DEFAULT_TAB ? `/requests/${requestId}` : `/requests/${requestId}?tab=${tab}`
}
