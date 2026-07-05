/**
 * módulo: location
 * camada: domain — formatação de label público
 *
 * Fonte única do texto de localização exibido em UI pública. Nenhuma tela
 * deve concatenar cidade/UF/bairro manualmente — mudanças de formato
 * acontecem só aqui.
 *
 * Formatos:
 *   bairro + cidade + UF → "Centro, Carapicuíba — SP"
 *   cidade + UF          → "Carapicuíba — SP"
 *   só cidade            → "Carapicuíba"
 *   nada                 → "Localização não informada"
 *
 * Nunca produz "null", "undefined", vírgula sobrando ou cidade repetida.
 */

export const LOCATION_NOT_INFORMED_LABEL = "Localização não informada"

export function formatPublicLocation(parts: {
  city: string | null
  state: string | null
  neighborhood?: string | null
}): string {
  const city = parts.city?.trim() || null
  const state = parts.state?.trim() || null
  const neighborhood = parts.neighborhood?.trim() || null

  if (!city) return LOCATION_NOT_INFORMED_LABEL

  const cityWithState = state ? `${city} — ${state}` : city

  if (neighborhood) return `${neighborhood}, ${cityWithState}`
  return cityWithState
}
