/**
 * Módulo: tutor-portal
 * Camada: infrastructure — leituras agregadas para o portal do tutor
 */

import { prisma } from "@/lib/prisma/client"
import type { ServiceType } from "@/modules/professional/domain/types"
import { countActivePetsByTutorId } from "@/modules/pets/infrastructure/repository"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import type {
  HiredProfessionalSummary,
  TutorActivityItem,
  TutorActivityType,
  TutorDashboardStats,
  TutorNextAction,
  TutorPortalData,
} from "../domain/types"

const OPEN_STATUSES = ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const

export async function getTutorDashboardStats(
  tutorId: string
): Promise<TutorDashboardStats> {
  const [
    activePets,
    openRequests,
    completedRequests,
    totalRequests,
    reviewsGiven,
    pendingReviews,
    hiredProfessionals,
  ] = await Promise.all([
    countActivePetsByTutorId(tutorId),
    prisma.serviceRequest.count({
      where: { tutorId, status: { in: [...OPEN_STATUSES] } },
    }),
    prisma.serviceRequest.count({
      where: { tutorId, status: "COMPLETED" },
    }),
    prisma.serviceRequest.count({ where: { tutorId } }),
    prisma.review.count({ where: { tutorId } }),
    prisma.serviceRequest.count({
      where: { tutorId, status: "COMPLETED", review: null },
    }),
    prisma.serviceRequest.groupBy({
      by: ["professionalId"],
      where: { tutorId, status: "COMPLETED" },
    }),
  ])

  return {
    activePets,
    openRequests,
    completedRequests,
    hiredProfessionals: hiredProfessionals.length,
    reviewsGiven,
    totalRequests,
    pendingReviews,
  }
}

export async function findFirstPendingReviewRequestId(
  tutorId: string
): Promise<string | null> {
  const request = await prisma.serviceRequest.findFirst({
    where: { tutorId, status: "COMPLETED", review: null },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  })
  return request?.id ?? null
}

