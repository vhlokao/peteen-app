/**
 * módulo: partners
 * camada: infrastructure — repository
 */

import { prisma } from "@/lib/prisma/client"
import { computeActivationScore } from "../domain/activation"
import type {
  Partner,
  PartnerCategory,
  PartnerAdminRow,
  CreatePartnerInput,
  UpdatePartnerInput,
  PartnerPublicProfile,
  PartnerRecommendedProfessional,
  PartnerDashboardMetrics,
  PartnerOnboardingBusinessInput,
  PartnerOnboardingTrustInput,
  PartnerOperationalMetrics,
  PartnerOnboardingCompleteResult,
  ProfessionalOnboardingOption,
  PartnerVerificationStatus,
  PartnerOnboardingStatus,
} from "../domain/types"
import { generatePartnerSlug } from "../domain/slug"

const PARTNER_DELEGATE_UNAVAILABLE =
  "Módulo Partner indisponível no Prisma Client. Execute `npx prisma generate` e reinicie o servidor (npm run dev)."

function getPartnerDelegate() {
  const delegate = (prisma as unknown as { partner?: typeof prisma.partner }).partner
  if (!delegate) {
    throw new Error(PARTNER_DELEGATE_UNAVAILABLE)
  }
  return delegate
}

function mapPartner(row: {
  id: string
  businessName: string
  slug: string
  category: string
  city: string
  state: string
  description: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  logoUrl: string | null
  isVerified: boolean
  isActive: boolean
  onboardingStatus?: string
  onboardingCompletedAt?: Date | null
  verificationStatus?: string
  yearsInBusiness?: number | null
  hasCnpj?: boolean
  verificationRequestedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}): Partner {
  return {
    ...row,
    category: row.category as PartnerCategory,
    onboardingStatus: (row.onboardingStatus ?? "NOT_STARTED") as PartnerOnboardingStatus,
    onboardingCompletedAt: row.onboardingCompletedAt ?? null,
    verificationStatus: (row.verificationStatus ?? "NONE") as PartnerVerificationStatus,
    yearsInBusiness: row.yearsInBusiness ?? null,
    hasCnpj: row.hasCnpj ?? false,
    verificationRequestedAt: row.verificationRequestedAt ?? null,
  }
}

async function countPartnerRecommendations(partnerId: string): Promise<number> {
  try {
    return await prisma.trustConnection.count({
      where: {
        isActive: true,
        connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
        OR: [
          { sourcePartnerId: partnerId },
          { sourceId: partnerId, sourceType: "PARTNER" },
        ],
      },
    })
  } catch {
    return 0
  }
}

function buildActivationForPartner(
  partner: Partner,
  recommendationCount: number
): number {
  return computeActivationScore({
    businessName:          partner.businessName,
    city:                  partner.city,
    state:                 partner.state,
    phone:                 partner.phone,
    logoUrl:               partner.logoUrl,
    description:           partner.description,
    recommendationCount,
    verificationRequested:
      partner.verificationStatus === "PENDING_VERIFICATION" ||
      partner.verificationRequestedAt !== null,
  })
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getAllPartners(filters?: {
  isActive?: boolean
  isVerified?: boolean
  onboardingStatus?: PartnerOnboardingStatus
  onboardingFilter?: "incomplete" | "completed"
}): Promise<Partner[]> {
  try {
    const partner = getPartnerDelegate()
    const where: Record<string, unknown> = {}
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    if (filters?.isVerified !== undefined) where.isVerified = filters.isVerified
    if (filters?.onboardingStatus) where.onboardingStatus = filters.onboardingStatus
    if (filters?.onboardingFilter === "completed") {
      where.onboardingStatus = "COMPLETED"
    } else if (filters?.onboardingFilter === "incomplete") {
      where.onboardingStatus = { not: "COMPLETED" }
    }

    const rows = await partner.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { businessName: "asc" }],
    })
    return rows.map(mapPartner)
  } catch (err) {
    if (err instanceof Error && err.message === PARTNER_DELEGATE_UNAVAILABLE) throw err
    return []
  }
}

