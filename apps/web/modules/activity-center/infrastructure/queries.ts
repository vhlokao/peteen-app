/**
 * Módulo: activity-center
 * Camada: infrastructure — agregação read-only de atividades
 */

import { prisma } from "@/lib/prisma/client"
import { RELATIONSHIP_LEVEL_THRESHOLDS } from "@/modules/relationship/domain/constants"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import { buildProfessionalDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import type { ActivityItem, ActivityType } from "../domain/types"

const DEFAULT_LIMIT = 50
const RECURRING_THRESHOLD = RELATIONSHIP_LEVEL_THRESHOLDS.RECURRING

function finalize(items: ActivityItem[], limit = DEFAULT_LIMIT): ActivityItem[] {
  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

function serviceLabel(type: string): string {
  return SERVICE_TYPE_LABELS[type as ServiceType] ?? type
}

function partnerConnectionsWhere(partnerId: string) {
  return {
    connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL" as const,
    OR: [
      { sourcePartnerId: partnerId },
      { sourceId: partnerId, sourceType: "PARTNER" as const },
    ],
  }
}

// ── Tutor ─────────────────────────────────────────────────────────────────────

export async function getTutorActivityFeed(
  tutorId: string,
  userId: string,
  limit = DEFAULT_LIMIT
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = []

  const [requests, reviews, pets, archivedLogs, relationships, recurringRequests] =
    await Promise.all([
      prisma.serviceRequest.findMany({
        where: { tutorId },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          status: true,
          serviceType: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          isRecurring: true,
          professional: { select: { id: true, displayName: true } },
          pet: { select: { id: true, name: true } },
        },
      }),
      prisma.review.findMany({
        where: { tutorId, isVisible: true, hiddenByAdmin: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          createdAt: true,
          request: {
            select: {
              professional: { select: { id: true, displayName: true } },
            },
          },
        },
      }),
      prisma.pet.findMany({
        where: { tutorId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { userId, action: "pet.archived", entity: "Pet" },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, entityId: true, createdAt: true, after: true },
      }),
      prisma.tutorProfessionalRelationship.findMany({
        where: { tutorId, completedServices: { gte: RECURRING_THRESHOLD } },
        orderBy: { lastServiceAt: "desc" },
        take: 10,
        select: {
          id: true,
          completedServices: true,
          lastServiceAt: true,
          professional: { select: { id: true, displayName: true } },
        },
      }),
      prisma.serviceRequest.findMany({
        where: { tutorId, isRecurring: true },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          createdAt: true,
          professional: { select: { id: true, displayName: true } },
        },
      }),
    ])

  for (const req of requests) {
    const profName = req.professional.displayName
    const label = serviceLabel(req.serviceType)

    items.push({
      id: `tutor-req-created-${req.id}`,
      type: "request_created",
      title: "Solicitação enviada",
      description: `Você enviou uma solicitação para ${profName}.`,
      createdAt: req.createdAt,
      entityId: req.id,
      entityType: "ServiceRequest",
      href: `/tutor/requests/${req.id}`,
      metadata: { serviceType: req.serviceType, serviceLabel: label },
    })

    if (
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(req.status) &&
      req.updatedAt.getTime() > req.createdAt.getTime() + 1000
    ) {
      items.push({
        id: `tutor-req-accepted-${req.id}`,
        type: "request_accepted",
        title: "Solicitação aceita",
        description: `${profName} aceitou sua solicitação.`,
        createdAt: req.updatedAt,
        entityId: req.id,
        entityType: "ServiceRequest",
        href: `/tutor/requests/${req.id}`,
      })
    }

    if (req.status === "COMPLETED" && req.completedAt) {
      const petPart = req.pet?.name ? ` de ${req.pet.name}` : ""
      items.push({
        id: `tutor-req-completed-${req.id}`,
        type: "request_completed",
        title: "Atendimento concluído",
        description: `Atendimento${petPart} foi concluído com ${profName}.`,
        createdAt: req.completedAt,
        entityId: req.id,
        entityType: "ServiceRequest",
        href: `/tutor/requests/${req.id}`,
      })
    }
  }

  for (const rev of reviews) {
    const profName = rev.request.professional.displayName
    items.push({
      id: `tutor-review-${rev.id}`,
      type: "review_sent",
      title: "Avaliação enviada",
      description: `Você avaliou ${profName} com ${rev.rating} estrela${rev.rating !== 1 ? "s" : ""}.`,
      createdAt: rev.createdAt,
      entityId: rev.id,
      entityType: "Review",
      href: `/tutor/professionals/${rev.request.professional.id}`,
    })
  }

  for (const pet of pets) {
    items.push({
      id: `tutor-pet-created-${pet.id}`,
      type: "pet_created",
      title: "Pet cadastrado",
      description: `${pet.name} foi cadastrado.`,
      createdAt: pet.createdAt,
      entityId: pet.id,
      entityType: "Pet",
      href: `/me/pets/${pet.id}`,
    })
  }

  for (const log of archivedLogs) {
    const after = log.after as { name?: string; tutorId?: string } | null
    if (after?.tutorId && after.tutorId !== tutorId) continue
    const petName = after?.name ?? "Pet"
    items.push({
      id: `tutor-pet-archived-${log.id}`,
      type: "pet_archived",
      title: "Pet arquivado",
      description: `${petName} foi arquivado.`,
      createdAt: log.createdAt,
      entityId: log.entityId,
      entityType: "Pet",
      href: `/me/pets/${log.entityId}`,
    })
  }

  for (const rel of relationships) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `tutor-recurring-${rel.id}`,
      type: "relationship_recurring",
      title: "Relacionamento recorrente",
      description: `Você estabeleceu recorrência com ${rel.professional.displayName}.`,
      createdAt: rel.lastServiceAt,
      entityId: rel.professional.id,
      entityType: "TutorProfessionalRelationship",
      href: `/tutor/professionals/${rel.professional.id}`,
    })
  }

  for (const req of recurringRequests) {
    items.push({
      id: `tutor-rehire-${req.id}`,
      type: "request_created",
      title: "Profissional contratado novamente",
      description: `Você contratou ${req.professional.displayName} novamente.`,
      createdAt: req.createdAt,
      entityId: req.id,
      entityType: "ServiceRequest",
      href: `/tutor/professionals/${req.professional.id}`,
    })
  }

  return finalize(items, limit)
}

