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
  | { ok: false; reason: "BEFORE_START" | "FUTURE" | "AFTER_END" }

/**
 * Limite superior da janela: `now` durante o atendimento, `completedAt` depois
 * dele.
 *
 * Existe porque "não pode ser no futuro" e "não pode ser fora do atendimento"
 * são regras diferentes, e a segunda só aparece quando o atendimento terminou.
 * Publicar hoje um evento que teria acontecido depois da conclusão inventaria
 * cuidado que não houve — e é exatamente o tipo de registro que uma disputa
 * questionaria.
 *
 * `min(completedAt, now)` por segurança: um `completedAt` adiantado por relógio
 * torto nunca deve abrir uma janela para o futuro.
 */
export function limiteSuperiorDaJanela(completedAt: Date | null, now: Date): Date {
  if (completedAt === null) return now
  return completedAt.getTime() < now.getTime() ? completedAt : now
}

/**
 * Resolve o occurredAt efetivo — o único valor que deve ser persistido,
 * auditado e devolvido ao client. Não faz I/O e não depende de Date.now():
 * `now` é injetado para manter a função determinística e testável.
 */
export function resolveEffectiveOccurredAt(params: {
  inputOccurredAt: Date
  startedAt: Date | null
  now: Date
  /**
   * Conclusão do atendimento, quando já houve. `null` durante o IN_PROGRESS —
   * que é o único estado em que a publicação é permitida hoje. O parâmetro
   * existe para que a janela seja completa por construção, e não dependa de o
   * guard de status permanecer onde está.
   */
  completedAt?: Date | null
}): ResolveOccurredAtResult {
  const { inputOccurredAt, startedAt, now, completedAt = null } = params

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

  // (4) teto da janela, avaliado sobre o valor JÁ resolvido.
  //
  // Mesma tolerância de minuto da borda inferior: o formulário tem precisão de
  // minuto, então escolher o minuto corrente (ou o minuto da conclusão) é
  // legítimo mesmo que os segundos ainda não tenham chegado lá. Sem isso,
  // "agora" digitado como 21:04 seria recusado às 21:04:12 — a mesma classe de
  // recusa incompreensível que a regra do início já resolveu.
  const teto = limiteSuperiorDaJanela(completedAt, now)
  if (startOfMinute(effective) > startOfMinute(teto)) {
    return { ok: false, reason: completedAt !== null && teto === completedAt ? "AFTER_END" : "FUTURE" }
  }
  // Nunca persiste depois do teto real, mesmo aceitando o minuto.
  if (effective.getTime() > teto.getTime()) {
    effective = teto
  }

  // (5) valor válido preservado.
  return { ok: true, occurredAt: effective }
}
