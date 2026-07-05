/**
 * módulo: location
 * camada: domain — resolver central de localização pública
 *
 * Ordem de resolução (Foundation V0):
 *   1. entidade estruturada (Neighborhood do Growth Engine), se o perfil
 *      tiver vínculo preenchido — normalizada, pois as próprias entidades
 *      podem ter texto sem acento;
 *   2. campos textuais do perfil, normalizados;
 *   3. parcial (só cidade, ou cidade sem UF legível);
 *   4. "Localização não informada".
 *
 * Nunca inventa vínculo estruturado: se neighborhoodId/regionId são null,
 * a entrada simplesmente não traz `neighborhoodEntity` e o resolver cai
 * para o texto. Nunca expõe endereço exato, CEP ou coordenadas — esses
 * campos nem existem nos contratos deste módulo.
 */

import { formatPublicLocation } from "./format.ts"
import {
  normalizeCityName,
  normalizeNeighborhoodName,
  normalizeStateCode,
} from "./normalize.ts"
import type {
  LocationCompleteness,
  ResolvePublicLocationInput,
  ResolvedPublicLocation,
} from "./types.ts"

export function resolvePublicLocation(
  input: ResolvePublicLocationInput
): ResolvedPublicLocation {
  const structured = input.neighborhoodEntity ?? null

  const city = structured
    ? normalizeCityName(structured.city)
    : normalizeCityName(input.city)
  const state = structured
    ? normalizeStateCode(structured.state)
    : normalizeStateCode(input.state)
  const neighborhood = structured
    ? normalizeNeighborhoodName(structured.name)
    : normalizeNeighborhoodName(input.neighborhood)

  const source: ResolvedPublicLocation["source"] = !city
    ? "missing"
    : structured
      ? "structured"
      : state && neighborhood
        ? "text"
        : state
          ? "text"
          : "partial"

  return {
    city,
    state,
    neighborhood,
    label: formatPublicLocation({ city, state, neighborhood }),
    hasLocation: city !== null,
    source,
  }
}

/**
 * Completude de localização — interno (checklist/admin/diagnostics).
 * Não é score, não bloqueia usuário, não afeta Trust Score.
 */
export function resolveLocationCompleteness(
  input: ResolvePublicLocationInput
): LocationCompleteness {
  const resolved = resolvePublicLocation(input)
  if (!resolved.city) return "MISSING"
  if (!resolved.state) return "CITY_ONLY"
  if (!resolved.neighborhood) return "NEIGHBORHOOD_MISSING"
  return "COMPLETE"
}