export async function findHiredProfessionalsByTutorId(
  tutorId: string
): Promise<HiredProfessionalSummary[]> {
  const rows = await prisma.serviceRequest.findMany({
    where: { tutorId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: {
      professionalId: true,
      serviceType: true,
      completedAt: true,
      professional: {
        select: {
          id: true,
          displayName: true,
          city: true,
          avatarUrl: true,
        },
      },
    },
  })

  const byProfessional = new Map<string, HiredProfessionalSummary>()

  for (const row of rows) {
    const completedAt = row.completedAt ?? new Date()
    const existing = byProfessional.get(row.professionalId)

    if (!existing) {
      byProfessional.set(row.professionalId, {
        professionalId: row.professionalId,
        displayName: row.professional.displayName,
        city: row.professional.city,
        avatarUrl: row.professional.avatarUrl,
        lastServiceType: row.serviceType as ServiceType,
        totalServices: 1,
        lastHiredAt: completedAt,
      })
      continue
    }

    existing.totalServices += 1
  }

  return Array.from(byProfessional.values()).sort(
    (a, b) => b.lastHiredAt.getTime() - a.lastHiredAt.getTime()
  )
}

function activityLabel(type: TutorActivityType): string {
  const labels: Record<TutorActivityType, string> = {
    "pet.created": "Pet cadastrado",
    "request.created": "Solicitação enviada",
    "request.accepted": "Solicitação aceita",
    "request.completed": "Serviço concluído",
    "review.created": "Avaliação enviada",
  }
  return labels[type]
}

export async function findRecentTutorActivity(
  tutorId: string,
  limit = 10
): Promise<TutorActivityItem[]> {
  const [pets, requests, reviews] = await Promise.all([
    prisma.pet.findMany({
      where: { tutorId, deletedAt: null, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.serviceRequest.findMany({
      where: { tutorId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        status: true,
        serviceType: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        professional: { select: { displayName: true } },
      },
    }),
    prisma.review.findMany({
      where: { tutorId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestId: true,
        createdAt: true,
        request: {
          select: {
            professional: { select: { displayName: true } },
          },
        },
      },
    }),
  ])

  const items: TutorActivityItem[] = []

  for (const pet of pets) {
    items.push({
      id: `pet-${pet.id}`,
      type: "pet.created",
      title: activityLabel("pet.created"),
      description: pet.name,
      occurredAt: pet.createdAt,
      href: `/me/pets/${pet.id}`,
    })
  }

  for (const req of requests) {
    const serviceLabel =
      SERVICE_TYPE_LABELS[req.serviceType as ServiceType] ?? req.serviceType
    const proName = req.professional.displayName

    items.push({
      id: `req-created-${req.id}`,
      type: "request.created",
      title: activityLabel("request.created"),
      description: `${serviceLabel} · ${proName}`,
      occurredAt: req.createdAt,
      href: `/tutor/requests/${req.id}`,
    })

    if (
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(req.status) &&
      req.updatedAt.getTime() > req.createdAt.getTime() + 1000
    ) {
      items.push({
        id: `req-accepted-${req.id}`,
        type: "request.accepted",
        title: activityLabel("request.accepted"),
        description: `${proName} aceitou ${serviceLabel.toLowerCase()}`,
        occurredAt: req.updatedAt,
        href: `/tutor/requests/${req.id}`,
      })
    }

    if (req.status === "COMPLETED" && req.completedAt) {
      items.push({
        id: `req-completed-${req.id}`,
        type: "request.completed",
        title: activityLabel("request.completed"),
        description: `${serviceLabel} com ${proName}`,
        occurredAt: req.completedAt,
        href: `/tutor/requests/${req.id}`,
      })
    }
  }

  for (const review of reviews) {
    items.push({
      id: `review-${review.id}`,
      type: "review.created",
      title: activityLabel("review.created"),
      description: review.request.professional.displayName,
      occurredAt: review.createdAt,
      href: `/tutor/requests/${review.requestId}`,
    })
  }

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit)
}

export function buildNextActions(
  stats: TutorDashboardStats,
  firstPendingReviewRequestId: string | null,
  hiredProfessionals: HiredProfessionalSummary[]
): TutorNextAction[] {
  const actions: TutorNextAction[] = []

  if (stats.activePets === 0) {
    actions.push({
      id: "add-pet",
      label: "Cadastrar primeiro pet",
      description: "Pets dão contexto para recomendações e solicitações.",
      href: "/me/pets/new",
      variant: "default",
    })
  }

  if (stats.activePets > 0 && stats.totalRequests === 0) {
    actions.push({
      id: "discover",
      label: "Encontrar profissional",
      description: "Busque profissionais confiáveis no seu bairro.",
      href: "/discover",
      variant: stats.activePets === 0 ? "outline" : "default",
    })
  }

  if (stats.pendingReviews > 0 && firstPendingReviewRequestId) {
    actions.push({
      id: "review",
      label: "Avaliar atendimento",
      description: `${stats.pendingReviews} atendimento${stats.pendingReviews !== 1 ? "s" : ""} aguardando sua avaliação.`,
      href: `/tutor/requests/${firstPendingReviewRequestId}`,
      variant: "default",
    })
  }

  if (hiredProfessionals.length > 0) {
    const top = hiredProfessionals[0]!
    actions.push({
      id: "rehire",
      label: "Contratar novamente",
      description: `Último profissional: ${top.displayName}`,
      href: `/discover/${top.professionalId}`,
      variant: "outline",
    })
  }

  if (actions.length === 0) {
    actions.push({
      id: "browse",
      label: "Explorar profissionais",
      description: "Descubra quem atende na sua região.",
      href: "/discover",
      variant: "outline",
    })
  }

  return actions
}

export async function getTutorPortalData(
  tutorId: string
): Promise<TutorPortalData> {
  const [stats, hiredProfessionals, firstPendingReviewRequestId, recentActivity] =
    await Promise.all([
      getTutorDashboardStats(tutorId),
      findHiredProfessionalsByTutorId(tutorId),
      findFirstPendingReviewRequestId(tutorId),
      findRecentTutorActivity(tutorId, 10),
    ])

  const nextActions = buildNextActions(
    stats,
    firstPendingReviewRequestId,
    hiredProfessionals
  )

  return {
    stats,
    recentActivity,
    nextActions,
    hiredProfessionals,
    firstPendingReviewRequestId,
  }
}
