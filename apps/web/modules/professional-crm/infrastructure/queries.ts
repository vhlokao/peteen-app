/**
 * Módulo: professional-crm
 * Camada: infrastructure — leituras agregadas para o portal do profissional
 */

import { prisma } from "@/lib/prisma/client"
import { RELATIONSHIP_LEVEL_LABELS } from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"
import {
  SERVICE_TYPE_LABELS,
  TRUST_LEVEL_LABELS,
  type ServiceType,
  type TrustLevel,
} from "@/modules/professional/domain/types"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import { getProfessionalVerificationContext } from "../application/verification-context"
import { SUSPENDED_VERIFICATION_MESSAGE } from "../domain/verification-messages"
import type {
  ProfessionalActivityItem,
  ProfessionalActivityType,
  ProfessionalClientRow,
  ProfessionalDashboardStats,
  ProfessionalMetricsData,
  ProfessionalNextAction,
  ProfessionalPetRow,
  ProfessionalPortalData,
  ProfessionalReviewRow,
  ProfessionalReviewsData,
  ProfessionalVerificationStatus,
} from "../domain/types"

const IN_PROGRESS_STATUSES = ["ACCEPTED", "IN_PROGRESS"] as const

function activityLabel(type: ProfessionalActivityType): string {
  const labels: Record<ProfessionalActivityType, string> = {
    "request.received": "Nova solicitação recebida",
    "request.accepted": "Solicitação aceita",
    "service.completed": "Serviço concluído",
    "review.received": "Avaliação recebida",
    "recurrence.new": "Nova recorrência",
    "verification.approved": "Verificação aprovada",
    "verification.suspended": "Selo de verificação suspenso",
    "verification.pending": "Verificação em análise",
    "recommendation.received": "Recomendação recebida",
  }
  return labels[type]
}

export async function getProfessionalDashboardStats(
  professionalId: string,
  trustScore: number
): Promise<ProfessionalDashboardStats> {
  const [
    receivedRequests,
    inProgressRequests,
    completedServices,
    uniqueClients,
    petsAttended,
    reviewsReceived,
  ] = await Promise.all([
    prisma.serviceRequest.count({ where: { professionalId } }),
    prisma.serviceRequest.count({
      where: { professionalId, status: { in: [...IN_PROGRESS_STATUSES] } },
    }),
    prisma.serviceRequest.count({
      where: { professionalId, status: "COMPLETED" },
    }),
    prisma.tutorProfessionalRelationship.count({
      where: { professionalId, completedServices: { gt: 0 } },
    }),
    prisma.serviceRequest.groupBy({
      by: ["petId"],
      where: {
        professionalId,
        status: "COMPLETED",
        petId: { not: null },
      },
    }),
    prisma.review.count({
      where: {
        request: { professionalId },
        isVisible: true,
        hiddenByAdmin: false,
      },
    }),
  ])

  return {
    receivedRequests,
    inProgressRequests,
    completedServices,
    uniqueClients,
    petsAttended: petsAttended.filter((g) => g.petId != null).length,
    reviewsReceived,
    trustScore,
  }
}

