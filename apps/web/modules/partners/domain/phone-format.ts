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
 * Função PURA — sem estado, sem posição de cursor. Recebe o valor bruto do
 * campo (o que quer que o usuário tenha digitado ou colado) e devolve a
 * versão formatada; o chamador reatribui isso ao valor do input a cada
 * evento. Formatar a partir dos DÍGITOS do valor (não do valor anterior) é o
 * que faz colar um número já formatado, colar só dígitos, apagar no meio da
 * string e backspace no fim funcionarem igual: cada teclada recalcula do
 * zero a partir do que sobrou de dígito, nunca acumula lixo de formatação
 * anterior.
 */

/** Máximo de dígitos aceito: DDD (2) + celular com 9º dígito (9) = 11. */
const MAX_PHONE_DIGITS = 11

/** Extrai só os dígitos de um valor de telefone — usado pela máscara e pela validação de contagem. */
export function extractPhoneDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Formata dígitos de telefone BR progressivamente, conforme a quantidade
 * digitada até agora — nunca exige o número completo para começar a mostrar
 * a máscara:
 *   0-2 dígitos   → "(11"
 *   3-6 dígitos   → "(11) 999"
 *   7-10 dígitos  → "(11) 3333-4444"   (fixo: DDD + 4 + 4)
 *   11 dígitos    → "(11) 99999-9999" (celular: DDD + 5 + 4)
 *
 * Dígitos além do 11º são descartados — nenhum telefone BR com DDD passa
 * disso, e truncar aqui é uma regra explícita (não silenciosa: é o próprio
 * formato que para de aceitar mais dígitos).
 */
export function formatBrazilianPhone(value: string): string {
  const digits = extractPhoneDigits(value).slice(0, MAX_PHONE_DIGITS)

  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length <= 4) return `(${ddd}) ${rest}`

  // 10 dígitos totais (rest.length === 8) é o teto do fixo (4+4); a partir
  // do 9º dígito do `rest` (11 dígitos totais) já é celular (5+4).
  const splitAt = digits.length >= MAX_PHONE_DIGITS ? 5 : 4
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`
}
