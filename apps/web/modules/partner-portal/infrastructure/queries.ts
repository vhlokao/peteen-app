/**
 * Módulo: partner-portal
 * Camada: infrastructure — leituras agregadas para o portal do parceiro
 */

import { prisma } from "@/lib/prisma/client"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import {
  buildDiscoverUrl,
  buildPartnerPublicUrl,
} from "@/modules/partner-portal/domain/navigation"
import { RELATIONSHIP_LEVEL_THRESHOLDS } from "@/modules/relationship/domain/constants"
import type { Partner } from "@/modules/partners/domain/types"
import type {
  PartnerActivityItem,
  PartnerActivityType,
  PartnerDashboardStats,
  PartnerMetricsData,
  PartnerNextAction,
  PartnerPortalData,
  PartnerRecommendationGroup,
  PartnerRecommendationRow,
  ProfessionalSearchResult,
} from "../domain/types"
import { toPartnerPortalProfile } from "./repository"

const RECURRING_THRESHOLD = RELATIONSHIP_LEVEL_THRESHOLDS.RECURRING

function partnerConnectionsWhere(partnerId: string) {
  return {
    connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL" as const,
    OR: [
      { sourcePartnerId: partnerId },
      { sourceId: partnerId, sourceType: "PARTNER" as const },
    ],
  }
}

function activityLabel(type: PartnerActivityType): string {
  const labels: Record<PartnerActivityType, string> = {
    "recommendation.created": "Profissional recomendado",
    "recommendation.removed": "Recomendação removida",
    "verification.approved": "Verificação aprovada",
    "connection.active": "Nova conexão ativa",
    "professional.recurring": "Profissional indicado tornou-se recorrente",
  }
  return labels[type]
}

function formatSpecialty(serviceTypes: string[]): string {
  if (serviceTypes.length === 0) return "—"
  const labels = serviceTypes
    .slice(0, 2)
    .map((t) => SERVICE_TYPE_LABELS[t as ServiceType] ?? t)
  const extra = serviceTypes.length > 2 ? ` +${serviceTypes.length - 2}` : ""
  return labels.join(", ") + extra
}

export async function getPartnerDashboardStats(
  partnerId: string,
  verificationStatus: Partner["verificationStatus"]
): Promise<PartnerDashboardStats> {
  const baseWhere = partnerConnectionsWhere(partnerId)

  const [
    trustConnectionsGenerated,
    activeRecommendations,
    verifiedRecommended,
    activeConnections,
  ] = await Promise.all([
    prisma.trustConnection.count({ where: baseWhere }),
    prisma.trustConnection.count({ where: { ...baseWhere, isActive: true } }),
    prisma.trustConnection.count({
      where: {
        ...baseWhere,
        isActive: true,
        targetProfile: { isVerified: true },
      },
    }),
    prisma.trustConnection.count({ where: { ...baseWhere, isActive: true } }),
  ])

  const recommendedProfessionals = await prisma.trustConnection.groupBy({
    by: ["targetId"],
    where: baseWhere,
  })

  return {
    recommendedProfessionals: recommendedProfessionals.length,
    activeRecommendations,
    verifiedRecommended,
    activeConnections,
    trustConnectionsGenerated,
    verificationStatus,
  }
}

export async function getPartnerMetricsData(
  partnerId: string,
  partner: Partner
): Promise<PartnerMetricsData> {
  const baseWhere = partnerConnectionsWhere(partnerId)

  const [
    totalRecommendations,
    activeRecommendations,
    verifiedRecommended,
    activeConnections,
    connectionTargets,
  ] = await Promise.all([
    prisma.trustConnection.count({ where: baseWhere }),
    prisma.trustConnection.count({ where: { ...baseWhere, isActive: true } }),
    prisma.trustConnection.count({
      where: {
        ...baseWhere,
        isActive: true,
        targetProfile: { isVerified: true },
      },
    }),
    prisma.trustConnection.count({ where: { ...baseWhere, isActive: true } }),
    prisma.trustConnection.findMany({
      where: baseWhere,
      select: { targetId: true },
      distinct: ["targetId"],
    }),
  ])

  const professionalIds = connectionTargets.map((c) => c.targetId)
  let recurringRecommended = 0

  if (professionalIds.length > 0) {
    const recurring = await prisma.tutorProfessionalRelationship.groupBy({
      by: ["professionalId"],
      where: {
        professionalId: { in: professionalIds },
        completedServices: { gte: RECURRING_THRESHOLD },
      },
    })
    recurringRecommended = recurring.length
  }

  return {
    totalRecommendations,
    activeRecommendations,
    verifiedRecommended,
    recurringRecommended,
    activeConnections,
    verificationStatus: partner.verificationStatus,
    isVerified: partner.isVerified,
  }
}

