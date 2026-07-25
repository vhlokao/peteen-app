/**
 * civil-day — comparação de DIA CIVIL num fuso fixo.
 *
 * Por que existe:
 *   Decidir se uma data agendada "está no passado" comparando instantes
 *   exatos (`target > new Date()`) é errado quando o produto só captura data,
 *   sem horário. `parseCivilDateToStableInstant` ancora a data ao meio-dia UTC
 *   (= 09:00 em America/Sao_Paulo), então a comparação por instante fazia o
 *   MESMO dia ser aceito de madrugada e recusado depois das 09:00 BRT — a
 *   validação passava a depender da hora em que o tutor abria o formulário.
 *
 *   O fuso é fixo (não o do runtime) porque o servidor roda em UTC na Vercel:
 *   sem isso, "hoje" no servidor divergiria de "hoje" para o usuário.
 *
 * Escopo: só dia civil. Horário, disponibilidade e conflito são
 * responsabilidade da Agenda MVP — nada disso é decidido aqui.
 *
 * Nota: `civilDateKey` também existe, privada, em
 * modules/professional-crm/domain/agenda-grouping.ts. A unificação das duas
 * está registrada para a Agenda MVP; nesta missão a fronteira daquele módulo
 * foi preservada de propósito.
 */

/** Fuso de referência do piloto. Revisar em expansão geográfica. */
export const CIVIL_DAY_TIME_ZONE = "America/Sao_Paulo"

/**
 * Instante → chave de dia civil "YYYY-MM-DD" no fuso informado.
 * Usa en-CA porque esse locale já formata como YYYY-MM-DD.
 */
export function civilDateKey(date: Date, timeZone: string = CIVIL_DAY_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/**
 * O dia civil de `target` é anterior ao dia civil de `now`?
 *
 *   ontem ou antes → true  (bloquear)
 *   hoje           → false (permitir)
 *   amanhã ou após → false (permitir)
 *
 * Chaves "YYYY-MM-DD" são comparáveis lexicograficamente, então a comparação
 * de string basta e não reintroduz aritmética de instantes.
 * `now` é injetável para manter a função determinística e testável.
 */
export function isCivilDayInThePast(
  target: Date,
  now: Date,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): boolean {
  return civilDateKey(target, timeZone) < civilDateKey(now, timeZone)
}
