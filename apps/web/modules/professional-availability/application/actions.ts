"use server"

/**
 * Módulo: professional-availability
 * Camada: application — Server Actions (MVP 7.6)
 */

import { revalidatePath } from "next/cache"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import type { ActionResult } from "@/modules/professional/domain/types"

import type { SaveAvailabilityPayload, WeeklyAvailabilityRow } from "../domain/types"
import { validateWeeklyAvailability } from "../domain/validation"
import { recordAvailabilityAudit } from "../infrastructure/audit"
import {
  getPublicAvailabilityForProfessional,
  getWeeklyAvailabilityForProfessional,
} from "../infrastructure/queries"
import { saveProfessionalWeeklyAvailability } from "../infrastructure/repository"

function revalidateAvailabilityPaths(professionalId: string) {
  revalidatePath("/professional/agenda")
  revalidatePath("/professional")
  revalidatePath(`/discover/${professionalId}`)
}

export async function getProfessionalAvailabilityAction(): Promise<
  ActionResult<WeeklyAvailabilityRow[]>
> {
  try {
    const { profile } = await requireProfessionalContext()
    const data = await getWeeklyAvailabilityForProfessional(profile.id)
    return { success: true, data }
  } catch (err) {
    console.error("[getProfessionalAvailabilityAction]", err)
    return { success: false, error: "Erro ao carregar disponibilidade." }
  }
}

export async function saveProfessionalAvailabilityAction(
  payload: SaveAvailabilityPayload
): Promise<ActionResult<WeeklyAvailabilityRow[]>> {
  try {
    const { session, profile } = await requireProfessionalContext()

    const parsed = validateWeeklyAvailability(payload.days)
    if (!parsed.valid) {
      return { success: false, error: parsed.error }
    }

    const before = await getWeeklyAvailabilityForProfessional(profile.id)
    const saved = await saveProfessionalWeeklyAvailability(profile.id, parsed.days)

    await recordAvailabilityAudit(session.id, profile.id, saved, before)

    revalidateAvailabilityPaths(profile.id)
    return { success: true, data: saved }
  } catch (err) {
    console.error("[saveProfessionalAvailabilityAction]", err)
    return { success: false, error: "Erro ao salvar disponibilidade." }
  }
}

/** Leitura pública — sem guard de persona (para /discover) */
export async function getPublicProfessionalAvailabilityAction(
  professionalProfileId: string
) {
  return getPublicAvailabilityForProfessional(professionalProfileId)
}