export async function findRecentPartnerActivity(
  partnerId: string,
  partnerSlug: string,
  limit = 10
): Promise<PartnerActivityItem[]> {
  const baseWhere = partnerConnectionsWhere(partnerId)

  const [connections, verifications, recurringRels] = await Promise.all([
    prisma.trustConnection.findMany({
      where: baseWhere,
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        targetId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        targetProfile: {
          select: { displayName: true },
        },
      },
    }),
    prisma.verificationRequest.findMany({
      where: {
        entityType: "PARTNER",
        entityId: partnerId,
        status: "APPROVED",
        reviewedAt: { not: null },
      },
      orderBy: { reviewedAt: "desc" },
      take: 5,
      select: { id: true, reviewedAt: true },
    }),
    prisma.trustConnection.findMany({
      where: { ...baseWhere, isActive: true },
      select: { targetId: true },
      distinct: ["targetId"],
    }).then(async (targets) => {
      const ids = targets.map((t) => t.targetId)
      if (ids.length === 0) return []
      return prisma.tutorProfessionalRelationship.findMany({
        where: {
          professionalId: { in: ids },
          completedServices: { gte: RECURRING_THRESHOLD },
        },
        orderBy: { lastServiceAt: "desc" },
        take: 10,
        select: {
          id: true,
          professionalId: true,
          completedServices: true,
          lastServiceAt: true,
          professional: { select: { displayName: true } },
        },
      })
    }),
  ])

  const items: PartnerActivityItem[] = []

  for (const conn of connections) {
    const name = conn.targetProfile.displayName

    items.push({
      id: `rec-created-${conn.id}`,
      type: "recommendation.created",
      title: activityLabel("recommendation.created"),
      description: name,
      occurredAt: conn.createdAt,
      href: buildDiscoverUrl(conn.targetId, { from: "partner", returnTo: "/partner" }),
    })

    if (
      conn.isActive &&
      conn.updatedAt.getTime() > conn.createdAt.getTime() + 1000
    ) {
      items.push({
        id: `conn-active-${conn.id}`,
        type: "connection.active",
        title: activityLabel("connection.active"),
        description: name,
        occurredAt: conn.updatedAt,
        href: buildDiscoverUrl(conn.targetId, { from: "partner", returnTo: "/partner" }),
      })
    } else if (!conn.isActive && conn.updatedAt.getTime() > conn.createdAt.getTime() + 1000) {
      items.push({
        id: `rec-removed-${conn.id}`,
        type: "recommendation.removed",
        title: activityLabel("recommendation.removed"),
        description: name,
        occurredAt: conn.updatedAt,
        href: buildDiscoverUrl(conn.targetId, { from: "partner", returnTo: "/partner" }),
      })
    }
  }

  for (const ver of verifications) {
    if (!ver.reviewedAt) continue
    items.push({
      id: `verification-${ver.id}`,
      type: "verification.approved",
      title: activityLabel("verification.approved"),
      description: "Sua organização foi verificada pela equipe Peteen",
      occurredAt: ver.reviewedAt,
      href: buildPartnerPublicUrl(partnerSlug, "/partner"),
    })
  }

  for (const rel of recurringRels) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `recurring-${rel.id}`,
      type: "professional.recurring",
      title: activityLabel("professional.recurring"),
      description: `${rel.professional.displayName} · ${rel.completedServices} atendimentos concluídos`,
      occurredAt: rel.lastServiceAt,
      href: buildDiscoverUrl(rel.professionalId, { from: "partner", returnTo: "/partner" }),
    })
  }

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit)
}

export function buildPartnerNextActions(input: {
  stats: PartnerDashboardStats
  recurringRecommended: number
}): PartnerNextAction[] {
  const actions: PartnerNextAction[] = []

  if (input.stats.verificationStatus === "NONE") {
    actions.push({
      id: "verify",
      label: "Solicitar verificação",
      description:
        "Organizações verificadas transmitem mais confiança na rede Peteen.",
      href: "/partner/profile",
      variant: "default",
    })
  }

  if (input.stats.recommendedProfessionals === 0) {
    actions.push({
      id: "first-recommendation",
      label: "Fazer primeira recomendação",
      description:
        "Indique profissionais confiáveis para fortalecer sua presença na rede.",
      href: "/partner/recommendations",
      variant: "default",
    })
  }

  if (input.stats.activeConnections < 3 && input.stats.recommendedProfessionals > 0) {
    actions.push({
      id: "expand-network",
      label: "Expandir sua rede",
      description: `Você tem ${input.stats.activeConnections} conexão${input.stats.activeConnections !== 1 ? "ões" : ""} ativa${input.stats.activeConnections !== 1 ? "s" : ""} — indique mais profissionais.`,
      href: "/partner/recommendations",
      variant: "outline",
    })
  }

  if (
    input.stats.recommendedProfessionals > 0 &&
    input.recurringRecommended === 0
  ) {
    actions.push({
      id: "track-recommended",
      label: "Acompanhar profissionais indicados",
      description:
        "Veja como os profissionais que você indicou estão evoluindo na rede.",
      href: "/partner/recommendations",
      variant: "outline",
    })
  }

  return actions.slice(0, 4)
}

