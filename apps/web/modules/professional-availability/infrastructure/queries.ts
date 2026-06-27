/**
 * Módulo: professional-availability
 * Camada: infrastructure — consultas read-only (MVP 7.6)
 */

import { mergeWithDefaults, toPublicAvailabilityDays } from "../domain/formatters"
import type { PublicAvailabilityDay, WeeklyAvailabilityRow } from "../domain/types"
import { findAvailabilityByProfessionalId } from "./repository"

export async function getPublicAvailabilityForProfessional(
  professionalProfileId: string
): Promise<PublicAvailabilityDay[]> {
  const rows = await findAvailabilityByProfessionalId(professionalProfileId)
  return toPublicAvailabilityDays(mergeWithDefaults(rows))
}

export async function getWeeklyAvailabilityForProfessional(
  professionalProfileId: string
): Promise<WeeklyAvailabilityRow[]> {
  const rows = await findAvailabilityByProfessionalId(professionalProfileId)
  return mergeWithDefaults(rows)
}
