/**
 * Módulo: notifications
 * Camada: infrastructure — notificações derivadas (read-only, sem persistência)
 */

import { subDays } from "date-fns"

import { prisma } from "@/lib/prisma/client"
import { RELATIONSHIP_LEVEL_THRESHOLDS } from "@/modules/relationship/domain/constants"
import type { NotificationItem } from "../domain/types"
import {
  adminNotificationHref,
  partnerNotificationHref,
  professionalNotificationHref,
  tutorNotificationHref,
} from "./links"

const DEFAULT_LIMIT = 40
const RECENT_WINDOW_DAYS = 30
const RECURRING_THRESHOLD = RELATIONSHIP_LEVEL_THRESHOLDS.RECURRING

function recentSince(): Date {
  return subDays(new Date(), RECENT_WINDOW_DAYS)
}

function finalize(items: NotificationItem[], limit = DEFAULT_LIMIT): NotificationItem[] {
  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
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

export async function getTutorNotifications(
  tutorId: string,
  limit = DEFAULT_LIMIT
): Promise<NotificationItem[]> {
  const since = recentSince()
  const items: NotificationItem[] = []

  const [requests, disputes] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        tutorId,
        OR: [{ updatedAt: { gte: since } }, { completedAt: { gte: since } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        professional: { select: { id: true, displayName: true } },
        pet: { select: { name: true } },
        review: { select: { id: true } },
      },
    }),
    prisma.dispute.findMany({
      where: {
        request: { tutorId },
        OR: [{ createdAt: { gte: since } }, { resolvedAt: { gte: since } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        requestId: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
  ])

  for (const req of requests) {
    const profName = req.professional.displayName

    if (
      ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(req.status) &&
      req.updatedAt >= since &&
      req.updatedAt.getTime() > req.createdAt.getTime() + 60_000
    ) {
      items.push({
        id: `notif-tutor-accepted-${req.id}`,
        type: "request_accepted",
        title: "Solicitação aceita",
        description: `${profName} aceitou sua solicitação.`,
        createdAt: req.updatedAt,
        href: tutorNotificationHref.request(req.id),
        entityId: req.id,
        entityType: "ServiceRequest",
      })
    }

    if (req.status === "COMPLETED" && req.completedAt && req.completedAt >= since) {
      const petPart = req.pet?.name ? ` de ${req.pet.name}` : ""
      items.push({
        id: `notif-tutor-completed-${req.id}`,
        type: "request_completed",
        title: "Atendimento concluído",
        description: `O atendimento${petPart} foi concluído.`,
        createdAt: req.completedAt,
        href: tutorNotificationHref.request(req.id),
        entityId: req.id,
        entityType: "ServiceRequest",
      })

      if (!req.review) {
        items.push({
          id: `notif-tutor-review-pending-${req.id}`,
          type: "review_pending",
          title: "Avaliação pendente",
          description: "Avalie o atendimento realizado.",
          createdAt: req.completedAt,
          href: tutorNotificationHref.request(req.id),
          priority: "high",
          entityId: req.id,
          entityType: "ServiceRequest",
        })
      }
    }
  }

  for (const d of disputes) {
    if (
      d.createdAt >= since &&
      (d.status === "OPEN" || d.status === "UNDER_REVIEW")
    ) {
      items.push({
        id: `notif-tutor-dispute-open-${d.id}`,
        type: "dispute_opened",
        title: "Disputa em análise",
        description: "Sua disputa foi enviada para análise.",
        createdAt: d.createdAt,
        href: tutorNotificationHref.request(d.requestId),
        entityId: d.id,
        entityType: "Dispute",
      })
    }

    if (d.status === "RESOLVED" && d.resolvedAt && d.resolvedAt >= since) {
      items.push({
        id: `notif-tutor-dispute-resolved-${d.id}`,
        type: "dispute_status_updated",
        title: "Disputa resolvida",
        description: "Sua disputa foi resolvida.",
        createdAt: d.resolvedAt,
        href: tutorNotificationHref.request(d.requestId),
        entityId: d.id,
        entityType: "Dispute",
      })
    }
  }

  return finalize(items, limit)
}

// ── Professional ──────────────────────────────────────────────────────────────

export async function getProfessionalNotifications(
  professionalId: string,
  limit = DEFAULT_LIMIT
): Promise<NotificationItem[]> {
  const since = recentSince()
  const items: NotificationItem[] = []

  const [requests, reviews, disputes, recurring] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        professionalId,
        OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
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
        createdAt: { gte: since },
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
    prisma.dispute.findMany({
      where: {
        request: { professionalId },
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        requestId: true,
        createdAt: true,
      },
    }),
    prisma.tutorProfessionalRelationship.findMany({
      where: {
        professionalId,
        completedServices: { gte: RECURRING_THRESHOLD },
        lastServiceAt: { gte: since },
      },
      orderBy: { lastServiceAt: "desc" },
      take: 10,
      select: {
        id: true,
        lastServiceAt: true,
        tutor: { select: { id: true, displayName: true } },
      },
    }),
  ])

  for (const req of requests) {
    const tutorName = req.tutor.displayName

    if (req.status === "PENDING" && req.createdAt >= since) {
      items.push({
        id: `notif-pro-received-${req.id}`,
        type: "request_received",
        title: "Nova solicitação",
        description: "Você recebeu uma nova solicitação.",
        createdAt: req.createdAt,
        href: professionalNotificationHref.request(req.id),
        priority: "high",
        entityId: req.id,
        entityType: "ServiceRequest",
      })
    }

    if (req.status === "CANCELLED_BY_TUTOR" && req.updatedAt >= since) {
      items.push({
        id: `notif-pro-cancelled-${req.id}`,
        type: "request_cancelled",
        title: "Solicitação cancelada",
        description: `${tutorName} cancelou a solicitação.`,
        createdAt: req.updatedAt,
        href: professionalNotificationHref.request(req.id),
        entityId: req.id,
        entityType: "ServiceRequest",
      })
    }

    if (req.status === "COMPLETED" && req.completedAt && req.completedAt >= since) {
      const petPart = req.pet?.name ? ` de ${req.pet.name}` : ""
      items.push({
        id: `notif-pro-completed-${req.id}`,
        type: "request_completed",
        title: "Atendimento concluído",
        description: `Você concluiu o atendimento${petPart}.`,
        createdAt: req.completedAt,
        href: professionalNotificationHref.request(req.id),
        entityId: req.id,
        entityType: "ServiceRequest",
      })
    }
  }

  for (const rev of reviews) {
    items.push({
      id: `notif-pro-review-${rev.id}`,
      type: "review_received",
      title: "Nova avaliação",
      description: `Você recebeu uma avaliação de ${rev.rating} estrela${rev.rating !== 1 ? "s" : ""}.`,
      createdAt: rev.createdAt,
      href: professionalNotificationHref.reviews,
      entityId: rev.id,
      entityType: "Review",
    })
  }

  for (const d of disputes) {
    items.push({
      id: `notif-pro-dispute-${d.id}`,
      type: "dispute_opened",
      title: "Disputa aberta",
      description: "Uma disputa foi aberta em uma solicitação.",
      createdAt: d.createdAt,
      href: professionalNotificationHref.request(d.requestId),
      priority: "high",
      entityId: d.id,
      entityType: "Dispute",
    })
  }

  for (const rel of recurring) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `notif-pro-recurring-${rel.id}`,
      type: "client_recurring",
      title: "Cliente recorrente",
      description: `${rel.tutor.displayName} tornou-se cliente recorrente.`,
      createdAt: rel.lastServiceAt,
      href: professionalNotificationHref.client(rel.tutor.id),
      entityId: rel.tutor.id,
      entityType: "TutorProfessionalRelationship",
    })
  }

  return finalize(items, limit)
}

