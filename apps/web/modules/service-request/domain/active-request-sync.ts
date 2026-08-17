/**
 * Módulo: service-request
 * Camada: domain — regra pura de quando sincronizar a tela de detalhe de uma
 * Request ativa (Care Operations V0 — R2B.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA LÓGICA VIVE AQUI, SEPARADA DO COMPONENTE REACT
 *
 * O projeto não tem jsdom/Testing Library — todo teste automatizado roda com
 * `node --test`, sem DOM. Um hook que mistura decisão ("devo atualizar
 * agora?") com efeito colateral (`setInterval`, `document.visibilityState`,
 * `router.refresh()`) fica testável só manualmente, no navegador. Extraindo a
 * decisão para uma função pura — sem timer, sem DOM, sem React — os 10
 * cenários exigidos pela missão viram `assert.equal` triviais, e o componente
 * (`ActiveRequestAutoRefresh`) vira só fiação: lê o estado do browser, chama
 * `shouldSync`, e executa `router.refresh()` quando a resposta é `true`.
 *
 * Mesmo padrão já usado no projeto para separar regra de efeito: ver
 * `resolveEffectiveOccurredAt` (care-timeline) e `resolveDiscoveryCity`
 * (discovery-filter) — os dois motivo de existir são idênticos.
 */

// Extensão .ts explícita: permite este módulo ser carregado direto por
// `node --experimental-strip-types --test`, sem bundler — mesmo padrão já
// usado em produção neste projeto (ex.: modules/location/domain/normalize.ts,
// lib/storage/care-media-validation.ts) e habilitado por
// `allowImportingTsExtensions` no tsconfig.
import { isTerminalStatus, type RequestStatus } from "./types.ts"

/**
 * Frescor operacional, não tempo real. 20s é o contrato V0 explícito da
 * missão — não configurável sem necessidade nova.
 */
export const ACTIVE_REQUEST_POLL_INTERVAL_MS = 20_000

/**
 * Janela mínima entre duas TENTATIVAS de sincronização, qualquer que seja o
 * gatilho (timer, focus, visibilitychange). Existe para colapsar rajadas —
 * `focus` e `visibilitychange` disparam quase juntos quando o usuário volta
 * para a aba, e sem isso os dois gerariam dois `router.refresh()` distintos.
 * Bem menor que o intervalo do timer (20s): não interfere na cadência normal,
 * só absorve eventos que chegam a poucos milissegundos um do outro.
 */
export const ACTIVE_REQUEST_SYNC_COOLDOWN_MS = 3_000

export type ActiveRequestSyncTrigger = "interval" | "focus" | "visible"

export type ActiveRequestSyncState = {
  status: RequestStatus
  /** `document.visibilityState === "visible"` */
  documentVisible: boolean
  /**
   * true quando existe QUALQUER interação local não salva registrada na tela
   * (ver useSuspendAutoRefreshWhileEditing) — rating sendo escolhido,
   * textarea com texto, formulário de disputa aberto, uma mutação de
   * aceitar/iniciar/concluir em andamento.
   */
  hasInteraction: boolean
  /** true enquanto um router.refresh() disparado por ESTE mecanismo está em voo. */
  isRefreshing: boolean
  /** Timestamp (ms) da última tentativa disparada, ou null se nenhuma ainda. */
  lastAttemptAt: number | null
}

/**
 * Estados em que a tela de detalhe pode mudar por ação de OUTRA pessoa
 * enquanto está aberta — é exatamente `!isTerminalStatus`, a mesma pergunta
 * que a state machine já responde. Nenhuma lista própria: PENDING/ACCEPTED/
 * IN_PROGRESS não são reafirmados aqui como constante paralela, que poderia
 * divergir da state machine real se ela ganhar um estado novo.
 *
 * DISPUTED entra na resposta "false" por este mesmo caminho — `isTerminalStatus`
 * já o trata como sem transições de saída (é tecnicamente inalcançável via
 * status; ver o comentário em VALID_TRANSITIONS). Nenhum comportamento
 * especial foi inventado para ele aqui.
 */
export function isRequestSyncActive(status: RequestStatus): boolean {
  return !isTerminalStatus(status)
}

/** O timer de polling deve existir agora? (decide criar/limpar o setInterval) */
export function shouldRunPollTimer(status: RequestStatus, documentVisible: boolean): boolean {
  return isRequestSyncActive(status) && documentVisible
}