export async function findRecentProfessionalActivity(
  professionalId: string,
  profile: { isVerified: boolean; verifiedIdentity: boolean },
  limit = 10
): Promise<ProfessionalActivityItem[]> {
  const seloAtivo = isProfessionalVerificationActive(profile)

  const [requests, reviews, relationships, verifications, pendingVerifications, recommendations] =
    await Promise.all([
      prisma.serviceRequest.findMany({
        where: { professionalId },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          serviceType: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          tutor: { select: { displayName: true } },
        },
      }),
      prisma.review.findMany({
        where: {
          request: { professionalId },
          isVisible: true,
          hiddenByAdmin: false,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          rating: true,
          createdAt: true,
          requestId: true,
          tutor: { select: { displayName: true } },
        },
      }),
      prisma.tutorProfessionalRelationship.findMany({
        where: { professionalId, completedServices: { gte: 2 } },
        orderBy: { lastServiceAt: "desc" },
        take: 5,
        select: {
          id: true,
          completedServices: true,
          lastServiceAt: true,
          tutor: { select: { displayName: true } },
        },
      }),
      prisma.verificationRequest.findMany({
        where: {
          entityType: "PROFESSIONAL",
          entityId: professionalId,
          status: "APPROVED",
          reviewedAt: { not: null },
        },
        orderBy: { reviewedAt: "desc" },
        take: 3,
        select: { id: true, reviewedAt: true },
      }),
      prisma.verificationRequest.findMany({
        where: {
          entityType: "PROFESSIONAL",
          entityId: professionalId,
          status: "PENDING",
        },
        orderBy: { requestedAt: "desc" },
        take: 3,
        select: { id: true, requestedAt: true },
      }),
      prisma.trustConnection.findMany({
        where: { targetId: professionalId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          sourceName: true,
          connectionType: true,
          createdAt: true,
        },
      }),
    ])

  const items: ProfessionalActivityItem[] = []

  for (const req of requests) {
    const serviceLabel =
      SERVICE_TYPE_LABELS[req.serviceType as ServiceType] ?? req.serviceType
    const tutorName = req.tutor.displayName

    items.push({
      id: `req-received-${req.id}`,
      type: "request.received",
      title: activityLabel("request.received"),
      description: `${serviceLabel} · ${tutorName}`,
      occurredAt: req.createdAt,
      href: `/requests/${req.id}`,
    })

    if (
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(req.status) &&
      req.updatedAt.getTime() > req.createdAt.getTime() + 1000
    ) {
      items.push({
        id: `req-accepted-${req.id}`,
        type: "request.accepted",
        title: activityLabel("request.accepted"),
        description: `${serviceLabel} · ${tutorName}`,
        occurredAt: req.updatedAt,
        href: `/requests/${req.id}`,
      })
    }

    if (req.status === "COMPLETED" && req.completedAt) {
      items.push({
        id: `req-completed-${req.id}`,
        type: "service.completed",
        title: activityLabel("service.completed"),
        description: `${serviceLabel} · ${tutorName}`,
        occurredAt: req.completedAt,
        href: `/requests/${req.id}`,
      })
    }
  }

  for (const review of reviews) {
    items.push({
      id: `review-${review.id}`,
      type: "review.received",
      title: activityLabel("review.received"),
      description: `${review.rating}★ · ${review.tutor.displayName}`,
      occurredAt: review.createdAt,
      href: `/professional/reviews`,
    })
  }

  for (const rel of relationships) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `recurrence-${rel.id}`,
      type: "recurrence.new",
      title: activityLabel("recurrence.new"),
      description: `${rel.tutor.displayName} · ${rel.completedServices} atendimentos`,
      occurredAt: rel.lastServiceAt,
      href: `/professional/clients`,
    })
  }

  for (const ver of verifications) {
    if (!ver.reviewedAt) continue
    if (seloAtivo) {
      items.push({
        id: `verification-${ver.id}`,
        type: "verification.approved",
        title: activityLabel("verification.approved"),
        description: "Seu perfil foi verificado pela equipe Peteen",
        occurredAt: ver.reviewedAt,
        href: `/professional/metricas`,
      })
    } else {
      items.push({
        id: `verification-suspended-${ver.id}`,
        type: "verification.suspended",
        title: activityLabel("verification.suspended"),
        description: SUSPENDED_VERIFICATION_MESSAGE,
        occurredAt: ver.reviewedAt,
        href: `/professional/metricas`,
      })
    }
  }

  for (const pending of pendingVerifications) {
    items.push({
      id: `verification-pending-${pending.id}`,
      type: "verification.pending",
      title: activityLabel("verification.pending"),
      description: "Aguardando análise da equipe Peteen",
      occurredAt: pending.requestedAt,
      href: `/professional/metricas`,
    })
  }

  for (const rec of recommendations) {
    items.push({
      id: `recommendation-${rec.id}`,
      type: "recommendation.received",
      title: activityLabel("recommendation.received"),
      description: `${rec.sourceName} · ${rec.connectionType}`,
      occurredAt: rec.createdAt,
      href: `/professional/metricas`,
    })
  }

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit)
}