export async function getPartnerRecommendationGroups(
  partnerId: string
): Promise<PartnerRecommendationGroup[]> {
  const connections = await prisma.trustConnection.findMany({
    where: partnerConnectionsWhere(partnerId),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetId: true,
      isActive: true,
      createdAt: true,
      targetProfile: {
        select: {
          id: true,
          displayName: true,
          city: true,
          serviceTypes: true,
        },
      },
    },
  })

  const grouped = new Map<string, PartnerRecommendationGroup>()

  for (const conn of connections) {
    const prof = conn.targetProfile
    const existing = grouped.get(prof.id)

    const entry = {
      connectionId: conn.id,
      recommendedAt: conn.createdAt,
      isActive: conn.isActive,
      statusLabel: conn.isActive ? "Ativa" : "Inativa",
    }

    if (existing) {
      existing.recommendations.push(entry)
      if (conn.isActive) existing.isConnectionActive = true
    } else {
      grouped.set(prof.id, {
        professionalId: prof.id,
        displayName: prof.displayName,
        city: prof.city,
        specialty: formatSpecialty(prof.serviceTypes),
        publicProfileHref: `/discover/${prof.id}`,
        isConnectionActive: conn.isActive,
        recommendations: [entry],
      })
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const aDate = a.recommendations[0]?.recommendedAt.getTime() ?? 0
    const bDate = b.recommendations[0]?.recommendedAt.getTime() ?? 0
    return bDate - aDate
  })
}

export async function getPartnerRecommendations(
  partnerId: string
): Promise<PartnerRecommendationRow[]> {
  const connections = await prisma.trustConnection.findMany({
    where: partnerConnectionsWhere(partnerId),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetId: true,
      isActive: true,
      createdAt: true,
      targetProfile: {
        select: {
          id: true,
          displayName: true,
          city: true,
          serviceTypes: true,
        },
      },
    },
  })

  return connections.map((conn) => ({
    connectionId: conn.id,
    professionalId: conn.targetProfile.id,
    displayName: conn.targetProfile.displayName,
    city: conn.targetProfile.city,
    specialty: formatSpecialty(conn.targetProfile.serviceTypes),
    isActive: conn.isActive,
    statusLabel: conn.isActive ? "Ativa" : "Inativa",
    recommendedAt: conn.createdAt,
    publicProfileHref: `/discover/${conn.targetProfile.id}`,
  }))
}

export async function findPartnerRecommendationById(
  connectionId: string,
  partnerId: string
) {
  return prisma.trustConnection.findFirst({
    where: {
      id: connectionId,
      ...partnerConnectionsWhere(partnerId),
    },
    select: {
      id: true,
      targetId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      connectionType: true,
      sourcePartnerId: true,
      targetProfile: {
        select: {
          id: true,
          displayName: true,
          city: true,
        },
      },
    },
  })
}

export async function findPartnerRecommendationForProfessional(
  partnerId: string,
  professionalId: string
) {
  return prisma.trustConnection.findFirst({
    where: {
      targetId: professionalId,
      ...partnerConnectionsWhere(partnerId),
    },
    select: { id: true, isActive: true },
  })
}

export async function searchProfessionalsForPartnerRecommendation(
  partnerId: string,
  filters: { name?: string; city?: string }
): Promise<ProfessionalSearchResult[]> {
  const name = filters.name?.trim()
  const city = filters.city?.trim()

  if (!name && !city) return []

  const existing = await prisma.trustConnection.findMany({
    where: partnerConnectionsWhere(partnerId),
    select: { targetId: true },
  })
  const excludedIds = existing.map((c) => c.targetId)

  const rows = await prisma.professionalProfile.findMany({
    where: {
      deletedAt: null,
      id: excludedIds.length > 0 ? { notIn: excludedIds } : undefined,
      ...(name
        ? { displayName: { contains: name, mode: "insensitive" } }
        : {}),
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      displayName: true,
      city: true,
      trustScore: true,
      serviceTypes: true,
    },
    orderBy: [{ trustScore: "desc" }, { displayName: "asc" }],
    take: 20,
  })

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    city: r.city,
    specialty: formatSpecialty(r.serviceTypes),
    trustScore: r.trustScore,
  }))
}

export async function findProfessionalForRecommendation(professionalId: string) {
  return prisma.professionalProfile.findFirst({
    where: { id: professionalId, deletedAt: null },
    select: { id: true, displayName: true, city: true },
  })
}

export async function getPartnerPortalData(partner: Partner): Promise<PartnerPortalData> {
  const stats = await getPartnerDashboardStats(partner.id, partner.verificationStatus)
  const metrics = await getPartnerMetricsData(partner.id, partner)

  const [recentActivity, nextActions] = await Promise.all([
    findRecentPartnerActivity(partner.id, partner.slug),
    Promise.resolve(
      buildPartnerNextActions({
        stats,
        recurringRecommended: metrics.recurringRecommended,
      })
    ),
  ])

  return {
    partner: toPartnerPortalProfile(partner),
    stats,
    recentActivity,
    nextActions,
  }
}
