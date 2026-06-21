"use server"

/**
 * módulo: partners
 * camada: application — onboarding público (Etapa 6.1)
 *
 * Sem login de parceiro. Cria/atualiza entidade Partner e Trust Graph.
 */

import { revalidatePath } from "next/cache"

import { createTrustConnection } from "@/modules/trust-graph/infrastructure/repository"
import { TRUST_CONNECTION_WEIGHTS } from "@/modules/trust-graph/domain/constants"
import { recordPartnerAudit } from "./partner-audit"
import { requestVerificationAction } from "@/modules/verification/application/actions"
import { ensurePartnerVerificationRequest } from "@/modules/verification/infrastructure/repository"
import {
  createPartnerOnboarding,
  updatePartnerOnboardingBusiness,
  updatePartnerOnboardingTrust,
  completePartnerOnboarding,
  getPartnerById,
  getProfessionalsForOnboarding,
  getPartnerOperationalMetrics,
  getPartnerOnboardingResult,
} from "../infrastructure/repository"
import type {
  PartnerOnboardingBusinessInput,
  PartnerOnboardingTrustInput,
  PartnerOnboardingCompleteResult,
  ProfessionalOnboardingOption,
  PartnerOperationalMetrics,
} from "../domain/types"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function getProfessionalsForOnboardingAction(
  city?: string
): Promise<ProfessionalOnboardingOption[]> {
  return getProfessionalsForOnboarding(city)
}

export async function savePartnerOnboardingBusinessAction(
  input: PartnerOnboardingBusinessInput
): Promise<ActionResult<{ partnerId: string; slug: string }>> {
  try {
    if (!input.businessName.trim() || !input.city.trim() || !input.state.trim() || !input.phone.trim()) {
      return { ok: false, error: "Preencha nome, cidade, estado e telefone." }
    }

    const partner = await createPartnerOnboarding(input)

    await recordPartnerAudit("partner.onboarding_started", partner.id, {
      category:     partner.category,
      businessName: partner.businessName,
      city:         partner.city,
    })

    revalidatePath("/admin/partners")
    return { ok: true, data: { partnerId: partner.id, slug: partner.slug } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar dados do negócio"
    return { ok: false, error: msg }
  }
}

export async function updatePartnerOnboardingBusinessAction(
  partnerId: string,
  input: PartnerOnboardingBusinessInput
): Promise<ActionResult<{ partnerId: string }>> {
  try {
    const partner = await updatePartnerOnboardingBusiness(partnerId, input)
    return { ok: true, data: { partnerId: partner.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar" }
  }
}

export async function savePartnerOnboardingTrustAction(
  input: PartnerOnboardingTrustInput
): Promise<ActionResult<void>> {
  try {
    const partner = await updatePartnerOnboardingTrust(input)

    if (input.requestVerification) {
      const notes =
        [
          input.yearsInBusiness != null ? `Anos: ${input.yearsInBusiness}` : null,
          input.hasCnpj ? "Possui CNPJ" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined

      const verificationResult = await requestVerificationAction({
        entityType: "PARTNER",
        entityId:   partner.id,
        notes,
      })

      if (!verificationResult.ok) {
        const ensured = await ensurePartnerVerificationRequest(partner.id, notes)
        if (!ensured) {
          return {
            ok: false,
            error: verificationResult.error ?? "Não foi possível registrar solicitação de verificação.",
          }
        }
      }

      await recordPartnerAudit("partner.verification_requested", partner.id, {
        yearsInBusiness: input.yearsInBusiness ?? null,
        hasCnpj:         input.hasCnpj,
      })
    }

    revalidatePath("/admin/partners")
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar confiança" }
  }
}

export async function savePartnerOnboardingRecommendationsAction(
  partnerId: string,
  professionalIds: string[]
): Promise<ActionResult<{ connectionsCreated: number }>> {
  try {
    const partner = await getPartnerById(partnerId)
    if (!partner) return { ok: false, error: "Parceiro não encontrado." }
    if (partner.onboardingStatus === "COMPLETED") {
      return { ok: false, error: "Onboarding já concluído." }
    }

    const uniqueIds = [...new Set(professionalIds.filter(Boolean))]
    if (uniqueIds.length === 0) {
      return { ok: true, data: { connectionsCreated: 0 } }
    }

    let connectionsCreated = 0
    let firstRecommendation = false

    for (const targetId of uniqueIds) {
      try {
        await createTrustConnection({
          sourceType:      "PARTNER",
          sourceId:        partner.id,
          sourceName:      partner.businessName,
          sourcePartnerId: partner.id,
          targetId,
          connectionType:  "PARTNER_RECOMMENDS_PROFESSIONAL",
          weight:          TRUST_CONNECTION_WEIGHTS.PARTNER_RECOMMENDS_PROFESSIONAL,
        })
        connectionsCreated++
        if (!firstRecommendation) {
          firstRecommendation = true
          await recordPartnerAudit("partner.first_recommendation", partner.id, {
            targetId,
            businessName: partner.businessName,
          })
        }
      } catch (err) {
        if (!(err instanceof Error && err.message.includes("Unique constraint"))) {
          throw err
        }
      }
    }

    revalidatePath("/admin/trust-graph")
    revalidatePath("/discover", "layout")
    return { ok: true, data: { connectionsCreated } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao criar recomendações" }
  }
}

export async function completePartnerOnboardingAction(
  partnerId: string
): Promise<ActionResult<PartnerOnboardingCompleteResult>> {
  try {
    const partner = await completePartnerOnboarding(partnerId)

    const result = await getPartnerOnboardingResult(partnerId)

    await recordPartnerAudit("partner.onboarding_completed", partner.id, {
      businessName:        partner.businessName,
      slug:                partner.slug,
      recommendationCount: result.recommendationCount,
      activationScore:     result.activationScore,
    })

    revalidatePath("/admin/partners")
    revalidatePath("/admin/verifications")
    revalidatePath(`/partners/${partner.slug}`)
    revalidatePath("/discover", "layout")

    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao concluir onboarding" }
  }
}

export async function getPartnerOperationalMetricsAction(
  partnerId: string
): Promise<PartnerOperationalMetrics | null> {
  return getPartnerOperationalMetrics(partnerId)
}

export async function getPartnerOnboardingResumeAction(partnerId: string) {
  const partner = await getPartnerById(partnerId)
  if (!partner || partner.onboardingStatus === "COMPLETED") return null
  return partner
}
