/**
 * Módulo: partner-portal
 * Camada: infrastructure — ownership User → Partner
 */

import { prisma } from "@/lib/prisma/client"
import { getPartnerById } from "@/modules/partners/infrastructure/repository"
import type { Partner } from "@/modules/partners/domain/types"
import type { PartnerPortalProfile } from "../domain/types"

export type PartnerProfileLink = {
  id: string
  userId: string
  displayName: string
  linkedPartnerId: string | null
}

export async function findPartnerProfileByUserId(
  userId: string
): Promise<PartnerProfileLink | null> {
  try {
    const row = await prisma.partnerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        linkedPartnerId: true,
      },
    })
    return row
  } catch {
    return null
  }
}

export async function findOwnedPartnerForUser(
  userId: string
): Promise<{ partnerProfile: PartnerProfileLink; partner: Partner } | null> {
  const partnerProfile = await findPartnerProfileByUserId(userId)
  if (!partnerProfile?.linkedPartnerId) return null

  const partner = await getPartnerById(partnerProfile.linkedPartnerId)
  if (!partner) return null

  return { partnerProfile, partner }
}

export function toPartnerPortalProfile(partner: Partner): PartnerPortalProfile {
  return {
    id: partner.id,
    businessName: partner.businessName,
    slug: partner.slug,
    category: partner.category,
    city: partner.city,
    state: partner.state,
    description: partner.description,
    phone: partner.phone,
    website: partner.website,
    logoUrl: partner.logoUrl,
    verificationStatus: partner.verificationStatus,
    isVerified: partner.isVerified,
  }
}
