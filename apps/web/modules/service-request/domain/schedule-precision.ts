/**
 * schedule-precision — contrato ÚNICO para decidir se o horário de um
 * compromisso pode ser exibido.
 *
 * Decisão de arquitetura (Agenda Foundation V0.3):
 *   `ServiceRequest.scheduledHasTime` é a ÚNICA fonte dessa resposta.
 *
 *   - false → `scheduledAt` tem precisão apenas de DATA. O horário
 *     armazenado é uma âncora técnica (meio-dia UTC de
 *     `parseCivilDateToStableInstant`, ou 00:00 de dados ainda mais antigos)
 *     e NÃO representa escolha de ninguém. Nunca exibir.
 *   - true  → `scheduledAt` veio de um fluxo que capturou data e horário
 *     reais no fuso do piloto. Exibir.
 *
 * Por que NÃO se infere pela hora:
 *   A âncora legada é 12:00 UTC, que é exatamente 09:00 em America/Sao_Paulo
 *   — o horário mais provável de um passeio real. A âncora antiga 00:00 UTC
 *   colide com 21:00 BRT. Qualquer heurística de hora classificaria
 *   compromissos reais como legado justamente nos horários mais comuns.
 *   Também não se infere por `createdAt` (frágil na janela de deploy) nem
 *   por segundos (sentinela proibida).
 *
 * Regra de escrita: só o fluxo de criação define este campo. O aceite, o
 * início e a conclusão NUNCA o alteram — precisão é uma propriedade de como
 * o dado nasceu, não do seu ciclo de vida.
 */

/** Forma mínima necessária para decidir a exibição temporal. */
export type ScheduleTemporalShape = {
  scheduledAt: Date | null
  scheduledHasTime: boolean
  endAt?: Date | null
}

/**
 * O horário de início pode ser exibido?
 * Só quando existe data E o request nasceu com horário real.
 */
export function canDisplayScheduledTime(request: ScheduleTemporalShape): boolean {
  return request.scheduledAt !== null && request.scheduledHasTime === true
}

/**
 * O horário final pode ser exibido?
 * Exige horário de início exibível (senão o fim não tem referência) e um
 * `endAt` de fato calculado no aceite.
 */
export function canDisplayEndTime(request: ScheduleTemporalShape): boolean {
  return canDisplayScheduledTime(request) && !!request.endAt
}

/**
 * Precisão temporal do compromisso — útil para UI e diagnóstico.
 *   "none"   — sem data ("a combinar")
 *   "day"    — só data confiável (legado)
 *   "minute" — data e horário reais
 */
export type SchedulePrecision = "none" | "day" | "minute"

export function getSchedulePrecision(request: ScheduleTemporalShape): SchedulePrecision {
  if (!request.scheduledAt) return "none"
  return request.scheduledHasTime ? "minute" : "day"
}
