"use server"

/**
 * Módulo: partner-portal
 * Camada: application — edição de perfil da organização
 */

import { revalidatePath } from "next/cache"

import { updatePartner } from "@/modules/partners/infrastructure/repository"
import type { ActionResult } from "@/modules/tutor/domain/types"
import type { PartnerCategory } from "@/modules/partners/domain/types"
import { UpdatePartnerPortalProfileSchema } from "../domain/schemas"
import type { PartnerPortalProfile, UpdatePartnerPortalProfileInput } from "../domain/types"
import { recordPartnerProfileAudit } from "../infrastructure/audit"
import {
  findOwnedPartnerForUser,
  toPartnerPortalProfile,
} from "../infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export async function updatePartnerPortalProfileAction(
  partnerId: string,
  input: UpdatePartnerPortalProfileInput
): Promise<ActionResult<PartnerPortalProfile>> {
  try {
    const session = await requireAuth()

    if (!session.roles.includes("PARTNER")) {
      return { success: false, error: "Acesso negado." }
    }

    const owned = await findOwnedPartnerForUser(session.id)
    if (!owned || owned.partner.id !== partnerId) {
      return { success: false, error: "Acesso negado." }
    }

    const parsed = UpdatePartnerPortalProfileSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const before = toPartnerPortalProfile(owned.partner)

    const updated = await updatePartner(partnerId, {
      businessName: parsed.data.businessName,
      description: parsed.data.description,
      city: parsed.data.city,
      state: parsed.data.state.toUpperCase(),
      phone: parsed.data.phone?.trim() || undefined,
      category: parsed.data.category as PartnerCategory,
      website: parsed.data.website?.trim() || undefined,
      logoUrl: parsed.data.logoUrl?.trim() || undefined,
    })

    const after = toPartnerPortalProfile(updated)
    await recordPartnerProfileAudit(session.id, after, before)

    revalidatePath("/partner")
    revalidatePath("/partner/profile")
    revalidatePath("/partner/metrics")
    revalidatePath("/partner/recommendations")
    revalidatePath(`/partners/${updated.slug}`)
    revalidatePath("/admin/audit")

    return { success: true, data: after }
  } catch (err) {
    console.error("[updatePartnerPortalProfileAction]", err)
    return { success: false, error: "Erro interno ao atualizar perfil." }
  }
}