// ── Professional ──────────────────────────────────────────────────────────────

export async function getProfessionalActivityFeed(
  professionalId: string,
  userId: string,
  profile: { isVerified: boolean; verifiedIdentity: boolean },
  limit = DEFAULT_LIMIT
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = []
  const seloAtivo = isProfessionalVerificationActive(profile)

  const [requests, reviews, relationships, verifications, recommendations, profileLogs] =
    await Promise.all([
      prisma.serviceRequest.findMany({
        where: { professionalId },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: {
          id: true,
          status: true,
          serviceType: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          tutor: { select: { id: true, displayName: true } },
          pet: { select: { name: true } },
        },
      }),
      prisma.review.findMany({
        where: {
          request: { professionalId },
          isVisible: true,
          hiddenByAdmin: false,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          createdAt: true,
          tutor: { select: { displayName: true } },
        },
      }),
      prisma.tutorProfessionalRelationship.findMany({
        where: { professionalId, completedServices: { gte: RECURRING_THRESHOLD } },
        orderBy: { lastServiceAt: "desc" },
        take: 10,
        select: {
          id: true,
          completedServices: true,
          lastServiceAt: true,
          tutor: { select: { id: true, displayName: true } },
        },
      }),
      prisma.verificationRequest.findMany({
        where: { entityType: "PROFESSIONAL", entityId: professionalId },
        orderBy: { requestedAt: "desc" },
        take: 10,
        select: { id: true, status: true, reviewedAt: true, requestedAt: true },
      }),
      prisma.trustConnection.findMany({
        where: { targetId: professionalId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          sourceName: true,
          connectionType: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: {
          userId,
          action: "professional.profile_updated",
          entityId: professionalId,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, createdAt: true },
      }),
    ])

  for (const req of requests) {
    const tutorName = req.tutor.displayName
    const label = serviceLabel(req.serviceType)

    items.push({
      id: `pro-req-received-${req.id}`,
      type: "request_created",
      title: "Nova solicitação recebida",
      description: `Você recebeu uma nova solicitação de ${tutorName}.`,
      createdAt: req.createdAt,
      entityId: req.id,
      entityType: "ServiceRequest",
      href: `/requests/${req.id}`,
      metadata: { serviceLabel: label },
    })

    if (
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(req.status) &&
      req.updatedAt.getTime() > req.createdAt.getTime() + 1000
    ) {
      items.push({
        id: `pro-req-accepted-${req.id}`,
        type: "request_accepted",
        title: "Solicitação aceita",
        description: `Você aceitou a solicitação de ${tutorName}.`,
        createdAt: req.updatedAt,
        entityId: req.id,
        entityType: "ServiceRequest",
        href: `/requests/${req.id}`,
      })
    }

    if (req.status === "COMPLETED" && req.completedAt) {
      const petPart = req.pet?.name ? ` de ${req.pet.name}` : ""
      items.push({
        id: `pro-req-completed-${req.id}`,
        type: "request_completed",
        title: "Atendimento concluído",
        description: `Você concluiu atendimento${petPart}.`,
        createdAt: req.completedAt,
        entityId: req.id,
        entityType: "ServiceRequest",
        href: `/requests/${req.id}`,
      })
    }
  }

  for (const rev of reviews) {
    items.push({
      id: `pro-review-${rev.id}`,
      type: "review_received",
      title: "Avaliação recebida",
      description: `Você recebeu uma avaliação de ${rev.rating} estrela${rev.rating !== 1 ? "s" : ""} de ${rev.tutor.displayName}.`,
      createdAt: rev.createdAt,
      entityId: rev.id,
      entityType: "Review",
      href: `/professional/reviews`,
    })
  }

  for (const rel of relationships) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `pro-recurring-${rel.id}`,
      type: "relationship_recurring",
      title: "Cliente recorrente",
      description: `${rel.tutor.displayName} tornou-se cliente recorrente.`,
      createdAt: rel.lastServiceAt,
      entityId: rel.tutor.id,
      entityType: "TutorProfessionalRelationship",
      href: `/professional/clients/${rel.tutor.id}`,
    })
  }

  for (const ver of verifications) {
    if (ver.status === "APPROVED" && ver.reviewedAt) {
      items.push({
        id: `pro-ver-approved-${ver.id}`,
        type: seloAtivo ? "verification_approved" : "verification_suspended",
        title: seloAtivo ? "Verificação aprovada" : "Verificação suspensa",
        description: seloAtivo
          ? "Sua verificação foi aprovada."
          : "Seu selo de verificação foi suspenso.",
        createdAt: ver.reviewedAt,
        entityId: ver.id,
        entityType: "VerificationRequest",
        href: `/professional/metricas`,
      })
    }
  }

  for (const rec of recommendations) {
    if (rec.connectionType !== "PARTNER_RECOMMENDS_PROFESSIONAL") continue
    items.push({
      id: `pro-rec-${rec.id}`,
      type: "professional_recommended",
      title: "Recomendação recebida",
      description: `${rec.sourceName} recomendou seu perfil.`,
      createdAt: rec.createdAt,
      entityId: rec.id,
      entityType: "TrustConnection",
      href: `/professional/metricas`,
    })
  }

  for (const log of profileLogs) {
    items.push({
      id: `pro-profile-${log.id}`,
      type: "profile_updated",
      title: "Perfil atualizado",
      description: "Seu perfil foi atualizado.",
      createdAt: log.createdAt,
      entityId: professionalId,
      entityType: "ProfessionalProfile",
      href: `/professional/profile`,
    })
  }

  return finalize(items, limit)
}

