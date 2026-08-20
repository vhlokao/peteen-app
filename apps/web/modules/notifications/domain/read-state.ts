/**
 * Módulo: notifications
 * Camada: domain — regra pura de leitura/não-leitura da central e do probe
 * barato de novidade (PRE-PILOT — NOTIFICATION CENTER RELIABILITY & UX).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UMA FUNÇÃO PURA E NÃO UM `include` DO PRISMA
 *
 * O feed não é uma tabela: é derivado em tempo de request (ver
 * infrastructure/queries.ts). Não existe linha de notificação para dar `join`
 * com o estado de leitura — a junção acontece em memória, contra as chaves
 * sintéticas que a derivação produz. Sendo em memória, é uma decisão de
 * domínio, e por isso mora aqui: testável sem banco, sem DOM, sem React.
 *
 * A CHAVE É A PONTE. `notif-tutor-accepted-<requestId>` é determinística —
 * deriva do tipo do evento + id da entidade de origem, nunca de `Date.now()`
 * nem de índice de array. Mesmo evento ⇒ mesma chave, entre renders e entre
 * sessões. É isso que permite persistir leitura sem materializar o feed.
 *
 * AUSÊNCIA DE LINHA = NÃO LIDA. Nunca o contrário: um evento novo nasce
 * unread por definição, e nenhum backfill foi necessário para os usuários que
 * já existiam quando a tabela foi criada.
 */

import type { NotificationItem } from "./types.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Junção feed derivado × estado de leitura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carimba `isRead` em cada item a partir do conjunto de chaves já lidas.
 *
 * Recebe um `Set` e não um array: a junção é O(n) sobre o feed, não O(n×m).
 * O chamador (application) monta o Set a partir de UMA query indexada por
 * `(userId, notificationKey)`.
 */
export function applyReadState(
  items: NotificationItem[],
  readKeys: ReadonlySet<string>
): NotificationItem[] {
  return items.map((item) => ({ ...item, isRead: readKeys.has(item.id) }))
}

/**
 * Quantas notificações do feed ainda não foram lidas.
 *
 * Conta sobre o feed JÁ derivado — nunca dispara derivação própria. Quem
 * precisa só do número (o badge do layout) deve reaproveitar o feed que já
 * buscou, ou aceitar o custo conscientemente; ver o comentário de
 * `buildNotificationProbeToken` sobre por que o probe NÃO usa este caminho.
 */
export function countUnread(items: NotificationItem[]): number {
  return items.reduce((total, item) => (item.isRead ? total : total + 1), 0)
}

/**
 * Chaves que "marcar todas como lidas" deve persistir: só as que ainda não
 * estão lidas, evitando escrever linha para o que já tem.
 *
 * A autorização NÃO vem daqui — a lista de entrada é sempre o feed derivado
 * no SERVIDOR para o usuário autenticado, nunca uma lista vinda do cliente.
 * Ver a Server Action correspondente.
 */
export function unreadKeysToPersist(items: NotificationItem[]): string[] {
  return items.filter((item) => !item.isRead).map((item) => item.id)
}

/**
 * Uma chave só pode ser marcada como lida se pertencer ao feed atual do
 * próprio usuário. Existe para que a Server Action de "marcar uma" nunca
 * confie na string enviada pelo cliente: sem esta checagem, qualquer chave
 * arbitrária viraria uma linha em `notification_reads` (poluição de tabela e
 * vazamento da existência de eventos alheios por tentativa e erro).
 */