export async function getAllPartnersAdmin(filters?: {
  onboardingStatus?: PartnerOnboardingStatus
  onboardingFilter?: "incomplete" | "completed"
}): Promise<PartnerAdminRow[]> {
  const partners = await getAllPartners(
    filters?.onboardingStatus || filters?.onboardingFilter
      ? {
          onboardingStatus: filters.onboardingStatus,
          onboardingFilter: filters.onboardingFilter,
        }
      : undefined
  )

  const rows: PartnerAdminRow[] = []
  for (const p of partners) {
    const recommendationCount = await countPartnerRecommendations(p.id)
    rows.push({
      ...p,
      recommendationCount,
      activationScore: buildActivationForPartner(p, recommendationCount),
    })
  }
  return rows
}

export async function getActivePartnersList(): Promise<Partner[]> {
  return getAllPartners({ isActive: true })
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  try {
    const row = await getPartnerDelegate().findUnique({ where: { id } })
    return row ? mapPartner(row) : null
  } catch (err) {
    if (err instanceof Error && err.message === PARTNER_DELEGATE_UNAVAILABLE) throw err
    return null
  }
}

export async function getPartnerBySlug(slug: string): Promise<Partner | null> {
  try {
    const normalized = slug.trim().toLowerCase()
    const row = await getPartnerDelegate().findUnique({ where: { slug: normalized } })
    return row ? mapPartner(row) : null
  } catch (err) {
    if (err instanceof Error && err.message === PARTNER_DELEGATE_UNAVAILABLE) throw err
    return null
  }
}

export async function getPartnerOperationalMetrics(
  partnerId: string
): Promise<PartnerOperationalMetrics | null> {
  const partner = await getPartnerById(partnerId)
  if (!partner) return null

  const recommendedProfessionals = await countPartnerRecommendations(partnerId)

  return {
    recommendedProfessionals,
    activeConnections: recommendedProfessionals,
    activationScore: buildActivationForPartner(partner, recommendedProfessionals),
  }
}

export async function getPartnerOnboardingResult(
  partnerId: string
): Promise<PartnerOnboardingCompleteResult> {
  const partner = await getPartnerById(partnerId)
  if (!partner) throw new Error("Parceiro não encontrado")

  const recommendationCount = await countPartnerRecommendations(partnerId)
  const activationScore = buildActivationForPartner(partner, recommendationCount)

  return {
    partner,
    recommendationCount,
    activationScore,
    connectionsCreated: recommendationCount,
  }
}

