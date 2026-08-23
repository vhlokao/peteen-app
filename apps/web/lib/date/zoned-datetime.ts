/**
 * zoned-datetime — converte data + horário CIVIL de um fuso em instante UTC.
 *
 * Por que existe:
 *   `parseCivilDateToStableInstant` resolve "data sem horário" ancorando ao
 *   meio-dia UTC. A partir da Agenda Foundation V0.3 o tutor escolhe data E
 *   horário reais, então precisamos do instante exato que corresponde àquele
 *   horário de parede no fuso do piloto — não de uma âncora.
 *
 * Por que NÃO usar offset fixo (-03:00):
 *   O Brasil já teve horário de verão e pode voltar a ter; outras praças de
 *   expansão têm DST ativo. O offset é derivado do próprio Intl para o
 *   instante em questão, então a função continua correta se a regra do fuso
 *   mudar — sem alterar código.
 *
 * Escopo: só conversão de tempo. Nenhuma regra de disponibilidade, conflito
 * ou duração é decidida aqui.
 */

import { CIVIL_DAY_TIME_ZONE } from "./civil-day.ts"

/**
 * Deslocamento do fuso (ms) NO INSTANTE informado.
 *
 * Formata o instante no fuso alvo, relê os campos como se fossem UTC e
 * compara com o instante original: a diferença é o offset vigente naquele
 * momento — inclusive sob horário de verão.
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)

  const field: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== "literal") field[part.type] = Number(part.value)
  }

  // hourCycle h23 pode devolver 24 para meia-noite em alguns runtimes.
  const hour = field.hour === 24 ? 0 : (field.hour ?? 0)

  const asIfUtc = Date.UTC(
    field.year ?? 1970,
    (field.month ?? 1) - 1,
    field.day ?? 1,
    hour,
    field.minute ?? 0,
    field.second ?? 0
  )

  return asIfUtc - instant.getTime()
}

/**
 * "YYYY-MM-DD" + "HH:mm" no fuso informado → instante UTC exato.
 *
 * Retorna null se qualquer parte for inválida — o chamador decide a mensagem.
 *
 * Duas passagens: a primeira estima o offset tratando o horário de parede
 * como se fosse UTC; a segunda recalcula o offset já no instante estimado.
 * Isso corrige a borda de transição de DST, em que o offset do "chute"
 * inicial difere do offset real do instante final.
 */
export function zonedCivilDateTimeToInstant(
  dateValue: string,
  timeValue: string,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null

  const [year, month, day] = dateValue.split("-").map(Number)
  const [hour, minute] = timeValue.split(":").map(Number)

  if (
    year === undefined || month === undefined || day === undefined ||
    hour === undefined || minute === undefined ||
    month < 1 || month > 12 || day < 1 || day > 31 ||
    hour > 23 || minute > 59
  ) {
    return null
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)

  let instant = wallClockAsUtc - timeZoneOffsetMs(new Date(wallClockAsUtc), timeZone)
  instant = wallClockAsUtc - timeZoneOffsetMs(new Date(instant), timeZone)

  const result = new Date(instant)
  if (Number.isNaN(result.getTime())) return null

  // Sanidade: o instante calculado precisa reproduzir o horário de parede
  // pedido. Protege contra horários inexistentes (salto de DST para frente).
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(result)

  if (!roundTrip.includes(dateValue)) return null

  return result
}

/**
 * Fuso correto para renderizar o DIA de um agendamento.
 *
 * date-only (scheduledHasTime=false) é legado: o dia civil foi gravado
 * ancorado a um instante UTC (meia-noite OU meio-dia UTC, conforme a época do
 * código que criou o registro). Renderizar em UTC recupera esse dia sem
 * deslizar — em America/Sao_Paulo a meia-noite UTC cairia no dia anterior.
 *
 * Com horário (scheduledHasTime=true) o valor é um instante real: o dia que
 * importa é o civil LOCAL, então usamos o fuso do piloto. Só esse ramo pode
 * "virar o dia" perto da meia-noite, e é o comportamento desejado.
 */
export function scheduledDayTimeZone(scheduledHasTime: boolean): string {
  return scheduledHasTime ? CIVIL_DAY_TIME_ZONE : "UTC"
}

/**
 * Dia civil de um agendamento em pt-BR, no fuso correto para a precisão do
 * registro (ver scheduledDayTimeZone). `options` controla o estilo (dia/mês/
 * ano, weekday…); o timeZone é sempre injetado aqui, nunca pelo chamador.
 */
export function formatScheduledCivilDate(
  instant: Date,
  scheduledHasTime: boolean,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    ...options,
    timeZone: scheduledDayTimeZone(scheduledHasTime),
  }).format(instant)
}

/**
 * Instante de EVENTO (createdAt, acceptedAt, startedAt, completedAt,
 * occurredAt…) formatado em pt-BR, no fuso do piloto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE HELPER EXISTE, SEPARADO DE formatScheduledCivilDate
 *
 * `scheduledAt` é ambíguo por natureza: pode ser data civil histórica
 * (date-only) ou instante real, e só `scheduledHasTime` desempata — por isso
 * aquele helper exige o flag. Um timestamp de evento não tem essa ambiguidade:
 * é sempre o instante em que algo aconteceu. Reaproveitar o helper de
 * agendamento aqui obrigaria a inventar um `scheduledHasTime` para dados que
 * não têm o conceito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O INCIDENTE QUE ORIGINOU ISTO
 *
 * `RequestTimeline` formatava com `Intl.DateTimeFormat("pt-BR", {...})` SEM
 * `timeZone`. Sem o campo, o Intl usa o fuso do RUNTIME — e o componente é
 * Server Component, renderizado na Vercel, onde o runtime é UTC. O resultado
 * era o relógio UTC impresso como se fosse local: um aceite às 16:06 BRT
 * aparecia como 19:06, exatamente +3h, no aparelho do usuário.
 *
 * O `timeZone` é injetado AQUI, nunca pelo chamador, para que esquecê-lo deixe
 * de ser possível — foi o esquecimento, e não a conversão, que quebrou.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE FUSO FIXO E NÃO O FUSO DO APARELHO
 *
 * Server Component não tem acesso ao fuso do browser: no instante em que o HTML
 * é gerado, nenhum código do cliente rodou. Formatar pelo aparelho exigiria
 * mover a renderização para o cliente, e aí servidor e browser produziriam
 * strings diferentes para o MESMO nó — hydration mismatch garantido em toda
 * tela com horário. O fuso fixo faz servidor e cliente concordarem.
 *
 * `CIVIL_DAY_TIME_ZONE` é a mesma constante que o resto do contrato temporal já
 * usa; expansão geográfica troca um valor só, num lugar só.
 */
export function formatEventInstant(
  instant: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone }).format(instant)
}

/** Horário de parede "HH:mm" de um instante, no fuso informado. */
export function formatZonedTime(
  instant: Date,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant)
}
