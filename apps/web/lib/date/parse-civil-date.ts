/**
 * parseCivilDateToStableInstant — converte uma data civil "YYYY-MM-DD"
 * (sem horário, ex.: valor de <input type="date">) num Date estável,
 * fixado ao meio-dia UTC.
 *
 * Por quê meio-dia UTC:
 *   `new Date("YYYY-MM-DD")` é interpretado como meia-noite UTC. Ao exibir
 *   esse instante num fuso atrás de UTC (ex.: America/Sao_Paulo, UTC-3),
 *   ele cai no dia civil anterior — o dia escolhido pelo usuário "volta"
 *   um dia depois de persistido.
 *
 *   Meio-dia UTC fica longe o bastante de qualquer fronteira de dia para
 *   qualquer fuso horário razoável (UTC-12 a UTC+12): formatado em
 *   qualquer timezone dessa faixa, o dia civil exibido continua sendo o
 *   mesmo que foi selecionado — independente do fuso do runtime do
 *   servidor ou do navegador.
 *
 * Uso: apenas para "data civil sem horário". Não usar para instantes que
 * realmente carregam hora (este projeto não captura horário para
 * scheduledAt — ver RequestScheduleStep).
 */
export function parseCivilDateToStableInstant(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1, 12, 0, 0))
}
