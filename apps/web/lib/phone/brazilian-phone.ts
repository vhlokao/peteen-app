/**
 * Telefone BR — fonte única de normalização, máscara, validação e link de
 * WhatsApp para TODO o PETEEN (Tutor, Profissional, Parceiro).
 *
 * PETEEN-PHONE-WHATSAPP-INPUT-FIX-001. Antes, havia três regras para o mesmo
 * dado — regex ampla de 8–20 caracteres (Tutor/Profissional no servidor),
 * "≥ 10 dígitos sem teto" (Profissional no cliente, em 4 cópias) e 10–11
 * dígitos (Parceiro) — e o link `wa.me` tinha uma quarta heurística própria,
 * que gerava link para qualquer entrada. Tudo passa a derivar daqui.
 *
 * Módulo PURO (sem "@/", sem Next, sem Node): roda no browser, no servidor e
 * em `node --test`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FORMA CANÔNICA (o que se grava)
 *
 * Só dígitos domésticos com DDD: 10 (fixo) ou 11 (celular), sem +55 e sem
 * pontuação. Ex.: "11987654321". A máscara é só apresentação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NORMALIZAÇÃO — só remove o que é INEQUÍVOCO
 *
 * 1. DDI 55: removido SÓ quando o total tem 12 ou 13 dígitos. Um doméstico BR
 *    nunca passa de 11, então 12/13 começando em 55 só pode ser DDI + fixo/
 *    celular. 10/11 dígitos começando em 55 é DDD 55 legítimo (Santa Maria/RS)
 *    e fica intacto. (Regra herdada do GATE-8-PARTNER-INPUT-MASKS-FIX-002.)
 * 2. Zero de tronco: UM "0" à esquerda é removido SÓ quando o total tem 11 ou
 *    12 dígitos — aí o resultado é 10/11 e nenhum DDD começa com 0, então não
 *    há outra leitura possível. Sequências com código de operadora
 *    ("0 15 11 …", 13–14 dígitos) não entram nessa contagem e são recusadas.
 * 3. Validade (BR-only, sem lista fechada de DDD neste gate):
 *    - 10 ou 11 dígitos;
 *    - DDD com primeiro dígito ≠ 0;
 *    - 11 dígitos → o dígito após o DDD é 9 (celular);
 *    - 10 dígitos (fixo) segue aceito sem regra adicional, para não recusar
 *      número legado.
 * 4. Caractere fora de dígito, espaço, hífen, parênteses e "+" inicial →
 *    inválido. Letra nunca é descartada em silêncio na VALIDAÇÃO.
 *
 * Número estrangeiro com "+" e DDI ≠ 55 cai em "inválido" pela contagem. Um
 * estrangeiro de 10/11 dígitos SEM "+" é indistinguível de um BR e passa pela
 * mesma regra de DDD/celular — limitação conhecida e aceita (BR-only).
 */

import { z } from "zod"

/** Fixo com DDD. */
export const MIN_DOMESTIC_DIGITS = 10
/** Celular com DDD. */
export const MAX_DOMESTIC_DIGITS = 11

const BRAZIL_COUNTRY_CODE = "55"
const TRUNK_PREFIX = "0"

/** Caracteres que um telefone digitado/colado pode ter. Letra = inválido. */
const ALLOWED_PHONE_CHARS = /^\+?[\d\s\-()]*$/

/** Só os dígitos. Usado pela máscara (que ignora o resto) e pela contagem. */
export function extractPhoneDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Remove DDI 55 (12/13 dígitos) e, depois, um zero de tronco (11/12 dígitos) —
 * cada um só quando o comprimento torna a leitura inequívoca. Não valida;
 * devolve os dígitos que sobraram, que podem continuar inválidos.
 */
function stripUnambiguousPrefixes(digits: string): string {
  let d = digits
  if (
    d.startsWith(BRAZIL_COUNTRY_CODE) &&
    (d.length === BRAZIL_COUNTRY_CODE.length + MIN_DOMESTIC_DIGITS ||
      d.length === BRAZIL_COUNTRY_CODE.length + MAX_DOMESTIC_DIGITS)
  ) {
    d = d.slice(BRAZIL_COUNTRY_CODE.length)
  }
  if (
    d.startsWith(TRUNK_PREFIX) &&
    (d.length === TRUNK_PREFIX.length + MIN_DOMESTIC_DIGITS ||
      d.length === TRUNK_PREFIX.length + MAX_DOMESTIC_DIGITS)
  ) {
    d = d.slice(TRUNK_PREFIX.length)
  }
  return d
}

/** Regras de validade sobre dígitos domésticos já sem prefixo. */
function isValidDomesticDigits(d: string): boolean {
  if (d.length !== MIN_DOMESTIC_DIGITS && d.length !== MAX_DOMESTIC_DIGITS) return false
  if (d[0] === "0") return false
  if (d.length === MAX_DOMESTIC_DIGITS && d[2] !== "9") return false
  return true
}

