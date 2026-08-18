/**
 * Módulo: care-timeline
 * Camada: domain — quando o evento aconteceu, do ponto de vista do formulário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DECISÃO DE PRODUTO QUE ISTO CODIFICA
 *
 * O profissional quase sempre registra o que está acontecendo AGORA, durante o
 * atendimento, com o pet na frente. Exigir que ele escolha data e hora a cada
 * publicação cobra atenção justamente no momento em que ele tem menos — e o
 * valor default do `<input type="datetime-local">` já era "agora", então o
 * campo pedia confirmação de algo que ele nunca queria mudar.
 *
 * Por isso o fluxo padrão é AGORA, sem controle visível, e registrar em outro
 * horário passa a ser uma escolha explícita e secundária.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `occurredAt` NÃO SOME DO DOMÍNIO — E A DISTINÇÃO IMPORTA
 *
 *   createdAt  = quando o registro foi publicado   (sempre o servidor)
 *   occurredAt = quando o evento realmente ocorreu (o profissional pode dizer)
 *
 * No fluxo comum os dois quase coincidem. No registro atrasado — o passeio foi
 * 14:20, o profissional só conseguiu escrever 14:40 — eles divergem de
 * propósito, e é `occurredAt` que conta a história do cuidado na timeline do
 * tutor. Colapsar os dois num campo só destruiria essa informação exatamente
 * nos casos em que ela é mais útil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE "AGORA" É RESOLVIDO NO SUBMIT, NÃO NA ABERTURA
 *
 * O formulário pode ficar aberto por minutos enquanto a pessoa escreve e
 * seleciona fotos. Congelar o instante na abertura publicaria um `occurredAt`
 * sistematicamente no passado, e o desvio cresceria com o tempo de digitação.
 * `agora` é injetado como parâmetro (nunca lido de `Date.now()` aqui) para que
 * esta função continue pura e testável.
 */

// Extensão .ts explícita e caminho relativo: é o que permite o módulo rodar sob
// `node --experimental-strip-types --test`, sem bundler — mesmo padrão de
// photo-selection.ts e care-media-validation.ts.
import { zonedCivilDateTimeToInstant, formatZonedTime } from "../../../lib/date/zoned-datetime.ts"
import { CIVIL_DAY_TIME_ZONE, civilDateKey } from "../../../lib/date/civil-day.ts"

/**
 * `agora`  — o instante é o do envio; nenhum controle é exibido.
 * `manual` — a pessoa ativou "Aconteceu em outro horário?" e informou quando.
 */
export type OccurredAtMode = "agora" | "manual"

export const OCCURRED_AT_COPY = {
  alternar: "Aconteceu em outro horário?",
  ajudaJanela: "Escolha um horário entre o início do atendimento e agora.",
  rotuloManual: "Quando aconteceu",
  voltarParaAgora: "Usar o horário atual",
  agoraDescricao: "Registrando com o horário de agora.",
  valorInvalido: "Informe uma data e hora válidas.",
} as const

export type OccurredAtResolution =
  | { ok: true; iso: string }
  | { ok: false; mensagem: string }

/** "YYYY-MM-DDTHH:mm" — o formato que `<input type="datetime-local">` emite. */
const VALOR_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

/**
 * Instante que deve ser enviado à Server Action.
 *
 * No modo `manual` a conversão passa por `zonedCivilDateTimeToInstant` — o
 * helper canônico de fuso do projeto — e NÃO por `new Date(valor)`. Os dois
 * concordam quando o navegador está no fuso do piloto, mas `new Date` depende
 * do fuso do processo que interpreta, e foi exatamente essa classe de
 * dependência implícita que produziu o incidente de leitura de timestamp. Aqui
 * o fuso é explícito, o resultado é determinístico e o teste não muda de
 * resposta conforme a máquina onde roda.
 *
 * Esta função NÃO valida regra de negócio temporal: início do atendimento e
 * futuro continuam sendo decididos por `resolveEffectiveOccurredAt`, no
 * servidor, que é a autoridade. Aqui só se resolve QUAL instante enviar.
 */
