"use server"

import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/modules/tutor/domain/types"
import {
  createTrustConnection,
  setConnectionActive,
  countActiveConnectionsBySource,
} from "@/modules/trust-graph/infrastructure/repository"
import { TRUST_CONNECTION_WEIGHTS } from "@/modules/trust-graph/domain/constants"
import { ANTIFRAUD_GUARDRAILS } from "@/modules/antifraude/domain/constants"

import { requirePartnerContext } from "./require-partner"
import { recordPartnerRecommendationAudit } from "../infrastructure/audit"
import {
  findPartnerRecommendationById,
  findPartnerRecommendationForProfessional,
  findProfessionalForRecommendation,
  searchProfessionalsForPartnerRecommendation,
} from "../infrastructure/queries"
import type { ProfessionalSearchResult } from "../domain/types"

function revalidateRecommendationPaths(partnerSlug: string, professionalId: string) {
  revalidatePath("/partner")
  revalidatePath("/partner/recommendations")
  revalidatePath("/partner/metrics")
  revalidatePath(`/partners/${partnerSlug}`)
  revalidatePath(`/discover/${professionalId}`)
  revalidatePath("/admin/audit")
}

export async function searchProfessionalsForRecommendationAction(
  name?: string,
  city?: string
): Promise<ActionResult<ProfessionalSearchResult[]>> {
  try {
    const { partner } = await requirePartnerContext()

    const trimmedName = name?.trim()
    const trimmedCity = city?.trim()

    if (!trimmedName && !trimmedCity) {
      return {
        success: false,
        error: "Informe o nome ou a cidade para buscar profissionais.",
      }
    }

    const results = await searchProfessionalsForPartnerRecommendation(partner.id, {
      name: trimmedName,
      city: trimmedCity,
    })

    return { success: true, data: results }
  } catch (err) {
    console.error("[searchProfessionalsForRecommendationAction]", err)
    return { success: false, error: "Erro ao buscar profissionais." }
  }
}

export async function createPartnerRecommendationAction(
  professionalId: string
): Promise<ActionResult<{ connectionId: string }>> {
  try {
    const { session, partner } = await requirePartnerContext()

    const professional = await findProfessionalForRecommendation(professionalId)
    if (!professional) {
      return { success: false, error: "Profissional não encontrado." }
    }

    const existing = await findPartnerRecommendationForProfessional(
      partner.id,
      professionalId
    )
    if (existing) {
      return {
        success: false,
        error: existing.isActive
          ? "Este profissional já foi recomendado."
          : "Este profissional já possui recomendação inativa. Reative-a na lista.",
      }
    }

    // Guardrail antifraude: limite de endossos ativos por parceiro no MVP
    const activeEndorsements = await countActiveConnectionsBySource(
      partner.id,
      "PARTNER_RECOMMENDS_PROFESSIONAL"
    )
    if (activeEndorsements >= ANTIFRAUD_GUARDRAILS.MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP) {
      return {
        success: false,
        error:
          "Este parceiro já atingiu o limite de recomendações ativas no MVP. Desative uma recomendação antiga ou solicite revisão administrativa.",
      }
    }

    const connection = await createTrustConnection({
      sourceType: "PARTNER",
      sourceId: partner.id,
      sourceName: partner.businessName,
      sourcePartnerId: partner.id,
      targetId: professionalId,
      connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
      weight: TRUST_CONNECTION_WEIGHTS.PARTNER_RECOMMENDS_PROFESSIONAL,
    })

    await recordPartnerRecommendationAudit(
      session.id,
      "partner.recommendation_created",
      {
        connectionId: connection.id,
        partnerId: partner.id,
        professionalId: professional.id,
        professionalName: professional.displayName,
        isActive: true,
      }
    )

    revalidateRecommendationPaths(partner.slug, professionalId)
    return { success: true, data: { connectionId: connection.id } }
  } catch (err) {
    console.error("[createPartnerRecommendationAction]", err)
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { success: false, error: "Este profissional já foi recomendado." }
    }
    return { success: false, error: "Erro interno ao adicionar recomendação." }
  }
}

export async function deactivatePartnerRecommendationAction(
  connectionId: string
): Promise<ActionResult<void>> {
  try {
    const { session, partner } = await requirePartnerContext()

    const existing = await findPartnerRecommendationById(connectionId, partner.id)
    if (!existing) {
      return { success: false, error: "Recomendação não encontrada ou acesso negado." }
    }

    if (!existing.isActive) {
      return { success: false, error: "Recomendação já está inativa." }
    }

    await setConnectionActive(connectionId, false)

    const before = {
      id: existing.id,
      partnerId: partner.id,
      professionalId: existing.targetProfile.id,
      professionalName: existing.targetProfile.displayName,
      isActive: true,
    }

    await recordPartnerRecommendationAudit(
      session.id,
      "partner.recommendation_deactivated",
      {
        connectionId: existing.id,
        partnerId: partner.id,
        professionalId: existing.targetProfile.id,
        professionalName: existing.targetProfile.displayName,
        isActive: false,
      },
      before
    )

    revalidateRecommendationPaths(partner.slug, existing.targetId)
    return { success: true, data: undefined }
  } catch (err) {
    console.error("[deactivatePartnerRecommendationAction]", err)
    return { success: false, error: "Erro interno ao desativar recomendação." }
  }
}

export async function activatePartnerRecommendationAction(
  connectionId: string
): Promise<ActionResult<void>> {
  try {
    const { session, partner } = await requirePartnerContext()

    const existing = await findPartnerRecommendationById(connectionId, partner.id)
    if (!existing) {
      return { success: false, error: "Recomendação não encontrada ou acesso negado." }
    }

    if (existing.isActive) {
      return { success: false, error: "Recomendação já está ativa." }
    }

    // Guardrail antifraude: reativação também não pode ultrapassar o limite ativo
    const activeEndorsements = await countActiveConnectionsBySource(
      partner.id,
      "PARTNER_RECOMMENDS_PROFESSIONAL"
    )
    if (activeEndorsements >= ANTIFRAUD_GUARDRAILS.MAX_ACTIVE_PARTNER_ENDORSEMENTS_MVP) {
      return {
        success: false,
        error:
          "Este parceiro já atingiu o limite de recomendações ativas no MVP. Desative uma recomendação antiga ou solicite revisão administrativa.",
      }
    }

    await setConnectionActive(connectionId, true)

    const before = {
      id: existing.id,
      partnerId: partner.id,
      professionalId: existing.targetProfile.id,
      professionalName: existing.targetProfile.displayName,
      isActive: false,
    }

    await recordPartnerRecommendationAudit(
      session.id,
      "partner.recommendation_activated",
      {
        connectionId: existing.id,
        partnerId: partner.id,
        professionalId: existing.targetProfile.id,
        professionalName: existing.targetProfile.displayName,
        isActive: true,
      },
      before
    )

    revalidateRecommendationPaths(partner.slug, existing.targetId)
    return { success: true, data: undefined }
  } catch (err) {
    console.error("[activatePartnerRecommendationAction]", err)
    return { success: false, error: "Erro interno ao reativar recomendação." }
  }
}