export async function getPartnerPublicProfile(
  slug: string
): Promise<PartnerPublicProfile | null> {
  const partner = await getPartnerBySlug(slug)
  if (!partner || !partner.isActive) return null

  let recommendedProfessionals: PartnerRecommendedProfessional[] = []
  try {
    const connections = await prisma.trustConnection.findMany({
      where: {
        sourcePartnerId: partner.id,
        connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
        isActive: true,
      },
      include: {
        targetProfile: {
          select: {
            id: true,
            displayName: true,
            city: true,
            trustScore: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { weight: "desc" },
    })

    recommendedProfessionals = connections.map((c) => ({
      professionalId: c.targetProfile.id,
      displayName:    c.targetProfile.displayName,
      city:           c.targetProfile.city,
      trustScore:     c.targetProfile.trustScore,
      avatarUrl:      c.targetProfile.avatarUrl,
    }))
  } catch {
    try {
      const legacy = await prisma.trustConnection.findMany({
        where: {
          sourceId: partner.id,
          sourceType: "PARTNER",
          connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
          isActive: true,
        },
        include: {
          targetProfile: {
            select: {
              id: true,
              displayName: true,
              city: true,
              trustScore: true,
              avatarUrl: true,
            },
          },
        },
      })
      recommendedProfessionals = legacy.map((c) => ({
        professionalId: c.targetProfile.id,
        displayName:    c.targetProfile.displayName,
        city:           c.targetProfile.city,
        trustScore:     c.targetProfile.trustScore,
        avatarUrl:      c.targetProfile.avatarUrl,
      }))
    } catch {
      recommendedProfessionals = []
    }
  }

  const operationalMetrics = {
    recommendedProfessionals: recommendedProfessionals.length,
    activeConnections: recommendedProfessionals.length,
    activationScore: buildActivationForPartner(partner, recommendedProfessionals.length),
  }

  return { ...partner, recommendedProfessionals, operationalMetrics }
}

export async function getPartnerDashboardMetrics(): Promise<PartnerDashboardMetrics> {
  try {
    const partner = getPartnerDelegate()
    const [
      activePartners,
      verifiedPartners,
      professionalsRecommendedByPartners,
      onboardingInProgress,
      onboardingCompleted,
    ] = await Promise.all([
      partner.count({ where: { isActive: true } }),
      partner.count({ where: { isVerified: true, isActive: true } }),
      prisma.trustConnection.groupBy({
        by: ["targetId"],
        where: {
          connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
          isActive: true,
          OR: [
            { sourcePartnerId: { not: null } },
            { sourceType: "PARTNER" },
          ],
        },
      }).then((rows) => rows.length),
      partner.count({ where: { onboardingStatus: "IN_PROGRESS" } }),
      partner.count({ where: { onboardingStatus: "COMPLETED" } }),
    ])

    return {
      activePartners,
      verifiedPartners,
      professionalsRecommendedByPartners,
      onboardingInProgress,
      onboardingCompleted,
    }
  } catch {
    return {
      activePartners: 0,
      verifiedPartners: 0,
      professionalsRecommendedByPartners: 0,
      onboardingInProgress: 0,
      onboardingCompleted: 0,
    }
  }
}

export async function getProfessionalsForOnboarding(
  city?: string
): Promise<ProfessionalOnboardingOption[]> {
  try {
    const rows = await prisma.professionalProfile.findMany({
      where: {
        deletedAt: null,
        ...(city?.trim()
          ? { city: { equals: city.trim(), mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        city: true,
        trustScore: true,
        serviceTypes: true,
      },
      orderBy: [{ trustScore: "desc" }, { displayName: "asc" }],
      take: 50,
    })

    return rows.map((r) => ({
      id:           r.id,
      displayName:  r.displayName,
      city:         r.city,
      trustScore:   r.trustScore,
      serviceTypes: r.serviceTypes,
    }))
  } catch {
    return []
  }
}

// ── Escrita ───────────────────────────────────────────────────────────────────

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const partner = getPartnerDelegate()
  let slug = base
  let suffix = 1
  while (true) {
    const existing = await partner.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${suffix++}`
  }
}

export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  const partner = getPartnerDelegate()
  const baseSlug = input.slug?.trim() || generatePartnerSlug(input.businessName)
  const slug = await ensureUniqueSlug(baseSlug)

  const row = await partner.create({
    data: {
      businessName: input.businessName.trim(),
      slug,
      category:     input.category,
      city:         input.city.trim(),
      state:        input.state.trim(),
      description:  input.description?.trim() || null,
      phone:        input.phone?.trim() || null,
      website:      input.website?.trim() || null,
      instagram:    input.instagram?.trim() || null,
      logoUrl:      input.logoUrl?.trim() || null,
      isVerified:   input.isVerified ?? false,
      isActive:     true,
      onboardingStatus: "COMPLETED",
      onboardingCompletedAt: new Date(),
      verificationStatus:
        input.isVerified ? "VERIFIED" : "NONE",
    },
  })

  return mapPartner(row)
}

export async function createPartnerOnboarding(
  input: PartnerOnboardingBusinessInput
): Promise<Partner> {
  const partner = getPartnerDelegate()
  const baseSlug = generatePartnerSlug(input.businessName)
  const slug = await ensureUniqueSlug(baseSlug)

  const row = await partner.create({
    data: {
      businessName: input.businessName.trim(),
      slug,
      category:     input.category,
      city:         input.city.trim(),
      state:        input.state.trim(),
      description:  input.description?.trim() || null,
      phone:        input.phone.trim(),
      website:      input.website?.trim() || null,
      instagram:    input.instagram?.trim() || null,
      logoUrl:      input.logoUrl?.trim() || null,
      isVerified:   false,
      isActive:     false,
      onboardingStatus: "IN_PROGRESS",
      verificationStatus: "NONE",
    },
  })

  return mapPartner(row)
}

export async function updatePartnerOnboardingBusiness(
  partnerId: string,
  input: PartnerOnboardingBusinessInput
): Promise<Partner> {
  const partner = getPartnerDelegate()
  const row = await partner.update({
    where: { id: partnerId },
    data: {
      businessName: input.businessName.trim(),
      category:     input.category,
      city:         input.city.trim(),
      state:        input.state.trim(),
      description:  input.description?.trim() || null,
      phone:        input.phone.trim(),
      website:      input.website?.trim() || null,
      instagram:    input.instagram?.trim() || null,
      logoUrl:      input.logoUrl?.trim() || null,
      onboardingStatus: "IN_PROGRESS",
    },
  })
  return mapPartner(row)
}

export async function updatePartnerOnboardingTrust(
  input: PartnerOnboardingTrustInput
): Promise<Partner> {
  const partner = getPartnerDelegate()
  const now = new Date()

  const row = await partner.update({
    where: { id: input.partnerId },
    data: {
      yearsInBusiness: input.yearsInBusiness ?? null,
      hasCnpj: input.hasCnpj,
      ...(input.requestVerification
        ? {
            verificationStatus: "PENDING_VERIFICATION" as const,
            verificationRequestedAt: now,
          }
        : {}),
    },
  })

  return mapPartner(row)
}

export async function completePartnerOnboarding(partnerId: string): Promise<Partner> {
  const partner = getPartnerDelegate()
  const row = await partner.update({
    where: { id: partnerId },
    data: {
      isActive: true,
      onboardingStatus: "COMPLETED",
      onboardingCompletedAt: new Date(),
    },
  })
  return mapPartner(row)
}

export async function updatePartner(
  id: string,
  input: UpdatePartnerInput
): Promise<Partner> {
  const partner = getPartnerDelegate()
  const existing = await partner.findUnique({ where: { id } })
  if (!existing) throw new Error("Parceiro não encontrado")

  const data: Record<string, unknown> = {}

  if (input.businessName !== undefined) data.businessName = input.businessName.trim()
  if (input.category !== undefined)     data.category = input.category
  if (input.city !== undefined)         data.city = input.city.trim()
  if (input.state !== undefined)        data.state = input.state.trim()
  if (input.description !== undefined)  data.description = input.description?.trim() || null
  if (input.phone !== undefined)        data.phone = input.phone?.trim() || null
  if (input.website !== undefined)      data.website = input.website?.trim() || null
  if (input.instagram !== undefined)    data.instagram = input.instagram?.trim() || null
  if (input.logoUrl !== undefined)      data.logoUrl = input.logoUrl?.trim() || null
  if (input.isVerified !== undefined) {
    data.isVerified = input.isVerified
    data.verificationStatus = input.isVerified ? "VERIFIED" : existing.verificationStatus
  }

  if (input.slug !== undefined) {
    data.slug = await ensureUniqueSlug(
      input.slug.trim() || generatePartnerSlug(input.businessName ?? existing.businessName),
      id
    )
  }

  const row = await partner.update({ where: { id }, data })
  return mapPartner(row)
}

export async function setPartnerActive(id: string, isActive: boolean): Promise<void> {
  await getPartnerDelegate().update({ where: { id }, data: { isActive } })
}
