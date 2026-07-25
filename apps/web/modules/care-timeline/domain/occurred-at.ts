/**
 * Módulo: care-timeline
 * Camada: domain — regra canônica do occurredAt (pura, sem I/O)
 *
 * Problema que esta regra resolve:
 *   <input type="datetime-local"> tem precisão de MINUTO — o valor padrão do
 *   formulário é sempre o minuto corrente truncado (segundos = 00). Já o
 *   startedAt da request é um instante real, com segundos (ex.: 15:27:11.075).
 *   Publicar no mesmo minuto em que o atendimento começou produzia
 *   occurredAt = 15:27:00 < startedAt = 15:27:11 e a publicação era recusada,
 *   mesmo sendo o primeiro uso legítimo do Diário de Cuidado.
 *
 * Regra canônica (fonte da verdade é o servidor):
 *   1. occurredAt em minuto ANTERIOR ao minuto de startedAt  → bloquear.
 *   2. occurredAt no MESMO minuto de startedAt               → aceitar.
 *   3. Ao aceitar no mesmo minuto, o valor PERSISTIDO nunca pode ser anterior
 *      a startedAt — é elevado para startedAt.
 *   4. occurredAt (já resolvido) posterior ao horário atual  → bloquear.
 *   5. occurredAt depois de startedAt e não futuro           → preservado.
 *
 * A comparação por minuto existe só para decidir "está antes do início?".
 * O valor persistido continua sendo um instante exato.
 */

/** Trunca um instante ao início do seu minuto. Offsets de fuso são múltiplos
 *  de minuto, então isto independe de timezone. */
function startOfMinute(date: Date): number {
  return Math.floor(date.getTime() / 60_000) * 60_000
}

export type ResolveOccurredAtResult =
  | { ok: true; occurredAt: Date }
  | { ok: false; reason: "BEFORE_START" | "FUTURE" }

/**
 * Resolve o occurredAt efetivo — o único valor que deve ser persistido,
 * auditado e devolvido ao client. Não faz I/O e não depende de Date.now():
 * `now` é injetado para manter a função determinística e testável.
 */
export function resolveEffectiveOccurredAt(params: {
  inputOccurredAt: Date
  startedAt: Date | null
  now: Date
}): ResolveOccurredAtResult {
  const { inputOccurredAt, startedAt, now } = params

  let effective = inputOccurredAt

  if (startedAt) {
    // (1) minuto anterior ao início: bloqueia.
    if (startOfMinute(inputOccurredAt) < startOfMinute(startedAt)) {
      return { ok: false, reason: "BEFORE_START" }
    }
    // (2)+(3) mesmo minuto: aceita, mas nunca persiste antes do início real.
    if (inputOccurredAt.getTime() < startedAt.getTime()) {
      effective = startedAt
    }
  }

  // (4) futuro é sempre bloqueado — avaliado sobre o valor JÁ resolvido.
  if (effective.getTime() > now.getTime()) {
    return { ok: false, reason: "FUTURE" }
  }

  // (5) valor válido preservado.
  return { ok: true, occurredAt: effective }
}
