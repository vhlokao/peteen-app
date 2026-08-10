/**
 * Módulo: service-request
 * Camada: domain
 *
 * Antecedência mínima entre a CRIAÇÃO de uma solicitação e o horário do
 * atendimento.
 *
 * POR QUE EXISTE — bug de contrato temporal comprovado em E2E real:
 *   Uma solicitação criada 21:12:29 para 21:13:00 foi aceita pelo sistema e
 *   expirou 40 segundos depois. A regra de expiração funcionou como
 *   especificada (`getRequestExpiryInfo`: quando o atendimento está a menos de
 *   1h da criação, o prazo de resposta É o próprio `scheduledAt`) — o defeito
 *   estava um passo antes: NADA impedia criar uma solicitação com 31 segundos
 *   de janela para o profissional responder.
 *
 *   O resultado era incoerente para os dois lados: o tutor conseguia enviar,
 *   via UI, um pedido que nascia praticamente morto; o profissional recebia
 *   algo impossível de aceitar a tempo.
 *
 * RELAÇÃO COM `SCHEDULED_SAFETY_MARGIN_HOURS` — são coisas DIFERENTES e não se
 * substituem:
 *   - SCHEDULED_SAFETY_MARGIN_HOURS (1h) responde "até quando ainda dá para
 *     ACEITAR uma solicitação já existente?" — é regra de EXPIRAÇÃO.
 *   - MIN_REQUEST_LEAD_TIME_MINUTES (15min) responde "esta solicitação pode
 *     sequer ser CRIADA?" — é regra de ADMISSÃO.
 *   Um pedido com 30 minutos de antecedência é legítimo: entra por esta regra,
 *   e a expiração usa o próprio `scheduledAt` como prazo (gap < 1h), dando ao
 *   profissional os 30 minutos reais para responder.
 *
 * Pura: não lê relógio nem banco. `agora` é sempre injetado pelo chamador, o
 * que mantém a regra testável e idêntica no servidor e na UI.
 */

/** Antecedência mínima aprovada para o MVP. */
export const MIN_REQUEST_LEAD_TIME_MINUTES = 15

const MIN_LEAD_TIME_MS = MIN_REQUEST_LEAD_TIME_MINUTES * 60 * 1000

/** Mensagem única — servidor e UI mostram exatamente a mesma frase. */
export const LEAD_TIME_ERROR_MESSAGE =
  "Escolha um horário com pelo menos 15 minutos de antecedência."

/**
 * O horário escolhido respeita a antecedência mínima?
 *
 * Limite INCLUSIVO: exatamente 15 minutos é válido. Só abaixo disso rejeita —
 * um usuário que escolhe "daqui a 15 minutos" fez exatamente o que a mensagem
 * pediu, e recusá-lo seria contradizer a própria instrução.
 */
export function respeitaAntecedenciaMinima(scheduledAt: Date, agora: Date): boolean {
  return scheduledAt.getTime() - agora.getTime() >= MIN_LEAD_TIME_MS
}

/**
 * Primeiro instante válido a partir de `agora`. Usado pela UI para bloquear
 * horários inválidos antes do envio, com a MESMA conta do servidor.
 */
export function primeiroHorarioValido(agora: Date): Date {
  return new Date(agora.getTime() + MIN_LEAD_TIME_MS)
}
