/**
 * Módulo: invite
 * Camada: domain — propagação do destino contextual (`next`) pelo onboarding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O onboarding do tutor terminava com `router.push("/discover")` fixo. Para
 * quem chegou por um convite, isso significa: abrir o link de alguém, criar
 * conta, cadastrar o pet — e ser despejado numa busca genérica, tendo que
 * reencontrar sozinho a pessoa que o convidou. O contexto morria exatamente
 * no ponto em que a conversão aconteceria.
 *
 * O `next` viaja pela URL de cada etapa (`?next=/p/<id>`), não por estado de
 * servidor: o onboarding tem várias páginas e um retorno de OAuth no meio,
 * e a URL é o único carregador que sobrevive a tudo isso sem sessão nova.
 *
 * SEGURANÇA: todo consumo passa por `isSafeRedirectPath` (mesma função do
 * login), que rejeita URL absoluta, protocol-relative e qualquer coisa com
 * "://" — um `next` hostil nunca vira redirect externo.
 */

// Caminho relativo com extensão .ts explícita: permite este módulo ser
// carregado por `node --experimental-strip-types --test`, que não resolve o
// alias "@/". Mesmo padrão já usado em modules/service-request/domain/
// active-request-sync.ts e habilitado por `allowImportingTsExtensions`.
import { isSafeRedirectPath } from "../../identity/domain/safe-redirect.ts"

/** Destino padrão quando não há contexto de convite. Comportamento atual. */
export const DEFAULT_ONBOARDING_DESTINATION = "/discover"

/**
 * Normaliza o `next` recebido de `searchParams` (que pode vir string,
 * array ou ausente) para um caminho interno seguro, ou `null`.
 */
export function parseNextParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return isSafeRedirectPath(value) ? value : null
}

/**
 * Anexa `?next=` a um caminho interno, preservando querystring já existente.
 * Devolve o caminho intocado quando não há contexto — nenhuma etapa do
 * onboarding ganha parâmetro vazio à toa.
 */
export function withNext(path: string, next: string | null): string {
  if (!next) return path
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}next=${encodeURIComponent(next)}`
}

/**
 * Para onde o onboarding termina: o contexto do convite quando existe e é
 * seguro, senão o Discovery de sempre.
 */
export function resolveOnboardingDestination(next: string | null): string {
  return next && isSafeRedirectPath(next) ? next : DEFAULT_ONBOARDING_DESTINATION
}
