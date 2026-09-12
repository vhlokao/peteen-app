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
 * ─────────────────────────────────────────────────────────────────────────────
 * SA-013 (Superaudit pré-piloto) — A REGRA ANTERIOR TINHA UM PENHASCO NA
 * FRONTEIRA DE 1H, JÁ CORRIGIDO AQUI
 *
 * A versão anterior era duas fórmulas cortadas exatamente em
 * `gapMs === margem`: abaixo da margem, o prazo era o próprio `scheduledAt`
 * (janela = gap inteiro); a partir da margem, o prazo virava
 * `scheduledAt - margem` (janela = gap - margem). Executando a função real
 * numa matriz de antecedências, a janela ia de 59min (gap=59min) para 0min
 * (gap=60min, EXATAMENTE no pé da margem) e só recuperava aos poucos
 * (1min a 65min de gap, 60min só em 120min de gap) — um pedido que o
 * próprio produto permite criar (lead time mínimo de 15min) podia nascer
 * praticamente morto ou já morto.
 *
 * A CORREÇÃO: a margem efetivamente subtraída não salta de 0 para 1h no
 * instante em que o gap cruza 1h — ela SOBE LINEARMENTE de 0 até a margem
 * cheia enquanto o gap percorre de 1h até 2h, e só then permanece na
 * margem cheia daí em diante:
 *
 *   margemEfetiva(gap) = clamp(gap - margem, 0, margem)
 *   effectiveExpiry    = min(createdAt + 24h, scheduledAt - margemEfetiva(gap))
 *
 * Isto colapsa nas mesmas três faixas de sempre, sem descontinuidade em
 * nenhuma junção (prova por substituição, com margem = 1h):
 *   - gap <= margem       (<=1h):  margemEfetiva = 0        → janela = gap
 *     (idêntico à exceção antiga — nenhuma mudança de comportamento aqui)
 *   - margem <= gap <= 2×margem (1h–2h): margemEfetiva = gap-margem
 *     → janela = gap - (gap-margem) = margem (CONSTANTE, um platô de 1h
 *     inteira — é exatamente a faixa onde a fórmula antiga produzia o
 *     penhasco e a recuperação lenta; agora ela garante o piso cheio)
 *   - gap >= 2×margem     (>=2h):  margemEfetiva = margem    → janela = gap-margem
 *     (idêntico à regra normal antiga para atendimentos bem no futuro —
 *     nenhuma mudança de comportamento aqui também)
 *
 * Em cada junção (gap=margem e gap=2×margem) as duas faixas vizinhas
 * concordam exatamente no mesmo valor — é isso que elimina o penhasco sem
 * introduzir nenhum novo. A função é contínua e não-decrescente em `gap`
 * em toda a reta, e nunca devolve janela <= 0 para nenhum gap >= 0 (a
 * antecedência mínima de criação, 15min, está inteiramente dentro da
 * primeira faixa, onde o comportamento não mudou).
 *
 * `scheduledAt` no passado ou igual a `createdAt` (gap <= 0) continua
 * caindo na primeira faixa (`clamp` satura em 0), preservando o mesmo
 * `expiry = scheduledAt` de sempre para esses casos.
 *
 * Se scheduledAt for null: effectiveExpiry = createdAt + 24 horas.
 *
 * Nunca aceitar uma request quando:
 *   - now >= effectiveExpiry; OU
 *   - now >= scheduledAt (quando existir).
 *
 * As duas condições nunca divergem por construção (effectiveExpiry é
 * sempre <= scheduledAt quando scheduledAt existe — a margem efetiva
 * nunca é negativa, então `scheduledAt - margemEfetiva <= scheduledAt`
 * para qualquer gap), mas a segunda checagem é mantida explícita como
 * defesa em profundidade: se a fórmula acima for alterada no futuro e
 * essa invariante for quebrada por engano, a checagem separada ainda
 * impede aceitar depois do horário do atendimento.
 */

const PENDING_MAX_AGE_HOURS = 24
const SCHEDULED_SAFETY_MARGIN_HOURS = 1

const PENDING_MAX_AGE_MS = PENDING_MAX_AGE_HOURS * 60 * 60 * 1000
const SCHEDULED_SAFETY_MARGIN_MS = SCHEDULED_SAFETY_MARGIN_HOURS * 60 * 60 * 1000

export { PENDING_MAX_AGE_HOURS, SCHEDULED_SAFETY_MARGIN_HOURS }

/**
 * Margem de segurança efetivamente aplicada para um dado `gapMs`
 * (`scheduledAt - createdAt`). Extraída como função própria porque é ela
 * — e só ela — quem elimina o penhasco de SA-013: em vez de saltar de 0
 * para `SCHEDULED_SAFETY_MARGIN_MS` no instante em que o gap cruza a
 * margem, ela sobe linearmente ao longo do segundo intervalo de margem
 * (ver prova no cabeçalho do arquivo). `gapMs` negativo (scheduledAt no
 * passado) satura em 0, preservando o caso já coberto.
 */
function margemEfetivaMs(gapMs: number): number {
  return Math.min(Math.max(gapMs - SCHEDULED_SAFETY_MARGIN_MS, 0), SCHEDULED_SAFETY_MARGIN_MS)
}

/**
 * Calcula o instante em que uma solicitação PENDING deixa de poder ser
 * aceita. Pura — não lê relógio nem banco.
 */
export function calculateEffectiveExpiry(createdAt: Date, scheduledAt: Date | null): Date {
  const maxByAge = new Date(createdAt.getTime() + PENDING_MAX_AGE_MS)

  if (!scheduledAt) return maxByAge

  const gapMs = scheduledAt.getTime() - createdAt.getTime()
  const byScheduled = new Date(scheduledAt.getTime() - margemEfetivaMs(gapMs))

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