export function resolverOccurredAtParaEnvio(params: {
  modo: OccurredAtMode
  /** Ignorado no modo `agora`. */
  valorLocal: string
  agora: Date
  /** Fuso do horário civil digitado. Default: o fuso do piloto. */
  timeZone?: string
}): OccurredAtResolution {
  const { modo, valorLocal, agora, timeZone } = params

  if (modo === "agora") {
    return { ok: true, iso: agora.toISOString() }
  }

  const partes = VALOR_LOCAL.exec(valorLocal.trim())
  if (!partes) {
    return { ok: false, mensagem: OCCURRED_AT_COPY.valorInvalido }
  }

  const instante = zonedCivilDateTimeToInstant(partes[1]!, partes[2]!, timeZone)
  if (!instante) {
    return { ok: false, mensagem: OCCURRED_AT_COPY.valorInvalido }
  }

  return { ok: true, iso: instante.toISOString() }
}

/**
 * Instante → "YYYY-MM-DDTHH:mm" no MESMO fuso em que o valor será reinterpretado.
 *
 * Antes isto usava `agora.getFullYear()/getHours()`, ou seja, o fuso do
 * NAVEGADOR, enquanto `resolverOccurredAtParaEnvio` reinterpreta o texto no
 * fuso do piloto. Num aparelho fora de America/Sao_Paulo os dois discordavam e
 * o valor pré-preenchido já nascia deslocado — a mesma classe de erro do
 * incidente de leitura de timestamp. Formatar e reinterpretar no mesmo fuso
 * fecha essa porta.
 */
export function paraValorDeControle(
  instante: Date,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): string {
  return `${civilDateKey(instante, timeZone)}T${formatZonedTime(instante, timeZone)}`
}

/**
 * Valor inicial do controle manual quando a pessoa ativa "outro horário".
 *
 * Começa no instante corrente para que ela ajuste a partir de algo verdadeiro —
 * um campo vazio obrigaria a digitar a data inteira só para corrigir os
 * minutos, que é o caso real (o evento foi há pouco, não em outro dia).
 */
export function valorInicialDoControleManual(
  agora: Date,
  timeZone: string = CIVIL_DAY_TIME_ZONE
): string {
  return paraValorDeControle(agora, timeZone)
}

/**
 * Janela válida para o seletor — os mesmos limites que o servidor aplica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE A UI PRECISA DISTO
 *
 * No teste físico o profissional ativou "Aconteceu em outro horário?", escolheu
 * um horário livremente e a publicação foi recusada. O servidor estava certo —
 * o horário caía antes do início do atendimento — mas nada na tela indicava que
 * existia uma janela, e o campo aceitava qualquer data do calendário. Recusar
 * depois do envio, quando as fotos já subiram, é o pior momento possível para
 * comunicar uma regra que dava para mostrar antes.
 *
 * Os limites são derivados dos MESMOS campos que `resolveEffectiveOccurredAt`
 * usa. A validação do servidor continua obrigatória: `min`/`max` de `<input>`
 * são conveniência, nunca garantia — qualquer chamada direta à Server Action
 * passa por cima deles.
 */
export function janelaDoOccurredAt(params: {
  startedAt: Date | null
  completedAt: Date | null
  agora: Date
  timeZone?: string
}): { min: string | null; max: string } {
  const { startedAt, completedAt, agora, timeZone } = params
  const teto = completedAt !== null && completedAt.getTime() < agora.getTime() ? completedAt : agora
  return {
    min: startedAt ? paraValorDeControle(startedAt, timeZone) : null,
    max: paraValorDeControle(teto, timeZone),
  }
}

/**
 * O formulário tem conteúdo que um refresh destruiria?
 *
 * Alimenta `useSuspendAutoRefreshWhileEditing`. Deliberadamente abrangente: um
 * modo manual ativado, uma única foto selecionada ou um upload em voo já contam
 * como trabalho em andamento. O custo de suspender o auto-sync por engano é
 * uma tela desatualizada por alguns segundos; o custo de NÃO suspender é perder
 * o relato que a pessoa acabou de escrever durante um atendimento real.
 */
export function formularioTemTrabalhoEmAndamento(params: {
  conteudo: string
  fotosSelecionadas: number
  modo: OccurredAtMode
  publicando: boolean
}): boolean {
  return (
    params.conteudo.trim().length > 0 ||
    params.fotosSelecionadas > 0 ||
    params.modo === "manual" ||
    params.publicando
  )
}