export function isKeyOwnedByFeed(items: NotificationItem[], key: string): boolean {
  return items.some((item) => item.id === key)
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────

/** Acima deste total o badge para de mostrar o número exato. */
export const NOTIFICATION_BADGE_MAX = 9

/**
 * Texto do badge: `null` quando não há nada a mostrar — o componente não
 * renderiza o elemento, em vez de renderizar um "0" que lê como pendência.
 */
export function formatBadgeCount(unreadCount: number): string | null {
  if (unreadCount <= 0) return null
  if (unreadCount > NOTIFICATION_BADGE_MAX) return `${NOTIFICATION_BADGE_MAX}+`
  return String(unreadCount)
}

/**
 * Rótulo acessível do sino. O badge é visual; um leitor de tela precisa da
 * mesma informação em texto — e o número exato, não o "9+" truncado.
 */
export function buildBellAriaLabel(unreadCount: number): string {
  if (unreadCount <= 0) return "Notificações"
  if (unreadCount === 1) return "Notificações, 1 não lida"
  return `Notificações, ${unreadCount} não lidas`
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe barato de novidade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assinatura mínima das fontes que alimentam o feed de um papel.
 *
 * POR QUE NÃO RE-DERIVAR O FEED A CADA 10s: `getTutorNotifications` executa
 * 4–5 queries e monta objetos em memória. Rodar isso a cada ciclo, por aba
 * aberta, é exatamente o "polling pesado" que a missão veta. O probe troca
 * essa derivação por agregações que o Postgres resolve pelos índices já
 * existentes — `max(updatedAt)` e `count` sobre as MESMAS tabelas de origem.
 *
 * A pergunta que o probe responde não é "quais são minhas notificações?",
 * é apenas "mudou alguma coisa desde a última vez?". Se mudou, o
 * `router.refresh()` re-renderiza o Server Component, e AÍ sim a derivação
 * completa roda — uma vez, sob demanda, em vez de a cada tique.
 *
 * `readCount` participa porque marcar como lida também muda o que a tela
 * mostra (badge e destaque do item) sem alterar nenhuma tabela de origem.
 */
export type NotificationProbeSource = {
  /** Instante mais recente entre as fontes do papel; null = nenhuma linha. */
  latestActivityAt: Date | null
  /** Quantas linhas relevantes existem — pega remoção, que `max` não pega. */
  activityCount: number
  /** Quantas marcações de leitura o usuário tem na janela do feed. */
  readCount: number
}

/**
 * Token determinístico e sem PII: só um timestamp ISO e dois inteiros.
 * Nenhum id, nome, telefone ou conteúdo trafega a cada ciclo — a mesma
 * postura do token de sync das Requests.
 */
export function buildNotificationProbeToken(source: NotificationProbeSource): string {
  return [
    source.latestActivityAt?.toISOString() ?? "-",
    String(source.activityCount),
    String(source.readCount),
  ].join("|")
}

/**
 * Mesma semântica do auto-sync de Requests: a primeira leitura só estabelece
 * a referência (o servidor já entregou dado fresco no render inicial), e só
 * uma diferença real dispara refresh — nunca o timer sozinho.
 */
export function shouldRefreshNotifications(
  previousToken: string | null,
  currentToken: string
): boolean {
  if (previousToken === null) return false
  return currentToken !== previousToken
}

/** Cadência do probe enquanto a aba está visível (item 8 da missão). */
export const NOTIFICATION_PROBE_INTERVAL_MS = 10_000

/**
 * Colapsa rajada: `focus` e `visibilitychange` disparam quase juntos quando o
 * usuário volta para a aba, e sem isto os dois gerariam dois probes.
 */
export const NOTIFICATION_PROBE_COOLDOWN_MS = 3_000

export type NotificationProbeTrigger = "interval" | "focus" | "visible"

export type NotificationProbeState = {
  documentVisible: boolean
  /** Um probe (ou refresh) já em voo — nunca dois em paralelo. */
  isProbing: boolean
  lastAttemptAt: number | null
}

/**
 * Vale consultar o backend AGORA?
 *
 * Deliberadamente NÃO importa `shouldSyncGeneric` de service-request: são
 * bounded contexts distintos, e acoplar a central de notificações ao módulo
 * de Requests criaria uma dependência que nada no domínio justifica. A regra
 * é a mesma por convergência de necessidade, não por herança — e aqui é mais
 * simples, porque a central não tem formulário cujo rascunho um refresh
 * possa destruir.
 */
export function shouldProbeNotifications(
  _trigger: NotificationProbeTrigger,
  state: NotificationProbeState,
  now: number
): boolean {
  if (!state.documentVisible) return false
  if (state.isProbing) return false
  if (
    state.lastAttemptAt !== null &&
    now - state.lastAttemptAt < NOTIFICATION_PROBE_COOLDOWN_MS
  ) {
    return false
  }
  return true
}
