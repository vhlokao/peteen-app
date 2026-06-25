/**
 * Módulo: partner-portal
 * Camada: infrastructure — auditoria partner.profile_updated (Etapa 6.8)
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { PartnerPortalProfile } from "../domain/types"

function profileAuditPayload(
  profile: PartnerPortalProfile
): Record<string, unknown> {
  return {
    id: profile.id,
    businessName: profile.businessName,
    category: profile.category,
    city: profile.city,
    state: profile.state,
    description: profile.description,
    phone: profile.phone,
    website: profile.website,
    logoUrl: profile.logoUrl,
  }
}

export async function recordPartnerProfileAudit(
  userId: string,
  profile: PartnerPortalProfile,
  before?: PartnerPortalProfile | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "partner.profile_updated",
        entity: "Partner",
        entityId: profile.id,
        before: before
          ? (profileAuditPayload(before) as Prisma.InputJsonValue)
          : undefined,
        after: profileAuditPayload(profile) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}

export type PartnerRecommendationAuditAction =
  | "partner.recommendation_created"
  | "partner.recommendation_deactivated"
  | "partner.recommendation_activated"

type RecommendationAuditPayload = {
  id: string
  partnerId: string
  professionalId: string
  professionalName: string
  isActive: boolean
}

function recommendationAuditPayload(input: {
  connectionId: string
  partnerId: string
  professionalId: string
  professionalName: string
  isActive: boolean
}): RecommendationAuditPayload {
  return {
    id: input.connectionId,
    partnerId: input.partnerId,
    professionalId: input.professionalId,
    professionalName: input.professionalName,
    isActive: input.isActive,
  }
}

export async function recordPartnerRecommendationAudit(
  userId: string,
  action: PartnerRecommendationAuditAction,
  input: {
    connectionId: string
    partnerId: string
    professionalId: string
    professionalName: string
    isActive: boolean
  },
  before?: RecommendationAuditPayload | null
): Promise<void> {
  try {
    const after = recommendationAuditPayload(input)
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "TrustConnection",
        entityId: input.connectionId,
        before: before ? (before as Prisma.InputJsonValue) : undefined,
        after: after as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