/**
 * Forma canônica (10/11 dígitos domésticos) ou `null` se a entrada não for um
 * telefone BR válido. Vazio → `null`.
 */
export function normalizeBrazilianPhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === "" || !ALLOWED_PHONE_CHARS.test(trimmed)) return null
  const digits = stripUnambiguousPrefixes(extractPhoneDigits(trimmed))
  return isValidDomesticDigits(digits) ? digits : null
}

/** true quando `normalizeBrazilianPhone` consegue uma forma canônica. */
export function isValidBrazilianPhone(raw: string | null | undefined): boolean {
  return normalizeBrazilianPhone(raw) !== null
}

/**
 * Formata dígitos domésticos progressivamente:
 *   0-2 → "(11"   3-6 → "(11) 999"   7-10 → "(11) 3333-4444"   11 → "(11) 99999-9999"
 */
function formatDomesticDigits(digits: string): string {
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  const splitAt = digits.length >= MAX_DOMESTIC_DIGITS ? 5 : 4
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`
}

/**
 * MÁSCARA de input — função pura, recalculada a partir dos DÍGITOS do valor a
 * cada evento (digitar, colar, autofill, apagar no meio ou no fim).
 *
 * Aplica as mesmas remoções inequívocas da normalização (DDI 55, zero de
 * tronco), então colar "+55 11 98765-4321" ou "(011) 98765-4321" mostra
 * "(11) 98765-4321". NÃO valida: um número incompleto aparece incompleto.
 *
 * Excedente (> 11 dígitos que não sejam DDI/tronco reconhecíveis) NUNCA é
 * truncado: os 11 primeiros formatados e o resto colado à vista, para a
 * validação recusar em vez de gravar outro número.
 */
export function formatBrazilianPhone(value: string): string {
  const digits = stripUnambiguousPrefixes(extractPhoneDigits(value))
  if (digits.length <= MAX_DOMESTIC_DIGITS) return formatDomesticDigits(digits)
  return `${formatDomesticDigits(digits.slice(0, MAX_DOMESTIC_DIGITS))}${digits.slice(MAX_DOMESTIC_DIGITS)}`
}

/**
 * Valor inicial de um campo de EDIÇÃO a partir do que está gravado.
 *
 * Normalizável → formatado. Não normalizável → o texto bruto, INTACTO, para o
 * usuário ver e corrigir — nunca reinterpretado como outro número.
 */
export function phoneInputInitialValue(stored: string | null | undefined): string {
  if (!stored) return ""
  const canonical = normalizeBrazilianPhone(stored)
  return canonical ? formatBrazilianPhone(canonical) : stored
}

/**
 * Texto de EXIBIÇÃO de um telefone gravado, ou `null` quando não há telefone
 * utilizável. Quem exibe decide o que mostrar no `null` — nunca o texto
 * inválido como se fosse contato.
 */
export function formatStoredBrazilianPhone(stored: string | null | undefined): string | null {
  const canonical = normalizeBrazilianPhone(stored)
  return canonical ? formatBrazilianPhone(canonical) : null
}

/** Link `wa.me` para um telefone BR válido; `null` para qualquer outra coisa. */
export function toWhatsAppUrl(raw: string | null | undefined): string | null {
  const canonical = normalizeBrazilianPhone(raw)
  return canonical ? `https://wa.me/${BRAZIL_COUNTRY_CODE}${canonical}` : null
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA ZOD — mesma regra no cliente (zodResolver) e no servidor (actions)
// ─────────────────────────────────────────────────────────────────────────────

export const PHONE_INVALID_MESSAGE = "Informe um telefone válido com DDD"

type PhoneFieldOptions = {
  /** Mensagem para valor presente que não é telefone BR válido. */
  invalidMessage?: string
  /** Só para `brazilianPhoneRequired`: mensagem para vazio. */
  requiredMessage?: string
}

function canonicalOrIssue(message: string) {
  return (value: string, ctx: z.RefinementCtx): string => {
    const canonical = normalizeBrazilianPhone(value)
    if (canonical === null) {
      ctx.addIssue({ code: "custom", message })
      return z.NEVER
    }
    return canonical
  }
}

/**
 * Campo OBRIGATÓRIO. Saída: forma canônica.
 */
export function brazilianPhoneRequired(options: PhoneFieldOptions = {}) {
  const invalid = options.invalidMessage ?? PHONE_INVALID_MESSAGE
  return z
    .string()
    .trim()
    .min(1, options.requiredMessage ?? invalid)
    .transform(canonicalOrIssue(invalid))
}

/**
 * Campo OPCIONAL. Ausente → `undefined`; vazio/só espaços → `""`; presente →
 * forma canônica ou erro. Quem persiste já converte `""` em `null`/sem mudança,
 * como antes.
 */
export function brazilianPhoneOptional(options: PhoneFieldOptions = {}) {
  const invalid = options.invalidMessage ?? PHONE_INVALID_MESSAGE
  return z
    .string()
    .trim()
    .transform((value, ctx) => (value === "" ? "" : canonicalOrIssue(invalid)(value, ctx)))
    .optional()
}
