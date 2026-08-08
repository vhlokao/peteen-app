/**
 * Módulo: service-request
 * Camada: domain — funções puras
 *
 * Service Duration Integrity — fonte única da pergunta "esta duração de
 * serviço é confiável para agendar com horário?".
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * A Agenda protege sobreposição de intervalos usando
 * `endAt = scheduledAt + durationMin`. Sem duração, `endAt` é null e a regra
 * de conflito degrada para "só bloqueia início idêntico" — sobreposição
 * parcial fica indecidível (ver agenda-conflict.ts). Este módulo é o gate que
 * impede uma request COM horário de chegar ao aceite sem duração confiável,
 * eliminando a causa em vez de compensar o efeito.
 *
 * ── O que NÃO fazemos ─────────────────────────────────────────────────────
 * Nenhum fallback, nenhum default por serviceType, nenhuma sugestão gravada
 * automaticamente. Se o profissional não informou a duração, o serviço
 * simplesmente não recebe agendamento com horário — e ele vê um erro
 * acionável, não um furo silencioso.
 *
 * ── Limites ───────────────────────────────────────────────────────────────
 * Reusa `SERVICE_DURATION_LIMITS` (5..1440 min) de professional/domain/types.
 * NUNCA redefinir esses números aqui: uma segunda definição divergiria da
 * validação de cadastro e criaria serviços aceitos no formulário e rejeitados
 * no aceite (ou o contrário).
 *
 * `defaultDurationMin` segue nullable por contrato — BOARDING multi-dia e
 * serviços de duração genuinamente variável são casos legítimos. O que este
 * módulo decide não é "o serviço é válido?", e sim "o serviço pode receber
 * agendamento COM HORÁRIO?".
 */

import { SERVICE_DURATION_LIMITS } from "../../professional/domain/types.ts"

/**
 * Lançado quando um aceite (ou criação) de request COM horário encontra um
 * serviço sem duração confiável.
 *
 * Carrega apenas identificadores técnicos — a camada application traduz para
 * mensagem humana. Nunca expõe dados de tutor, pet ou outro atendimento.
 */
export class ServiceDurationRequiredError extends Error {
  readonly professionalId: string
  readonly serviceType: string

  constructor(professionalId: string, serviceType: string) {
    super(
      `Serviço ${serviceType} do profissional ${professionalId} não tem duração confiável para agendamento com horário.`
    )
    this.name = "ServiceDurationRequiredError"
    this.professionalId = professionalId
    this.serviceType = serviceType
  }
}

/**
 * A duração é confiável para compor um intervalo de agenda?
 *
 * Exige inteiro dentro dos limites. Rejeita null, undefined, 0, negativo,
 * decimal, NaN e Infinity — os mesmos casos que o schema Zod de cadastro
 * rejeita, mas checados também aqui porque o banco não tem constraint: uma
 * linha legada ou escrita fora do fluxo pode conter qualquer inteiro.
 */
export function isReliableServiceDuration(value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false
  if (!Number.isInteger(value)) return false
  return (
    value >= SERVICE_DURATION_LIMITS.MIN_MINUTES &&
    value <= SERVICE_DURATION_LIMITS.MAX_MINUTES
  )
}

/**
 * Este serviço pode receber uma solicitação COM horário?
 *
 * Regra uniforme por duração — nenhum serviceType tem exceção:
 *   - OTHER com duração válida  → elegível (decisão de produto explícita);
 *   - OTHER sem duração         → inelegível, como qualquer outro;
 *   - BOARDING com duração      → elegível (ver nota abaixo);
 *   - BOARDING sem duração      → inelegível.
 *
 * Nota sobre BOARDING: o modelo atual expressa duração em minutos, com teto
 * de 1440 (24h). Uma hospedagem de UM dia é representável e a proteção de
 * sobreposição funciona corretamente para ela. Uma estadia de vários dias NÃO
 * é representável — e é por isso que BOARDING sem duração recebe mensagem de
 * limitação de produto, não de configuração faltando. Quando o profissional
 * preenche a duração explicitamente, respeitamos: o número é dele, o
 * intervalo é honesto para o período declarado, e não há motivo para tratá-lo
 * como menos confiável que qualquer outro tipo.
 */
export function canReceiveTimedBooking(
  service: { serviceType: string; defaultDurationMin?: number | null }
): boolean {
  return isReliableServiceDuration(service.defaultDurationMin)
}

/**
 * Motivo da inelegibilidade, para a UI escolher a mensagem certa.
 *
 * `PRODUCT_LIMITATION` quando o modelo atual não sabe representar o serviço
 * (hospedagem multi-dia) — a comunicação não deve culpar o profissional.
 * `MISSING_DURATION` quando é só configuração faltando.
 */
export type TimedBookingBlockReason = "MISSING_DURATION" | "PRODUCT_LIMITATION"

export function timedBookingBlockReason(
  service: { serviceType: string; defaultDurationMin?: number | null }
): TimedBookingBlockReason | null {
  if (canReceiveTimedBooking(service)) return null
  return service.serviceType === "BOARDING" ? "PRODUCT_LIMITATION" : "MISSING_DURATION"
}
