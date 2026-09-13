/**
 * Módulo: partners
 * Camada: domain — re-export de compatibilidade
 *
 * A regra de telefone BR nasceu aqui (GATE-8-PARTNER-INPUT-MASKS-001/002/003),
 * só para Parceiro. Em PETEEN-PHONE-WHATSAPP-INPUT-FIX-001 ela passou a ser a
 * fonte única de TODO o produto e mora em `lib/phone/brazilian-phone.ts`.
 *
 * Este arquivo continua existindo só para não mexer nos imports e testes de
 * Parceiro que já apontam para cá. NÃO acrescentar regra neste arquivo: toda
 * mudança de telefone vai para `lib/phone/brazilian-phone.ts`.
 */

import {
  extractPhoneDigits,
  isValidBrazilianPhone,
  MAX_DOMESTIC_DIGITS,
  MIN_DOMESTIC_DIGITS,
} from "../../../lib/phone/brazilian-phone.ts"

export {
  extractPhoneDigits,
  formatBrazilianPhone,
  normalizeBrazilianPhone,
  phoneInputInitialValue,
  formatStoredBrazilianPhone,
} from "../../../lib/phone/brazilian-phone.ts"

/**
 * Contagem de dígitos (piso 10, teto 11), sem as demais regras. Mantida por
 * compatibilidade; validação de verdade é `isValidOptionalPartnerPhone` /
 * os schemas de `lib/phone/brazilian-phone.ts`.
 */
export function hasValidPartnerPhoneDigitCount(phone: string): boolean {
  const digits = extractPhoneDigits(phone).length
  return digits >= MIN_DOMESTIC_DIGITS && digits <= MAX_DOMESTIC_DIGITS
}

/** Boundary do Admin: vazio/ausente é válido (opcional); presente precisa ser telefone BR válido. */
export function isValidOptionalPartnerPhone(phone: string | null | undefined): boolean {
  if (phone === null || phone === undefined || phone.trim() === "") return true
  return isValidBrazilianPhone(phone)
}
