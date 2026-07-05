/**
 * módulo: location
 * camada: domain — tipos puros
 *
 * Location Intelligence Foundation V0: cidade, bairro e UF, com privacidade.
 * Nenhum tipo aqui carrega endereço exato, CEP ou coordenadas — esses dados
 * pertencem à camada interna futura (ver docs/LOCATION_INTELLIGENCE_V1_PROPOSAL.md)
 * e nunca devem transitar por contratos públicos.
 */

/** Entrada textual bruta como vive hoje nos perfis (Professional/Tutor/Partner). */
export type RawLocationText = {
  city: string | null | undefined
  state: string | null | undefined
  neighborhood?: string | null | undefined
}

/**
 * Entidade estruturada do Growth Engine (Neighborhood/Region), quando o perfil
 * tiver vínculo preenchido. Hoje nenhum perfil tem — o resolver aceita mas não
 * inventa vínculo (ver resolvePublicLocation).
 */
export type StructuredLocationEntity = {
  name: string
  city: string
  state: string
}

export type ResolvePublicLocationInput = RawLocationText & {
  neighborhoodEntity?: StructuredLocationEntity | null
  regionEntity?: StructuredLocationEntity | null
}

/** De onde veio a localização resolvida — útil para diagnostics/admin. */
export type PublicLocationSource = "structured" | "text" | "partial" | "missing"

/**
 * Localização pronta para UI pública. `label` já vem formatado — a UI não deve
 * concatenar cidade/UF/bairro manualmente (fonte única de formatação).
 */
export type ResolvedPublicLocation = {
  city: string | null
  state: string | null
  neighborhood: string | null
  label: string
  hasLocation: boolean
  source: PublicLocationSource
}

/**
 * Completude de localização — uso interno (checklist, admin, diagnostics).
 * Não é score, não afeta Trust Score e não bloqueia nenhum fluxo.
 *
 * COMPLETE             — cidade + UF + bairro
 * NEIGHBORHOOD_MISSING — cidade + UF presentes, bairro ausente
 * CITY_ONLY            — cidade presente, UF ausente/ilegível
 * MISSING              — sem cidade utilizável
 */
export type LocationCompleteness =
  | "COMPLETE"
  | "NEIGHBORHOOD_MISSING"
  | "CITY_ONLY"
  | "MISSING"