// ── Partner ───────────────────────────────────────────────────────────────────

export async function getPartnerActivityFeed(
  partnerId: string,
  userId: string,
  limit = DEFAULT_LIMIT
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = []
  const baseWhere = partnerConnectionsWhere(partnerId)
  const profHref = (id: string) =>
    buildProfessionalDiscoverUrl(id, "/partner/activity")

  const [connections, verifications, profileLogs, recommendedIds] = await Promise.all([
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
        targetProfile: { select: { displayName: true } },
      },
    }),
    prisma.verificationRequest.findMany({
      where: { entityType: "PARTNER", entityId: partnerId, status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 5,
      select: { id: true, reviewedAt: true },
    }),
    prisma.auditLog.findMany({
      where: { userId, action: "partner.profile_updated", entityId: partnerId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, createdAt: true },
    }),
    prisma.trustConnection.findMany({
      where: { ...baseWhere, isActive: true },
      select: { targetId: true },
      distinct: ["targetId"],
    }),
  ])

  const professionalIds = recommendedIds.map((c) => c.targetId)

  const [recurringRels, recentReviews] = await Promise.all([
    professionalIds.length
      ? prisma.tutorProfessionalRelationship.findMany({
          where: {
            professionalId: { in: professionalIds },
            completedServices: { gte: RECURRING_THRESHOLD },
          },
          orderBy: { lastServiceAt: "desc" },
          take: 10,
          select: {
            id: true,
            professionalId: true,
            lastServiceAt: true,
            professional: { select: { displayName: true } },
          },
        })
      : Promise.resolve([]),
    professionalIds.length
      ? prisma.review.findMany({
          where: {
            request: { professionalId: { in: professionalIds } },
            isVisible: true,
            hiddenByAdmin: false,
          },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true,
            rating: true,
            createdAt: true,
            request: {
              select: {
                professional: { select: { id: true, displayName: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  for (const conn of connections) {
    const name = conn.targetProfile.displayName
    items.push({
      id: `partner-rec-${conn.id}`,
      type: "professional_recommended",
      title: "Profissional recomendado",
      description: `Você recomendou ${name}.`,
      createdAt: conn.createdAt,
      entityId: conn.id,
      entityType: "TrustConnection",
      href: profHref(conn.targetId),
    })

    if (conn.isActive) {
      items.push({
        id: `partner-active-${conn.id}`,
        type: conn.updatedAt.getTime() > conn.createdAt.getTime() + 1000
          ? "recommendation_active"
          : "connection_active",
        title: "Conexão ativa",
        description: `Conexão ativa com ${name}.`,
        createdAt:
          conn.updatedAt.getTime() > conn.createdAt.getTime() + 1000
            ? conn.updatedAt
            : conn.createdAt,
        entityId: conn.id,
        entityType: "TrustConnection",
        href: `/partner/recommendations`,
      })
    }
  }

  for (const ver of verifications) {
    if (!ver.reviewedAt) continue
    items.push({
      id: `partner-ver-${ver.id}`,
      type: "partner_verified",
      title: "Parceiro verificado",
      description: "Seu parceiro foi verificado pela equipe Peteen.",
      createdAt: ver.reviewedAt,
      entityId: ver.id,
      entityType: "VerificationRequest",
      href: `/partner/profile`,
    })
  }

  for (const log of profileLogs) {
    items.push({
      id: `partner-profile-${log.id}`,
      type: "profile_updated",
      title: "Perfil atualizado",
      description: "Seu perfil de parceiro foi atualizado.",
      createdAt: log.createdAt,
      entityId: partnerId,
      entityType: "Partner",
      href: `/partner/profile`,
    })
  }

  for (const rel of recurringRels) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `partner-recurring-${rel.id}`,
      type: "relationship_recurring",
      title: "Profissional recorrente",
      description: `${rel.professional.displayName} tornou-se profissional recorrente.`,
      createdAt: rel.lastServiceAt,
      entityId: rel.professionalId,
      entityType: "TutorProfessionalRelationship",
      href: profHref(rel.professionalId),
    })
  }

  for (const rev of recentReviews) {
    const prof = rev.request.professional
    items.push({
      id: `partner-pro-review-${rev.id}`,
      type: "review_received",
      title: "Avaliação recebida",
      description: `${prof.displayName} recebeu uma nova avaliação (${rev.rating}★).`,
      createdAt: rev.createdAt,
      entityId: rev.id,
      entityType: "Review",
      href: profHref(prof.id),
    })
  }

  return finalize(items, limit)
}

// ── Admin ───────────────────────────────────────────────────────────────────

const ADMIN_ACTIONS = new Set([
  "verification.approved",
  "verification.rejected",
  "verification.suspended",
  "verification.reactivated",
  "professional.profile_updated",
  "tutor.profile_updated",
  "partner.profile_updated",
  "pet.created",
  "pet.archived",
  "review.hide",
  "review.restore",
  "partner.activate",
  "partner.deactivate",
])

type AdminActionMeta = {
  type: ActivityType
  title: string
  href: string
}

function adminActionMeta(action: string): AdminActionMeta {
  const map: Record<string, AdminActionMeta> = {
    "verification.approved": {
      type: "verification_approved",
      title: "Verificação aprovada",
      href: "/admin/verifications",
    },
    "verification.rejected": {
      type: "verification_rejected",
      title: "Verificação rejeitada",
      href: "/admin/verifications",
    },
    "verification.suspended": {
      type: "verification_suspended",
      title: "Verificação suspensa",
      href: "/admin/verifications",
    },
    "verification.reactivated": {
      type: "verification_reactivated",
      title: "Verificação reativada",
      href: "/admin/verifications",
    },
    "professional.profile_updated": {
      type: "profile_updated",
      title: "Perfil profissional atualizado",
      href: "/admin/professionals",
    },
    "tutor.profile_updated": {
      type: "profile_updated",
      title: "Perfil de tutor atualizado",
      href: "/admin/tutors",
    },
    "partner.profile_updated": {
      type: "profile_updated",
      title: "Perfil de parceiro atualizado",
      href: "/admin/partners",
    },
    "pet.created": {
      type: "pet_created",
      title: "Pet criado",
      href: "/admin/audit",
    },
    "pet.archived": {
      type: "pet_archived",
      title: "Pet arquivado",
      href: "/admin/audit",
    },
    "review.hide": {
      type: "review_hidden",
      title: "Review ocultada",
      href: "/admin/reviews",
    },
    "review.restore": {
      type: "review_restored",
      title: "Review restaurada",
      href: "/admin/reviews",
    },
    "partner.activate": {
      type: "partner_activated",
      title: "Parceiro ativado",
      href: "/admin/partners",
    },
    "partner.deactivate": {
      type: "partner_deactivated",
      title: "Parceiro desativado",
      href: "/admin/partners",
    },
  }
  return (
    map[action] ?? {
      type: "admin_action",
      title: action,
      href: "/admin/audit",
    }
  )
}

function summarizeMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object") return ""
  const obj = meta as Record<string, unknown>
  const parts: string[] = []
  if (typeof obj.businessName === "string") parts.push(obj.businessName)
  if (typeof obj.displayName === "string") parts.push(obj.displayName)
  if (typeof obj.name === "string") parts.push(obj.name)
  if (typeof obj.reason === "string") parts.push(obj.reason)
  return parts.join(" · ")
}

export async function getAdminActivityFeed(limit = DEFAULT_LIMIT): Promise<ActivityItem[]> {
  const items: ActivityItem[] = []

  const [adminLogs, userLogs] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { action: { in: [...ADMIN_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { admin: { select: { email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { in: [...ADMIN_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { user: { select: { email: true } } },
    }),
  ])

  for (const log of adminLogs) {
    const meta = adminActionMeta(log.action)
    const summary = summarizeMetadata(log.metadata)
    items.push({
      id: `admin-log-${log.id}`,
      type: meta.type,
      title: meta.title,
      description: summary
        ? `${log.entityType} · ${summary}`
        : `${log.entityType} · ${log.entityId.slice(0, 8)}…`,
      createdAt: log.createdAt,
      entityId: log.entityId,
      entityType: log.entityType,
      href: meta.href,
      actorName: log.admin.email,
      metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    })
  }

  for (const log of userLogs) {
    const meta = adminActionMeta(log.action)
    const summary = summarizeMetadata(log.after ?? log.before)
    items.push({
      id: `user-log-${log.id}`,
      type: meta.type,
      title: meta.title,
      description: summary
        ? `${log.entity} · ${summary}`
        : `${log.entity} · ${log.entityId.slice(0, 8)}…`,
      createdAt: log.createdAt,
      entityId: log.entityId,
      entityType: log.entity,
      href: meta.href,
      actorName: log.user.email,
      metadata: (log.after as Record<string, unknown>) ?? undefined,
    })
  }

  return finalize(items, limit)
}
