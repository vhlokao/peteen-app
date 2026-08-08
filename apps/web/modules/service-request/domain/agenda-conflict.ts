/**
 * Módulo: service-request
 * Camada: domain — funções puras
 *
 * Fonte única da regra de CONFLITO DE AGENDA entre compromissos de um mesmo
 * profissional. Nenhum acesso a banco, nenhuma dependência de fuso: opera
 * sobre instantes UTC (`Date`), que é o que `scheduledAt`/`endAt` já são.
 *
 * ── Por que não há lógica de timezone aqui ────────────────────────────────
 * `scheduledAt` é convertido de data+horário civis para instante UTC no
 * servidor, no momento da criação (ver lib/date/zoned-datetime.ts, que deriva
 * o offset do Intl e portanto é correto sob horário de verão). Comparar dois
 * instantes absolutos não depende de fuso nem de DST — 10:00 BRT e 13:00 UTC
 * são o mesmo ponto na linha do tempo. Qualquer conversão aqui seria errada.
 *
 * ── O que é um compromisso REAL ───────────────────────────────────────────
 * Só ACCEPTED e IN_PROGRESS ocupam a agenda — são exatamente os estados que
 * a tela /professional/agenda já trata como compromisso confirmado. PENDING
 * não ocupa (é só um pedido; vários pedidos podem disputar o mesmo horário e
 * o profissional escolhe um). Estados terminais (COMPLETED,
 * CANCELLED_BY_TUTOR, CANCELLED_BY_PROFESSIONAL, EXPIRED, DISPUTED) não
 * ocupam.
 *
 * ── Precisão temporal: quem participa ─────────────────────────────────────
 * Só participa do conflito quem tem `scheduledHasTime = true`. Requests com
 * precisão de DATA (legado da V0.3) têm `scheduledAt` ancorado ao meio-dia
 * UTC — uma âncora técnica, não um horário real. Tratá-la como instante
 * produziria conflitos fantasma às 12:00 entre compromissos que na verdade
 * nem têm horário definido. Elas seguem sendo "data civil" e nunca bloqueiam.
 *
 * ── Duração ausente: COMPATIBILIDADE TEMPORÁRIA ───────────────────────────
 * ⚠️ Esta parte do contrato é transitória. NÃO é a regra definitiva do
 * produto. A proteção integral depende da missão **Service Duration
 * Integrity** (gate pré-piloto), que vai garantir que todo serviço declare
 * duração. Enquanto isso não existir, esta regra é o máximo que se pode
 * afirmar com honestidade.
 *
 * `endAt` só existe quando o Service declara `defaultDurationMin` — hoje
 * NENHUM serviço da base declara, então na prática `endAt` é sempre null.
 * Duas escolhas seriam erradas:
 *   - inventar uma duração padrão (ex.: 60min) → inventa dado que o
 *     profissional nunca informou, e o contrato da V0.3 proíbe;
 *   - ignorar completamente quem não tem endAt → dois compromissos marcados
 *     para exatamente 14:00 do mesmo dia passariam, o que é uma dupla-reserva
 *     óbvia.
 *
 * A regra TEMPORÁRIA trata quem não tem duração como um PONTO no tempo
 * (início == fim), sem inventar minutos:
 *   - dois intervalos com duração  → sobreposição estrita (regra abaixo);
 *   - qualquer um sem duração      → conflita apenas se o INÍCIO for o mesmo
 *                                    instante.
 *
 * É deliberadamente CONSERVADORA: protege o caso inequívoco (mesmo horário
 * exato) e não afirma nada sobre sobreposição parcial, porque sem duração a
 * sobreposição é literalmente indecidível — 14:00 e 14:30 podem ou não
 * colidir. Consequência conhecida e aceita: um compromisso 14:00–15:00 não
 * bloqueia um candidato sem duração às 14:30 (ver teste "11d"). Isso deixa de
 * ser um furo quando as durações passarem a existir — nenhuma mudança nesta
 * regra será necessária.
 *
 * ── Regra de sobreposição ─────────────────────────────────────────────────
 *   existingStart < newEnd  E  existingEnd > newStart
 * Desigualdade estrita dos dois lados: compromissos ENCOSTADOS não conflitam.
 * 10:00–11:00 e 11:00–12:00 são válidos juntos.
 */