/**
 * A pergunta central: ESTE gatilho, ESTE instante, deve resultar numa
 * tentativa de sincronização (probe)?
 *
 * IMPORTANTE (hardening pós-gate): isto NÃO decide mais se
 * `router.refresh()` roda — só se vale a pena CONSULTAR o backend agora. A
 * decisão de atualizar a UI de fato vem depois, comparando o token do probe
 * via `shouldRefreshAfterProbe`. Ver ActiveRequestAutoRefresh.tsx.
 *
 * O gate de status É condicional ao gatilho — motivo do achado do gate
 * independente: dados relacionados (disputa, review, Diário) podem mudar
 * SEM nenhuma transição de `ServiceRequest.status`. Barrar o timer em
 * terminal é certo (`shouldRunPollTimer` já faz isso — nenhum "interval"
 * chega aqui num estado terminal). Barrar TAMBÉM foco/visibilidade em
 * terminal não é — por isso só "interval" respeita o gate de status.
 *
 * Ordem das checagens, da mais barata para a mais sutil:
 *   1. timer em estado terminal?  → nunca (redundante com shouldRunPollTimer,
 *      mas mantém esta função correta por si só, independente da fiação)
 *   2. documento visível?         → nada em background
 *   3. sem interação local?       → nunca destrói formulário
 *   4. sem probe em voo?          → nunca duplica
 *   5. fora do cooldown?          → colapsa rajada focus+visibility
 */
export function shouldSync(
  trigger: ActiveRequestSyncTrigger,
  state: ActiveRequestSyncState,
  now: number
): boolean {
  if (trigger === "interval" && !isRequestSyncActive(state.status)) return false
  if (!state.documentVisible) return false
  if (state.hasInteraction) return false
  if (state.isRefreshing) return false
  if (state.lastAttemptAt !== null && now - state.lastAttemptAt < ACTIVE_REQUEST_SYNC_COOLDOWN_MS) {
    return false
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe — token comparável, sem PII
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrada do token: só os campos que, mudando, exigem atualizar a tela.
 * Nenhum nome, telefone, endereço ou conteúdo de texto — ids opacos (cuid),
 * enums de status e timestamps. Ver sync-snapshot.ts (infrastructure) para
 * a query que produz isto.
 */
export type RequestSyncSnapshotInput = {
  status: RequestStatus
  requestUpdatedAt: Date
  dispute: { id: string; status: string; resolvedAt: Date | null } | null
  review: { id: string; updatedAt: Date } | null
  latestCareUpdate: { id: string; editedAt: Date | null } | null
  /**
   * Quantas atualizações VISÍVEIS o Diário tem agora.
   *
   * Existe por causa do soft delete: excluir uma atualização que não é a mais
   * recente não muda `latestCareUpdate` nem `requestUpdatedAt`, e o Diário
   * aberto continuaria mostrando uma entrada que já não existe. A contagem é o
   * campo mais barato que detecta essa remoção — e, de quebra, cobre qualquer
   * inserção que por algum motivo não altere a última.
   */
  careUpdateCount: number
}

/**
 * Serialização determinística — não é hash, é só concatenação com
 * delimitadores fixos. Dois snapshots equivalentes sempre produzem a mesma
 * string; qualquer diferença relevante (novo id de disputa, review chegando,
 * novo CareUpdate) produz uma string diferente. Comparação é `!==` simples.
 */
export function buildRequestSyncToken(snapshot: RequestSyncSnapshotInput): string {
  const { status, requestUpdatedAt, dispute, review, latestCareUpdate, careUpdateCount } = snapshot
  const disputePart = dispute
    ? `${dispute.id}:${dispute.status}:${dispute.resolvedAt?.toISOString() ?? "-"}`
    : "-"
  const reviewPart = review ? `${review.id}:${review.updatedAt.toISOString()}` : "-"
  const carePart = latestCareUpdate
    ? `${latestCareUpdate.id}:${latestCareUpdate.editedAt?.toISOString() ?? "-"}`
    : "-"
  return [
    status,
    requestUpdatedAt.toISOString(),
    disputePart,
    reviewPart,
    carePart,
    String(careUpdateCount),
  ].join("|")
}

/**
 * Dado o resultado de um probe bem-sucedido, devemos chamar
 * `router.refresh()`?
 *
 * `previousToken === null` é o estado "ainda não fiz nenhum probe" — a
 * primeira leitura NUNCA sincroniza sozinha (o servidor já mandou o dado
 * fresco no render inicial); ela só estabelece a referência para a PRÓXIMA
 * comparação. Isto cobre os itens F/G/H exigidos pelo hardening: probe falho
 * não chega aqui (quem chama já retorna cedo); token igual → false; token
 * diferente → true, exatamente uma vez por diferença detectada.
 */
export function shouldRefreshAfterProbe(previousToken: string | null, currentToken: string): boolean {
  if (previousToken === null) return false
  return currentToken !== previousToken
}
