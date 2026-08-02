/**
 * Módulo: service-request
 * Camada: domain
 *
 * Fonte única do prazo efetivo de resposta de uma solicitação PENDING.
 * Nenhum campo `expiresAt` é persistido — o prazo é sempre recalculado a
 * partir de `createdAt`/`scheduledAt`, os dois únicos campos que já
 * existem no modelo. Toda leitura de "está vencida?" (aceite, cron,
 * sincronização lazy) passa por esta função — nunca reimplementar a conta
 * em outro arquivo.
 *
 * Regra (aprovada):
 *   effectiveExpiry = menor entre:
 *     1. createdAt + 24 horas
 *     2. scheduledAt - 1 hora
 *
 *   Exceção: se scheduledAt estiver a menos de 1 hora de createdAt (inclui
 *   scheduledAt no passado ou igual a createdAt), o prazo final é o
 *   próprio scheduledAt — não faz sentido dar 23h de prazo para um pedido
 *   cujo atendimento é "daqui a 20 minutos".
 *
 *   Se scheduledAt for null: effectiveExpiry = createdAt + 24 horas.
 *
 * Nunca aceitar uma request quando:
 *   - now >= effectiveExpiry; OU
 *   - now >= scheduledAt (quando existir).
 *
 * As duas condições nunca divergem por construção (effectiveExpiry é
 * sempre <= scheduledAt quando scheduledAt existe — ver prova nos
 * comentários de `getRequestExpiryInfo`), mas a segunda checagem é mantida
 * explícita como defesa em profundidade: se a fórmula acima for alterada
 * no futuro e essa invariante for quebrada por engano, a checagem
 * separada ainda impede aceitar depois do horário do atendimento.
 */

const PENDING_MAX_AGE_HOURS = 24
const SCHEDULED_SAFETY_MARGIN_HOURS = 1

const PENDING_MAX_AGE_MS = PENDING_MAX_AGE_HOURS * 60 * 60 * 1000
const SCHEDULED_SAFETY_MARGIN_MS = SCHEDULED_SAFETY_MARGIN_HOURS * 60 * 60 * 1000

export { PENDING_MAX_AGE_HOURS, SCHEDULED_SAFETY_MARGIN_HOURS }

/**
 * Calcula o instante em que uma solicitação PENDING deixa de poder ser
 * aceita. Pura — não lê relógio nem banco.
 */
export function calculateEffectiveExpiry(createdAt: Date, scheduledAt: Date | null): Date {
  const maxByAge = new Date(createdAt.getTime() + PENDING_MAX_AGE_MS)

  if (!scheduledAt) return maxByAge

  const gapMs = scheduledAt.getTime() - createdAt.getTime()

  // scheduledAt a menos de 1h da criação (inclui igual ou no passado):
  // o prazo final é o próprio scheduledAt, sem margem de segurança —
  // não há 1h de sobra para subtrair de um atendimento "daqui a pouco".
  if (gapMs < SCHEDULED_SAFETY_MARGIN_MS) {
    return scheduledAt
  }

  const byScheduled = new Date(scheduledAt.getTime() - SCHEDULED_SAFETY_MARGIN_MS)
  return maxByAge.getTime() <= byScheduled.getTime() ? maxByAge : byScheduled
}

export type RequestExpiryInfo = {
  /** Instante em que a solicitação deixa de poder ser aceita. */
  effectiveExpiry: Date
  /** true quando `now` já alcançou o prazo (ou o próprio scheduledAt). */
  isExpired: boolean
  /** Tempo restante em ms até o prazo — null quando já expirada. */
  msRemaining: number | null
}

/**
 * Avalia o prazo de uma solicitação PENDING no instante `now` (default:
 * agora). Único ponto de decisão de "está vencida?" em todo o sistema.
 */
export function getRequestExpiryInfo(
  createdAt: Date,
  scheduledAt: Date | null,
  now: Date = new Date()
): RequestExpiryInfo {
  const effectiveExpiry = calculateEffectiveExpiry(createdAt, scheduledAt)

  const expiredByEffectiveExpiry = now.getTime() >= effectiveExpiry.getTime()
  const expiredByScheduledAt = scheduledAt !== null && now.getTime() >= scheduledAt.getTime()
  const isExpired = expiredByEffectiveExpiry || expiredByScheduledAt

  return {
    effectiveExpiry,
    isExpired,
    msRemaining: isExpired ? null : effectiveExpiry.getTime() - now.getTime(),
  }
}

/** Atalho quando só o booleano importa (ex.: guards). */
export function isRequestExpired(
  createdAt: Date,
  scheduledAt: Date | null,
  now: Date = new Date()
): boolean {
  return getRequestExpiryInfo(createdAt, scheduledAt, now).isExpired
}