/**
 * Lançado quando o aceite colidiria com um compromisso já confirmado.
 * Carrega o instante ocupado para a mensagem ao PROFISSIONAL (dono da agenda).
 * Nunca carrega nome de tutor, pet ou descrição — a camada application decide
 * o que exibir, e para o tutor a mensagem é sempre neutra.
 */
export class AgendaConflictError extends Error {
  readonly conflict: AgendaConflict

  constructor(conflict: AgendaConflict) {
    super(`Conflito de agenda com a request ${conflict.conflictingRequestId}.`)
    this.name = "AgendaConflictError"
    this.conflict = conflict
  }
}

/** Estados que ocupam a agenda de fato. Fonte única — não reescrever a lista. */
export const AGENDA_BLOCKING_STATUSES = ["ACCEPTED", "IN_PROGRESS"] as const

export type AgendaBlockingStatus = (typeof AGENDA_BLOCKING_STATUSES)[number]

export function isAgendaBlockingStatus(status: string): boolean {
  return (AGENDA_BLOCKING_STATUSES as readonly string[]).includes(status)
}

/** Compromisso candidato a ocupar (ou disputar) um intervalo. */
export type AgendaSlot = {
  scheduledAt: Date | null
  scheduledHasTime: boolean
  endAt: Date | null
}

/**
 * Intervalo resolvido de um compromisso, em instantes UTC.
 * `null` quando o compromisso não tem horário real e portanto não participa.
 * `start === end` quando há horário mas não há duração conhecida (ponto).
 */
export type AgendaInterval = { start: number; end: number }

export function resolveAgendaInterval(slot: AgendaSlot): AgendaInterval | null {
  // Sem horário real → precisão de data civil → não participa.
  if (!slot.scheduledHasTime || !slot.scheduledAt) return null

  const start = slot.scheduledAt.getTime()

  // Sem duração confiável → ponto no tempo. Nunca extrapolar minutos.
  if (!slot.endAt) return { start, end: start }

  const end = slot.endAt.getTime()

  // Defensivo: endAt inconsistente (anterior ou igual ao início) degrada para
  // ponto, em vez de produzir um intervalo negativo que nunca casaria.
  if (end <= start) return { start, end: start }

  return { start, end }
}

/**
 * Dois intervalos conflitam?
 *
 * Intervalos com duração: sobreposição estrita — encostados não conflitam.
 * Qualquer um sendo ponto (start === end): só conflita no mesmo instante de
 * início, porque não há duração para sobrepor.
 */
export function intervalsConflict(a: AgendaInterval, b: AgendaInterval): boolean {
  const aIsPoint = a.start === a.end
  const bIsPoint = b.start === b.end

  if (aIsPoint || bIsPoint) return a.start === b.start

  return a.start < b.end && a.end > b.start
}

/** Um compromisso já ocupado na agenda, para comparação. */
export type ExistingAppointment = AgendaSlot & {
  id: string
  status: string
}

export type AgendaConflict = {
  conflictingRequestId: string
  /** Início do compromisso já confirmado (UTC). Para mensagem ao profissional. */
  start: Date
  /** Fim conhecido, ou null quando o compromisso não declara duração. */
  end: Date | null
}

/**
 * Encontra o primeiro compromisso que conflita com o candidato.
 *
 * `existing` deve conter apenas compromissos DO MESMO profissional — este
 * módulo não conhece professionalId; filtrar é responsabilidade de quem
 * consulta o banco. Compromissos com o mesmo id do candidato são ignorados
 * (reaceite/idempotência).
 *
 * Retorna null quando não há conflito — inclusive quando o próprio candidato
 * não participa (sem horário real).
 */
export function findAgendaConflict(
  candidate: AgendaSlot & { id?: string },
  existing: ExistingAppointment[]
): AgendaConflict | null {
  const candidateInterval = resolveAgendaInterval(candidate)
  if (!candidateInterval) return null

  for (const appointment of existing) {
    if (candidate.id && appointment.id === candidate.id) continue
    if (!isAgendaBlockingStatus(appointment.status)) continue

    const interval = resolveAgendaInterval(appointment)
    if (!interval) continue

    if (intervalsConflict(candidateInterval, interval)) {
      return {
        conflictingRequestId: appointment.id,
        start: appointment.scheduledAt as Date,
        end: appointment.endAt,
      }
    }
  }

  return null
}
