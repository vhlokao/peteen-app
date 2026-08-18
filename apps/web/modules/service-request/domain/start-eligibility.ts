/**
 * Módulo: service-request
 * Camada: domain — quando "Iniciar atendimento" pode ser aceito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ISTO FECHA
 *
 * `RequestActions.tsx` decidia isso comparando DIAS civis com `new Date()` e
 * `setHours(0,0,0,0)` — no fuso do NAVEGADOR, sem tolerância nenhuma dentro do
 * dia. Um atendimento marcado para 20:00 podia começar às 07:00 do mesmo dia,
 * porque "hoje" já bastava. O servidor não tinha guard equivalente: só
 * recusava se `scheduledAt` estivesse a mais de 24h no PASSADO — nada impedia
 * o FUTURO.
 *
 * ACEITAR (`acceptServiceRequestAction`) continua sem restrição de horário —
 * um compromisso pode ser confirmado dias antes. Este módulo é só sobre
 * INICIAR: o instante em que o atendimento realmente passa a existir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DECISÃO É POR INSTANTE, NÃO POR DIA CIVIL — SÓ QUANDO HÁ UM INSTANTE REAL
 *
 * `scheduledHasTime` decide qual regra se aplica, e é a MESMA fonte que
 * `schedule-precision.ts` já usa para decidir se o horário pode ser exibido:
 *
 *   true  → `scheduledAt` é um instante real, escolhido por alguém. A janela é
 *           `[scheduledAt - tolerância, +∞)`, comparada por INSTANTE.
 *   false → `scheduledAt` é uma âncora técnica (meio-dia UTC, ou meia-noite em
 *           registros mais antigos) que NUNCA representa hora escolhida —
 *           tratá-la com tolerância de minutos criaria uma regra de horário a
 *           partir de um dado que não é horário. Aqui a regra permanece a de
 *           SEMPRE: dia civil, no fuso do piloto — o que o produto já garantia
 *           antes desta correção, agora calculado com o helper canônico em vez
 *           de `Date` cru do navegador.
 *
 * Sem `scheduledAt` (nenhum compromisso registrado) não há o que comparar:
 * sempre elegível — mesmo comportamento de sempre, agora explícito.
 */

// Caminho relativo com extensão .ts: permite este módulo rodar sob
// `node --experimental-strip-types --test`, sem bundler — mesmo padrão de
// request-lead-time.ts e occurred-at.ts.
import { CIVIL_DAY_TIME_ZONE, civilDateKey } from "../../../lib/date/civil-day.ts"
import { formatZonedTime } from "../../../lib/date/zoned-datetime.ts"

/** Minutos antes do horário marcado em que "Iniciar" já pode ser usado. */
export const SERVICE_START_EARLY_TOLERANCE_MINUTES = 10

const TOLERANCE_MS = SERVICE_START_EARLY_TOLERANCE_MINUTES * 60_000

export type ServiceStartEligibility =
  | { eligible: true }
  /** `scheduledHasTime = true`: falta menos de `startableAt`. */
  | { eligible: false; reason: "TOO_EARLY"; startableAt: Date }
  /** `scheduledHasTime = false` (legado): o dia civil ainda não chegou. */
  | { eligible: false; reason: "SCHEDULED_DATE_NOT_REACHED"; scheduledAt: Date }

/**
 * `scheduledAt - tolerância`. Exposto separadamente porque a UI precisa dele
 * tanto para o texto ("a partir de HH:mm") quanto para agendar o `setTimeout`
 * de liberação automática do botão — sem repetir a subtração em dois lugares.
 */
export function computeStartableAt(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() - TOLERANCE_MS)
}

/**
 * Este atendimento pode ser iniciado agora?
 *
 * Pura: `now` é sempre injetado, nunca lida daqui — mesmo servidor e cliente
 * calculam a mesma resposta a partir dos mesmos três valores, sem depender de
 * qual processo está rodando.
 *
 * NÃO decide sobre o guard de "agendamento muito antigo" (>24h no passado,
 * ver `startServiceRequestAction`) nem sobre o profissional já ter outro
 * atendimento em andamento — são regras independentes, aplicadas separadamente.
 */
export function resolveServiceStartEligibility(params: {
  scheduledAt: Date | null
  scheduledHasTime: boolean
  now: Date
}): ServiceStartEligibility {
  const { scheduledAt, scheduledHasTime, now } = params

  if (!scheduledAt) {
    return { eligible: true }
  }

  if (!scheduledHasTime) {
    if (civilDateKey(now) < civilDateKey(scheduledAt)) {
      return { eligible: false, reason: "SCHEDULED_DATE_NOT_REACHED", scheduledAt }
    }
    return { eligible: true }
  }

  const startableAt = computeStartableAt(scheduledAt)
  if (now.getTime() < startableAt.getTime()) {
    return { eligible: false, reason: "TOO_EARLY", startableAt }
  }
  return { eligible: true }
}

const LEGACY_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: CIVIL_DAY_TIME_ZONE,
})

/**
 * Mensagem humana — a MESMA função é chamada pelo servidor (para o `error` da
 * Server Action) e pela UI (para o texto sob o botão), então as duas frases
 * nunca podem divergir por construção.
 */
export function describeServiceStartBlock(
  block: Extract<ServiceStartEligibility, { eligible: false }>,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): string {
  if (block.reason === "TOO_EARLY") {
    return `Este atendimento poderá ser iniciado a partir de ${formatZonedTime(block.startableAt, timeZone)}.`
  }
  return `Este atendimento está marcado para ${LEGACY_DATE_FORMAT.format(block.scheduledAt)}. Disponível a partir dessa data.`
}
