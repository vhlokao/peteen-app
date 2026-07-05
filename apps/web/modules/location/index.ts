/**
 * módulo: location — Location Intelligence Foundation V0
 *
 * Fonte central para interpretar, normalizar, comparar e exibir
 * cidade/bairro/UF. Só funções puras — sem IO, sem Prisma, seguro para
 * Server e Client Components.
 *
 * Política de privacidade: docs/LOCATION_PRIVACY_POLICY.md
 * Roadmap V1/V2:           docs/LOCATION_INTELLIGENCE_V1_PROPOSAL.md
 */

export {
  collapseWhitespace,
  stripDiacritics,
  compareLocationText,
  titleCaseSafe,
  normalizeCityName,
  normalizeNeighborhoodName,
  normalizeStateCode,
} from "./domain/normalize"

export { formatPublicLocation, LOCATION_NOT_INFORMED_LABEL } from "./domain/format"

export { resolvePublicLocation, resolveLocationCompleteness } from "./domain/resolve"

export { KNOWN_CITIES, BR_STATE_CODES } from "./domain/known-locations"

export type {
  RawLocationText,
  StructuredLocationEntity,
  ResolvePublicLocationInput,
  ResolvedPublicLocation,
  PublicLocationSource,
  LocationCompleteness,
} from "./domain/types"