// ── Partner ───────────────────────────────────────────────────────────────────

export async function getPartnerNotifications(
  partnerId: string,
  limit = DEFAULT_LIMIT
): Promise<NotificationItem[]> {
  const since = recentSince()
  const items: NotificationItem[] = []
  const baseWhere = partnerConnectionsWhere(partnerId)

  const [connections, verifications, recommendedIds] = await Promise.all([
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
      where: {
        entityType: "PARTNER",
        entityId: partnerId,
        status: "APPROVED",
        reviewedAt: { gte: since },
      },
      orderBy: { reviewedAt: "desc" },
      take: 5,
      select: { id: true, reviewedAt: true },
    }),
    prisma.trustConnection.findMany({
      where: { ...baseWhere, isActive: true },
      select: { targetId: true },
      distinct: ["targetId"],
    }),
  ])

  const professionalIds = recommendedIds.map((c) => c.targetId)

  const [recentReviews, recurringRels] = await Promise.all([
    professionalIds.length
      ? prisma.review.findMany({
          where: {
            request: { professionalId: { in: professionalIds } },
            createdAt: { gte: since },
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
    professionalIds.length
      ? prisma.tutorProfessionalRelationship.findMany({
          where: {
            professionalId: { in: professionalIds },
            completedServices: { gte: RECURRING_THRESHOLD },
            lastServiceAt: { gte: since },
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
  ])

  for (const conn of connections) {
    const name = conn.targetProfile.displayName
    const activatedRecently =
      conn.isActive &&
      conn.updatedAt >= since &&
      conn.updatedAt.getTime() > conn.createdAt.getTime() + 60_000
    const deactivatedRecently =
      !conn.isActive && conn.updatedAt >= since

    if (activatedRecently) {
      items.push({
        id: `notif-partner-rec-active-${conn.id}`,
        type: "partner_recommendation_activity",
        title: "Recomendação ativada",
        description: "Sua recomendação foi ativada.",
        createdAt: conn.updatedAt,
        href: partnerNotificationHref.recommendations,
        entityId: conn.id,
        entityType: "TrustConnection",
      })
    }

    if (deactivatedRecently) {
      items.push({
        id: `notif-partner-rec-inactive-${conn.id}`,
        type: "partner_recommendation_activity",
        title: "Recomendação desativada",
        description: `A recomendação de ${name} foi desativada.`,
        createdAt: conn.updatedAt,
        href: partnerNotificationHref.recommendations,
        entityId: conn.id,
        entityType: "TrustConnection",
      })
    }

    if (conn.isActive && conn.createdAt >= since) {
      items.push({
        id: `notif-partner-rec-new-${conn.id}`,
        type: "recommendation_received",
        title: "Profissional recomendado",
        description: `Você recomendou ${name}.`,
        createdAt: conn.createdAt,
        href: partnerNotificationHref.recommendations,
        entityId: conn.id,
        entityType: "TrustConnection",
      })
    }
  }

  for (const ver of verifications) {
    if (!ver.reviewedAt) continue
    items.push({
      id: `notif-partner-verified-${ver.id}`,
      type: "verification_approved",
      title: "Organização verificada",
      description: "Sua organização foi verificada.",
      createdAt: ver.reviewedAt,
      href: partnerNotificationHref.profile,
      entityId: ver.id,
      entityType: "VerificationRequest",
    })
  }

  for (const rev of recentReviews) {
    const prof = rev.request.professional
    items.push({
      id: `notif-partner-review-${rev.id}`,
      type: "review_received",
      title: "Nova avaliação na rede",
      description: `${prof.displayName} recebeu uma nova avaliação.`,
      createdAt: rev.createdAt,
      href: partnerNotificationHref.discoverProfessional(prof.id),
      entityId: rev.id,
      entityType: "Review",
    })
  }

  for (const rel of recurringRels) {
    if (!rel.lastServiceAt) continue
    items.push({
      id: `notif-partner-recurring-${rel.id}`,
      type: "client_recurring",
      title: "Profissional recorrente",
      description: `${rel.professional.displayName} tornou-se recorrente.`,
      createdAt: rel.lastServiceAt,
      href: partnerNotificationHref.metrics,
      entityId: rel.professionalId,
      entityType: "TutorProfessionalRelationship",
    })
  }

  return finalize(items, limit)
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminNotifications(
  limit = DEFAULT_LIMIT
): Promise<NotificationItem[]> {
  const since = recentSince()
  const items: NotificationItem[] = []

  const [disputes, verifications, flags, hiddenReviews, unlinkedCount] =
    await Promise.all([
      prisma.dispute.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, createdAt: true },
      }),
      prisma.verificationRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { requestedAt: "desc" },
        take: 20,
        select: { id: true, entityType: true, requestedAt: true },
      }),
      prisma.operationalFlag.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, severity: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { action: "review.hide", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, entityId: true, createdAt: true },
      }),
      prisma.partnerProfile.count({
        where: { linkedPartnerId: null },
      }),
    ])

  for (const d of disputes) {
    items.push({
      id: `notif-admin-dispute-${d.id}`,
      type: "dispute_opened",
      title: "Nova disputa",
      description: "Nova disputa aguardando análise.",
      createdAt: d.createdAt,
      href: adminNotificationHref.disputes,
      priority: "high",
      entityId: d.id,
      entityType: "Dispute",
    })
  }

  for (const ver of verifications) {
    items.push({
      id: `notif-admin-ver-${ver.id}`,
      type: "verification_pending",
      title: "Verificação pendente",
      description: "Nova verificação pendente.",
      createdAt: ver.requestedAt,
      href: adminNotificationHref.verifications,
      priority: "high",
      entityId: ver.id,
      entityType: "VerificationRequest",
    })
  }

  for (const flag of flags) {
    items.push({
      id: `notif-admin-flag-${flag.id}`,
      type: "risk_flag",
      title: "Flag operacional",
      description: `Nova flag de risco (${flag.severity}).`,
      createdAt: flag.createdAt,
      href: adminNotificationHref.flags,
      priority: flag.severity === "HIGH" ? "high" : "normal",
      entityId: flag.id,
      entityType: "OperationalFlag",
    })
  }

  for (const log of hiddenReviews) {
    items.push({
      id: `notif-admin-review-hidden-${log.id}`,
      type: "review_hidden",
      title: "Avaliação ocultada",
      description: "Uma avaliação foi ocultada.",
      createdAt: log.createdAt,
      href: adminNotificationHref.reviews,
      entityId: log.entityId,
      entityType: "Review",
    })
  }

  if (unlinkedCount > 0) {
    items.push({
      id: "notif-admin-partner-unlinked",
      type: "partner_unlinked",
      title: "Parceiro sem vínculo",
      description:
        unlinkedCount === 1
          ? "Há um parceiro sem vínculo operacional."
          : `Há ${unlinkedCount} parceiros sem vínculo operacional.`,
      createdAt: new Date(),
      href: adminNotificationHref.partners,
      priority: "high",
      entityType: "PartnerProfile",
    })
  }

  return finalize(items, limit)
}

export async function countTutorNotifications(tutorId: string): Promise<number> {
  return (await getTutorNotifications(tutorId, 20)).length
}

export async function countProfessionalNotifications(
  professionalId: string
): Promise<number> {
  return (await getProfessionalNotifications(professionalId, 20)).length
}

export async function countPartnerNotifications(partnerId: string): Promise<number> {
  return (await getPartnerNotifications(partnerId, 20)).length
}

export async function countAdminNotifications(): Promise<number> {
  return (await getAdminNotifications(20)).length
}