export function buildProfessionalNextActions(input: {
  stats: ProfessionalDashboardStats
  operationalStatus: ProfessionalVerificationStatus
  recommendationsReceived: number
  recurringClients: number
}): ProfessionalNextAction[] {
  const actions: ProfessionalNextAction[] = []

  if (input.operationalStatus === "not_verified") {
    actions.push({
      id: "verify",
      label: "Solicitar verificação",
      description: "Perfis verificados convertem mais e aparecem com selo de confiança.",
      href: "/professional/metricas",
      variant: "default",
    })
  }

  if (input.operationalStatus === "suspended") {
    actions.push({
      id: "reactivate-verification",
      label: "Regularizar verificação",
      description: SUSPENDED_VERIFICATION_MESSAGE,
      href: "/professional/metricas",
      variant: "default",
    })
  }

  if (input.recommendationsReceived === 0) {
    actions.push({
      id: "recommendation",
      label: "Conseguir primeira recomendação",
      description: "Recomendações de parceiros e tutores aumentam sua visibilidade.",
      href: "/professional/metricas",
      variant: input.operationalStatus === "verified" ? "default" : "outline",
    })
  }

  if (input.stats.reviewsReceived < 3) {
    actions.push({
      id: "reviews",
      label: "Pedir avaliações",
      description:
        input.stats.reviewsReceived === 0
          ? "Nenhuma review ainda — peça feedback após concluir atendimentos."
          : `${input.stats.reviewsReceived} review${input.stats.reviewsReceived !== 1 ? "s" : ""} — mais avaliações fortalecem sua reputação.`,
      href: "/requests",
      variant: "outline",
    })
  }

  if (input.recurringClients === 0 && input.stats.completedServices > 0) {
    actions.push({
      id: "recurrence",
      label: "Buscar clientes recorrentes",
      description: "Clientes que retornam são o principal driver de confiança.",
      href: "/professional/clients",
      variant: "outline",
    })
  }

  if (input.stats.trustScore < 50) {
    actions.push({
      id: "trust",
      label: "Melhorar reputação",
      description: `Índice de Confiança atual: ${Math.round(input.stats.trustScore)} — conclua serviços com qualidade e consistência.`,
      href: "/professional/metricas",
      variant: "outline",
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: "metrics",
      label: "Acompanhar métricas",
      description: "Monitore sua evolução reputacional e oportunidades de crescimento.",
      href: "/professional/metricas",
      variant: "outline",
    })
  }

  return actions
}

export async function getProfessionalPortalData(
  professionalId: string,
  trustScore: number,
  profile: { isVerified: boolean; verifiedIdentity: boolean }
): Promise<ProfessionalPortalData> {
  const verification = await getProfessionalVerificationContext(professionalId, profile)

  const [stats, recentActivity, recommendationsReceived, recurringClients] =
    await Promise.all([
      getProfessionalDashboardStats(professionalId, trustScore),
      findRecentProfessionalActivity(professionalId, profile, 10),
      prisma.trustConnection.count({
        where: { targetId: professionalId, isActive: true },
      }),
      prisma.tutorProfessionalRelationship.count({
        where: { professionalId, completedServices: { gte: 2 } },
      }),
    ])

  const nextActions = buildProfessionalNextActions({
    stats,
    operationalStatus: verification.operationalStatus,
    recommendationsReceived,
    recurringClients,
  })

  return { stats, recentActivity, nextActions }
}

export async function findProfessionalClients(
  professionalId: string
): Promise<ProfessionalClientRow[]> {
  const relationships = await prisma.tutorProfessionalRelationship.findMany({
    where: { professionalId, completedServices: { gt: 0 } },
    orderBy: { lastServiceAt: "desc" },
    select: {
      tutorId: true,
      completedServices: true,
      lastServiceAt: true,
      relationshipLevel: true,
      tutor: {
        select: { displayName: true, city: true },
      },
    },
  })

  if (relationships.length === 0) return []

  const tutorIds = relationships.map((r) => r.tutorId)

  const petRows = await prisma.serviceRequest.findMany({
    where: {
      professionalId,
      tutorId: { in: tutorIds },
      status: "COMPLETED",
      petId: { not: null },
    },
    select: {
      tutorId: true,
      pet: { select: { name: true } },
    },
  })

  const petsByTutor = new Map<string, Set<string>>()
  for (const row of petRows) {
    if (!row.pet) continue
    const set = petsByTutor.get(row.tutorId) ?? new Set()
    set.add(row.pet.name)
    petsByTutor.set(row.tutorId, set)
  }

  return relationships.map((rel) => {
    const level = rel.relationshipLevel as RelationshipLevel
    return {
      tutorId: rel.tutorId,
      tutorName: rel.tutor.displayName,
      city: rel.tutor.city,
      totalServices: rel.completedServices,
      lastServiceAt: rel.lastServiceAt,
      petNames: Array.from(petsByTutor.get(rel.tutorId) ?? []),
      relationshipLevel: level,
      relationshipLevelLabel: RELATIONSHIP_LEVEL_LABELS[level] ?? level,
    }
  })
}

