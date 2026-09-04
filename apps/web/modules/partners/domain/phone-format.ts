/**
 * Módulo: partners
 * Camada: domain — máscara de telefone BR para os campos de Partner
 *
 * GATE-8-PARTNER-INPUT-MASKS-001: até este gate, o produto inteiro tratava
 * telefone como texto livre, por decisão deliberada (ver comentário anterior
 * em `modules/partners/schemas/index.ts`, removido agora que este gate
 * autoriza exatamente o oposto para Partner). Vitor percebeu, em uso real,
 * que digitar telefone nas telas de Partner era desagradável sem máscara —
 * esta função é o único ponto de formatação, usada por todas as superfícies
 * de Partner (onboarding, edição autenticada, admin), então as três exibem e
 * aceitam o mesmo formato.
 *
 * GATE-8-PARTNER-INPUT-MASKS-FIX-002 — REGRESSÃO CORRIGIDA
 *
 * A primeira versão fazia `extractPhoneDigits(value).slice(0, 11)` cegamente.
 * Um telefone colado/autopreenchido COM código de país BR
 * (`+55 11 99999-9999` → dígitos `5511999999999`, 13 dígitos) virava
 * `55119999999` depois do slice — os 2 primeiros dígitos do NÚMERO real
 * (`11999999999`) eram perdidos, e o "55" do DDI passava a ser lido como
 * DDD. O telefone salvo não era mais o telefone fornecido.
 *
 * A REGRA agora é: só remover um prefixo "55" quando a CONTAGEM DE DÍGITOS
 * deixa isso inequívoco — um telefone doméstico BR com DDD nunca passa de 11
 * dígitos, então 12 ou 13 dígitos começando em "55" só podem ser DDI + número
 * doméstico (12 = DDI + 10 dígitos de fixo; 13 = DDI + 11 dígitos de celular).
 * Um telefone doméstico de 10 ou 11 dígitos que POR ACASO tem DDD 55 (Santa
 * Maria/RS é DDD 55 de verdade) nunca cai nessa contagem — fica com os
 * mesmos 10/11 dígitos de sempre, DDD preservado, nada é removido dele.
 *
 * Entradas maiores que 11 dígitos que NÃO se encaixam nesse padrão de DDI
 * (12/13 dígitos começando em "55") não são truncadas para parecer um número
 * válido — os dígitos excedentes ficam visíveis, sem agrupamento, para que a
 * validação (ver modules/partners/schemas/index.ts) rejeite em vez de aceitar
 * silenciosamente um número diferente do que foi digitado/colado.
 *
 * Função PURA — sem estado, sem posição de cursor. Recebe o valor bruto do
 * campo (o que quer que o usuário tenha digitado ou colado) e devolve a
 * versão formatada; o chamador reatribui isso ao valor do input a cada
 * evento. Formatar a partir dos DÍGITOS do valor (não do valor anterior) é o
 * que faz colar um número já formatado, colar só dígitos, apagar no meio da
 * string e backspace no fim funcionarem igual: cada teclada recalcula do
 * zero a partir do que sobrou de dígito, nunca acumula lixo de formatação
 * anterior.
 */

/** Telefone doméstico BR com DDD: fixo tem 10 dígitos, celular 11. */
const MIN_DOMESTIC_DIGITS = 10
const MAX_DOMESTIC_DIGITS = 11

/** DDI do Brasil — só tratado como código de país quando o comprimento total é inequívoco (ver stripBrazilCountryCode). */
const BRAZIL_COUNTRY_CODE = "55"

/** Extrai só os dígitos de um valor de telefone — usado pela máscara e pela validação de contagem. */
export function extractPhoneDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Remove o prefixo "55" SÓ quando o comprimento total prova que é DDI, não
 * DDD: 12 dígitos = DDI(2) + fixo doméstico(10); 13 dígitos = DDI(2) +
 * celular doméstico(11). Qualquer outro comprimento (inclusive 10/11 — um
 * doméstico legítimo com DDD 55) passa intocado.
 */
function stripBrazilCountryCode(digits: string): string {
  const isUnambiguousCountryCode =
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    (digits.length === BRAZIL_COUNTRY_CODE.length + MIN_DOMESTIC_DIGITS ||
      digits.length === BRAZIL_COUNTRY_CODE.length + MAX_DOMESTIC_DIGITS)

  return isUnambiguousCountryCode ? digits.slice(BRAZIL_COUNTRY_CODE.length) : digits
}

/**
 * Formata até 11 dígitos DOMÉSTICOS (DDD já resolvido, sem DDI) progressiva,
 * conforme a quantidade digitada até agora:
 *   0-2 dígitos  → "(11"
 *   3-6 dígitos  → "(11) 999"
 *   7-10 dígitos → "(11) 3333-4444"  (fixo: DDD + 4 + 4)
 *   11 dígitos   → "(11) 99999-9999" (celular: DDD + 5 + 4)
 */
function formatDomesticDigits(digits: string): string {
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length <= 4) return `(${ddd}) ${rest}`

  // 10 dígitos totais (rest.length === 8) é o teto do fixo (4+4); a partir
  // do 9º dígito do `rest` (11 dígitos totais) já é celular (5+4).
  const splitAt = digits.length >= MAX_DOMESTIC_DIGITS ? 5 : 4
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`
}

/**
 * Formata um telefone BR — ver o comentário do módulo para a regra completa
 * de normalização de DDI e o porquê de entradas excedentes não serem
 * truncadas silenciosamente.
 */
export function formatBrazilianPhone(value: string): string {
  const digits = stripBrazilCountryCode(extractPhoneDigits(value))

  if (digits.length <= MAX_DOMESTIC_DIGITS) {
    return formatDomesticDigits(digits)
  }

  // Mais dígitos do que um telefone doméstico comporta, e não é um DDI 55
  // reconhecível (senão `stripBrazilCountryCode` já teria resolvido acima).
  // Formata só os 11 primeiros e devolve o restante COLADO, sem máscara —
  // nada é escondido, e a contagem de dígitos do resultado continua > 11,
  // então a validação do schema rejeita em vez de aceitar um número
  // silenciosamente diferente do que foi fornecido.
  const dominio = digits.slice(0, MAX_DOMESTIC_DIGITS)
  const excedente = digits.slice(MAX_DOMESTIC_DIGITS)
  return `${formatDomesticDigits(dominio)}${excedente}`
}
