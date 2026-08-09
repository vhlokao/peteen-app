/**
 * Módulo: notifications
 * Camada: domain — tipos de Web Push (Foundation V0.1 + V0.2)
 *
 * Push é canal ADICIONAL e best-effort. A central in-app (queries.ts) continua
 * sendo a fonte da verdade e o histórico — ela deriva tudo do domínio na leitura
 * e não depende de nada aqui. Perder um push nunca perde informação.
 *
 * Nenhum tipo deste arquivo toca banco, rede ou Next.js.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Payload — TIPO FECHADO POR CONSTRUÇÃO (branded)
//
// A QA independente apontou, com razão, que um tipo estrutural simples
// (`{title, body, url}: string`) NÃO impede um caller futuro de escrever
// `{ title: tutor.displayName, ... }`. A garantia de "nunca interpolado" era
// convenção documentada, não contrato aplicado pelo compilador.
//
// A marca abaixo fecha isso: o símbolo é privado ao módulo, então NENHUM código
// fora de push-events.ts consegue produzir um objeto que satisfaça este tipo.
// A única porta de entrada é `buildPushPayload(kind, rota)`, que escolhe a copy
// de uma tabela constante e valida a rota. Tentar montar um literal com dado de
// entidade não compila.
//
// NUNCA persistido — PushDelivery não tem colunas para title/body/url por
// decisão de schema. O payload existe só em memória, durante o envio.
// ─────────────────────────────────────────────────────────────────────────────

declare const PUSH_PAYLOAD_BRAND: unique symbol

export type PushPayload = {
  /** Constante do domínio. Nunca interpolado. */
  readonly title: string
  /** Constante do domínio. Nunca interpolado. */
  readonly body: string
  /** Rota interna same-origin, já validada pelo parser WHATWG. */
  readonly url: string
  /** Agrupa notificações do mesmo assunto no SO, evitando empilhamento. */
  readonly tag: string
  /** Marca privada — impede construção de payload fora da factory do domínio. */
  readonly [PUSH_PAYLOAD_BRAND]: true
}

// ─────────────────────────────────────────────────────────────────────────────
// Evento lógico a despachar
// ─────────────────────────────────────────────────────────────────────────────

export type PushDispatchInput = {
  /** Identidade lógica — ver buildEventKey. É a trava de idempotência. */
  eventKey: string
  /** Descritivo, para observabilidade. Nunca participa do dedup. */
  eventType: string
  /** Descritivo, id técnico puro. Nunca participa do dedup. */
  entityId: string
  /**
   * Resolvido SEMPRE no servidor a partir da entidade.
   * NUNCA aceito de client — ver dispatch-push.ts.
   */
  recipientUserId: string
  payload: PushPayload
}

export type PushDispatchResult = {
  /** true quando o eventKey já havia sido despachado (P2002) — nenhum envio novo. */
  alreadyDispatched: boolean
  /** false quando VAPID não está configurado — no-op seguro. */
  pushEnabled: boolean
  attempted: number
  /** Aceito pelo PUSH SERVICE. NÃO é entrega ao device. */
  accepted: number
  failed: number
  /** 404/410 — subscription morta, revogada como `gone`. */
  invalid: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Classificação do resultado do push service
//
// `accepted` significa que o push service aceitou a mensagem para entrega. O
// aparelho pode estar offline (fica na fila com TTL), o usuário pode ter
// notificação muda no SO, o SW pode falhar ao renderizar. Não existe
// `delivered` nem `read`: não são observáveis por Web Push.
// ─────────────────────────────────────────────────────────────────────────────

export type PushSendOutcome = "accepted" | "invalid" | "failed"

// ─────────────────────────────────────────────────────────────────────────────
// Razões de revogação — fechadas (schema limita a VARCHAR(40))
// ─────────────────────────────────────────────────────────────────────────────

export const REVOKED_REASONS = ["logout", "user_optout", "gone", "account_cleanup"] as const
export type RevokedReason = (typeof REVOKED_REASONS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Códigos de erro das Server Actions
//
// Genéricos de propósito: SUBSCRIPTION_CONFLICT nunca revela QUE o endpoint
// pertence a outro usuário — isso viraria oráculo de enumeração.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_ERROR_CODES = [
  "SUBSCRIPTION_CONFLICT",
  "RATE_LIMIT_DEVICES",
  "RATE_LIMIT_CREATES",
  "PUSH_DISABLED",
  "INVALID_SUBSCRIPTION",
  "UNAUTHENTICATED",
  "INTERNAL",
] as const
export type PushErrorCode = (typeof PUSH_ERROR_CODES)[number]

export type PushActionResult =
  | { success: true; alreadyActive: boolean }
  | { success: false; code: PushErrorCode }

/** Dados que o client envia ao assinar. Nunca inclui identificação de usuário. */
export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Limites — conscientemente pequenos e sem infraestrutura nova.
// Ambos são consultas contra a própria push_subscriptions.
// ─────────────────────────────────────────────────────────────────────────────

/** Teto de devices ativos por usuário. Ao atingir, rejeita — nunca revoga LRU. */
export const MAX_ACTIVE_SUBSCRIPTIONS_PER_USER = 6

/** Teto de subscriptions NOVAS por usuário por janela. Refresh não conta. */
export const MAX_CREATES_PER_WINDOW = 10
export const CREATE_WINDOW_MS = 60 * 60 * 1000