export async function findProfessionalPetsAttended(
  professionalId: string
): Promise<ProfessionalPetRow[]> {
  const rows = await prisma.serviceRequest.findMany({
    where: {
      professionalId,
      status: "COMPLETED",
      petId: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: {
      petId: true,
      completedAt: true,
      tutorId: true,
      pet: { select: { id: true, name: true, species: true } },
      tutor: { select: { displayName: true } },
    },
  })

  const byPet = new Map<string, ProfessionalPetRow>()

  for (const row of rows) {
    if (!row.petId || !row.pet) continue
    const completedAt = row.completedAt ?? new Date()
    const existing = byPet.get(row.petId)

    if (!existing) {
      byPet.set(row.petId, {
        petId: row.pet.id,
        petName: row.pet.name,
        species: row.pet.species,
        tutorId: row.tutorId,
        tutorName: row.tutor.displayName,
        attendanceCount: 1,
        lastServiceAt: completedAt,
      })
      continue
    }

    existing.attendanceCount += 1
  }

  return Array.from(byPet.values()).sort(
    (a, b) => (b.lastServiceAt?.getTime() ?? 0) - (a.lastServiceAt?.getTime() ?? 0)
  )
}

export async function getProfessionalReviewsData(
  professionalId: string
): Promise<ProfessionalReviewsData> {
  const reviews = await prisma.review.findMany({
    where: {
      request: { professionalId },
      isVisible: true,
      hiddenByAdmin: false,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      requestId: true,
      tutor: { select: { id: true, displayName: true } },
      request: {
        select: {
          serviceType: true,
          pet: { select: { name: true } },
        },
      },
    },
  })

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }

  let ratingSum = 0
  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, review.rating)) as 1 | 2 | 3 | 4 | 5
    distribution[star] += 1
    ratingSum += review.rating
  }

  const reviewRows: ProfessionalReviewRow[] = reviews.map((r) => ({
    id: r.id,
    tutorId: r.tutor.id,
    tutorName: r.tutor.displayName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    requestId: r.requestId,
    serviceType: r.request?.serviceType ?? null,
    petName: r.request?.pet?.name ?? null,
  }))

  return {
    averageRating:
      reviews.length > 0 ? Math.round((ratingSum / reviews.length) * 10) / 10 : null,
    totalReviews: reviews.length,
    distribution,
    reviews: reviewRows,
  }
}

export async function getProfessionalMetricsData(
  professionalId: string,
  profile: {
    trustScore: number
    trustLevel: TrustLevel
    isVerified: boolean
    verifiedIdentity: boolean
  }
): Promise<ProfessionalMetricsData> {
  const [baseStats, recommendationsReceived, recurringClients, verification] =
    await Promise.all([
      getProfessionalDashboardStats(professionalId, profile.trustScore),
      prisma.trustConnection.count({
        where: { targetId: professionalId, isActive: true },
      }),
      prisma.tutorProfessionalRelationship.count({
        where: { professionalId, completedServices: { gte: 2 } },
      }),
      getProfessionalVerificationContext(professionalId, profile),
    ])

  return {
    stats: {
      ...baseStats,
      recommendationsReceived,
      recurringClients,
      verificationStatus: verification.operationalStatus,
    },
    trustLevel: profile.trustLevel,
    trustLevelLabel: TRUST_LEVEL_LABELS[profile.trustLevel],
  }
}
