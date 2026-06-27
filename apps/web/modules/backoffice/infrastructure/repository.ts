/**
 * módulo: backoffice
 * camada: infrastructure
 *
 * Queries de leitura para o Backoffice Admin.
 *
 * Regras:
 *   - Somente leitura — sem mutações aqui
 *   - Sem verificação de auth — responsabilidade da camada application/layout
 *   - Retorna tipos de domínio do backoffice
 *   - Queries devem ser eficientes — não levar mais de 1s para volumes normais
 */

import { prisma } from "@/lib/prisma/client"
import type {
  AdminDashboardMetrics,
  AdminUserRow,
  AdminTutorRow,
  AdminProfessionalRow,
  AdminRequestRow,
  AdminReviewRow,
  AdminTrustRow,
  AdminRelationshipRow,
  AdminFlagRow,
  AdminDisputeRow,
  AdminAuditRow,
  AdminRiskRow,
  AdminUsersFilter,
  AdminRequestsFilter,
  AdminRelationshipsFilter,
  AdminFlagsFilter,
  AdminDisputesFilter,
  AdminAuditFilter,
} from "../domain/types"
import { calculateAllRiskScores } from "@/modules/antifraude/application/calculate-risk-score"

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

// safeCount — fallback 0 se o delegate não existir no client em cache (dev reload)
async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn()
  } catch {
    return 0
  }
}

export async function getDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    totalTutors,
    totalProfessionals,
    totalPets,
    totalRequests,
    pendingRequests,
    completedRequests,
    totalReviews,
    trustAggregate,
    professionalsWithStaleScore,
    recurringRelationships,
    openFlags,
    openDisputes,
    hiddenReviews,
    activeTrustConnections,
    activePartners,
    verifiedPartners,
    professionalsRecommendedByPartners,
  ] = await Promise.all([
    safeCount(() => prisma.user.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.tutorProfile.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.professionalProfile.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.pet.count({ where: { deletedAt: null } })),
    safeCount(() => prisma.serviceRequest.count()),
    safeCount(() => prisma.serviceRequest.count({ where: { status: "PENDING" } })),
    safeCount(() => prisma.serviceRequest.count({ where: { status: "COMPLETED" } })),
    safeCount(() => prisma.review.count()),
    prisma.professionalProfile.aggregate({
      _avg: { trustScore: true },
      where: { deletedAt: null },
    }).catch(() => ({ _avg: { trustScore: 0 } })),
    safeCount(() => prisma.professionalProfile.count({
      where: {
        deletedAt: null,
        OR: [
          { trustUpdatedAt: null },
          { trustUpdatedAt: { lt: oneDayAgo } },
        ],
      },
    })),
    safeCount(() => prisma.tutorProfessionalRelationship.count({
      where: { relationshipLevel: { in: ["RECURRING", "TRUSTED", "PARTNER"] } },
    })),
    // Etapa 5.5 — fallback defensivo: retorna 0 se o client antigo não tiver o delegate
    safeCount(() => prisma.operationalFlag.count({ where: { status: "OPEN" } })),
    safeCount(() => prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } })),
    safeCount(() => prisma.review.count({ where: { hiddenByAdmin: true } })),
    // Etapa 5.8 — Trust Graph
    safeCount(() => prisma.trustConnection.count({ where: { isActive: true } })),
    // Etapa 5.9 — Parceiros
    safeCount(() => prisma.partner.count({ where: { isActive: true } })),
    safeCount(() => prisma.partner.count({ where: { isActive: true, isVerified: true } })),
    safeCount(() =>
      prisma.trustConnection.groupBy({
        by: ["targetId"],
        where: {
          connectionType: "PARTNER_RECOMMENDS_PROFESSIONAL",
          isActive: true,
        },
      }).then((rows) => rows.length)
    ),
  ])

  return {
    totalUsers,
    totalTutors,
    totalProfessionals,
    totalPets,
    totalRequests,
    pendingRequests,
    completedRequests,
    totalReviews,
    averageTrustScore: Math.round(trustAggregate._avg.trustScore ?? 0),
    professionalsWithStaleScore,
    recurringRelationships,
    openFlags,
    openDisputes,
    hiddenReviews,
    activeTrustConnections,
    activePartners,
    verifiedPartners,
    professionalsRecommendedByPartners,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminUsers(
  filter: AdminUsersFilter = {}
): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(filter.email
        ? { email: { contains: filter.email, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      activePrimaryRole: true,
      createdAt: true,
      onboardingCompletedAt: true,
      lastSeenAt: true,
      tutorProfile:        { select: { id: true } },
      professionalProfile: { select: { id: true } },
      partnerProfile:      { select: { id: true } },
      adminProfile:        { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return users
    .map((u) => {
      const roles: string[] = []
      if (u.tutorProfile)        roles.push("TUTOR")
      if (u.professionalProfile) roles.push("PROFESSIONAL")
      if (u.partnerProfile)      roles.push("PARTNER")
      if (u.adminProfile)        roles.push("ADMIN")

      // Filtra por role se especificado
      if (filter.role && !roles.includes(filter.role)) return null

      return {
        id:                   u.id,
        email:                u.email,
        roles,
        activePrimaryRole:    u.activePrimaryRole ?? null,
        createdAt:            u.createdAt,
        onboardingCompletedAt: u.onboardingCompletedAt,
        lastSeenAt:           u.lastSeenAt,
      }
    })
    .filter(Boolean) as AdminUserRow[]
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminTutors(): Promise<AdminTutorRow[]> {
  const tutors = await prisma.tutorProfile.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      city: true,
      state: true,
      createdAt: true,
      _count: {
        select: {
          pets:     true,
          requests: true,
          reviews:  true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return tutors.map((t) => ({
    id:           t.id,
    displayName:  t.displayName,
    city:         t.city,
    state:        t.state,
    petCount:     t._count.pets,
    requestCount: t._count.requests,
    reviewCount:  t._count.reviews,
    createdAt:    t.createdAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONALS
// ─────────────────────────────────────────────────────────────────────────────

type RawReviewStat = {
  professionalId: string
  count:          bigint
  avgRating:      number | null
}

type RawRelStat = {
  professionalId:  string
  totalCompleted:  bigint
  recurringCount:  bigint
}

export async function getAdminProfessionals(): Promise<AdminProfessionalRow[]> {
  const [professionals, reviewStats, relStats] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { deletedAt: null },
      select: {
        id:            true,
        displayName:   true,
        city:          true,
        state:         true,
        serviceTypes:  true,
        trustScore:    true,
        trustLevel:    true,
        trustUpdatedAt: true,
        createdAt:     true,
      },
      orderBy: { trustScore: "desc" },
      take: 200,
    }),

    // Review count e média via raw SQL (Review não tem professionalId direto)
    // Nota: Prisma usa camelCase nas colunas — todos os nomes entre aspas duplas
    prisma.$queryRaw<RawReviewStat[]>`
      SELECT
        sr."professionalId"  AS "professionalId",
        COUNT(r.id)          AS count,
        AVG(r.rating)        AS "avgRating"
      FROM reviews r
      JOIN service_requests sr ON r."requestId" = sr.id
      GROUP BY sr."professionalId"
    `,

    // Relacionamentos: total completado e qtd de clientes recorrentes
    prisma.$queryRaw<RawRelStat[]>`
      SELECT
        "professionalId"                                                                          AS "professionalId",
        SUM("completedServices")                                                                  AS "totalCompleted",
        COUNT(CASE WHEN "relationshipLevel" IN ('RECURRING','TRUSTED','PARTNER') THEN 1 END)     AS "recurringCount"
      FROM tutor_professional_relationships
      GROUP BY "professionalId"
    `,
  ])

  const reviewMap = new Map(
    reviewStats.map((s) => [
      s.professionalId,
      { count: Number(s.count), avg: s.avgRating ? Number(s.avgRating) : null },
    ])
  )

  const relMap = new Map(
    relStats.map((s) => [
      s.professionalId,
      { total: Number(s.totalCompleted), recurring: Number(s.recurringCount) },
    ])
  )

  return professionals.map((p) => {
    const rev = reviewMap.get(p.id)
    const rel = relMap.get(p.id)
    return {
      id:               p.id,
      displayName:      p.displayName,
      city:             p.city,
      state:            p.state,
      serviceTypes:     p.serviceTypes,
      trustScore:       p.trustScore,
      trustLevel:       p.trustLevel,
      trustUpdatedAt:   p.trustUpdatedAt,
      reviewCount:      rev?.count ?? 0,
      averageRating:    rev?.avg ?? null,
      completedServices: rel?.total ?? 0,
      recurringClients:  rel?.recurring ?? 0,
      createdAt:        p.createdAt,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminRequests(
  filter: AdminRequestsFilter = {}
): Promise<AdminRequestRow[]> {
  const requests = await prisma.serviceRequest.findMany({
    where: {
      ...(filter.status      ? { status:      { equals: filter.status      as never } } : {}),
      ...(filter.serviceType ? { serviceType: { equals: filter.serviceType as never } } : {}),
    },
    select: {
      id:          true,
      serviceType: true,
      status:      true,
      scheduledAt: true,
      completedAt: true,
      createdAt:   true,
      tutor:       { select: { displayName: true } },
      professional:{ select: { displayName: true } },
      pet:         { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  return requests.map((r) => ({
    id:               r.id,
    tutorName:        r.tutor.displayName,
    professionalName: r.professional.displayName,
    petName:          r.pet?.name ?? null,
    serviceType:      r.serviceType,
    status:           r.status,
    scheduledAt:      r.scheduledAt,
    createdAt:        r.createdAt,
    completedAt:      r.completedAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminReviews(): Promise<AdminReviewRow[]> {
  const reviews = await prisma.review.findMany({
    select: {
      id:            true,
      rating:        true,
      comment:       true,
      serviceType:   true,
      petContext:    true,
      isVisible:     true,
      isFlagged:     true,
      hiddenByAdmin: true,
      hiddenReason:  true,
      createdAt:     true,
      tutor: { select: { displayName: true } },
      request: {
        select: {
          professional: { select: { displayName: true } },
        },
      },
    },
    orderBy: [
      { hiddenByAdmin: "desc" },
      { isFlagged: "desc" },
      { createdAt: "desc" },
    ],
    take: 300,
  })

  return reviews.map((r) => {
    const ctx = r.petContext as { species?: string } | null
    return {
      id:               r.id,
      tutorName:        r.tutor.displayName,
      professionalName: r.request.professional.displayName,
      rating:           r.rating,
      comment:          r.comment,
      serviceType:      r.serviceType,
      petSpecies:       ctx?.species ?? "—",
      isVisible:        r.isVisible,
      isFlagged:        r.isFlagged,
      hiddenByAdmin:    r.hiddenByAdmin,
      hiddenReason:     r.hiddenReason,
      createdAt:        r.createdAt,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST
// ─────────────────────────────────────────────────────────────────────────────

type RawTrustStat = {
  professionalId:   string
  count:            bigint
  totalCompleted:   bigint
}

export async function getAdminTrustData(): Promise<AdminTrustRow[]> {
  const [professionals, reviewStats] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { deletedAt: null },
      select: {
        id:             true,
        displayName:    true,
        city:           true,
        trustScore:     true,
        trustLevel:     true,
        trustUpdatedAt: true,
      },
      orderBy: { trustScore: "desc" },
      take: 300,
    }),

    prisma.$queryRaw<RawTrustStat[]>`
      SELECT
        sr."professionalId"                                                       AS "professionalId",
        COUNT(r.id)                                                               AS count,
        SUM(CASE WHEN sr.status = 'COMPLETED' THEN 1 ELSE 0 END)                 AS "totalCompleted"
      FROM service_requests sr
      LEFT JOIN reviews r ON r."requestId" = sr.id
      GROUP BY sr."professionalId"
    `,
  ])

  const statsMap = new Map(
    reviewStats.map((s) => [s.professionalId, s])
  )

  return professionals.map((p) => {
    const s = statsMap.get(p.id)
    return {
      id:               p.id,
      displayName:      p.displayName,
      city:             p.city,
      trustScore:       p.trustScore,
      trustLevel:       p.trustLevel,
      trustUpdatedAt:   p.trustUpdatedAt,
      reviewCount:      s ? Number(s.count) : 0,
      completedServices: s ? Number(s.totalCompleted) : 0,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminRelationships(
  filter: AdminRelationshipsFilter = {}
): Promise<AdminRelationshipRow[]> {
  const relationships = await prisma.tutorProfessionalRelationship.findMany({
    where: {
      ...(filter.relationshipLevel
        ? { relationshipLevel: { equals: filter.relationshipLevel as never } }
        : {}),
    },
    select: {
      id:                true,
      completedServices: true,
      totalRequests:     true,
      reviewsGiven:      true,
      relationshipScore: true,
      relationshipLevel: true,
      firstServiceAt:    true,
      lastServiceAt:     true,
      tutor:        { select: { displayName: true } },
      professional: { select: { displayName: true } },
    },
    orderBy: { completedServices: "desc" },
    take: 300,
  })

  return relationships.map((r) => ({
    id:                r.id,
    tutorName:         r.tutor.displayName,
    professionalName:  r.professional.displayName,
    completedServices: r.completedServices,
    totalRequests:     r.totalRequests,
    reviewsGiven:      r.reviewsGiven,
    relationshipScore: r.relationshipScore,
    relationshipLevel: r.relationshipLevel,
    firstServiceAt:    r.firstServiceAt,
    lastServiceAt:     r.lastServiceAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL FLAGS — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminFlags(
  filter: AdminFlagsFilter = {}
): Promise<AdminFlagRow[]> {
  try {
    const flags = await prisma.operationalFlag.findMany({
      where: {
        ...(filter.status     && { status:     filter.status     as never }),
        ...(filter.severity   && { severity:   filter.severity   as never }),
        ...(filter.targetType && { targetType: filter.targetType as never }),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return flags.map((f) => ({
      id:         f.id,
      targetType: f.targetType,
      targetId:   f.targetId,
      reason:     f.reason,
      severity:   f.severity,
      source:     f.source,
      status:     f.status,
      createdAt:  f.createdAt,
      resolvedAt: f.resolvedAt,
    }))
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminDisputes(
  filter: AdminDisputesFilter = {}
): Promise<AdminDisputeRow[]> {
  try {
    const disputes = await prisma.dispute.findMany({
      where: {
        ...(filter.status && { status: filter.status as never }),
      },
      include: {
        request: {
          include: {
            tutor:        { select: { displayName: true } },
            professional: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })

    return disputes.map((d) => ({
      id:               d.id,
      requestId:        d.requestId,
      tutorName:        d.request.tutor.displayName,
      professionalName: d.request.professional.displayName,
      reason:           d.reason,
      description:      d.description,
      status:           d.status,
      createdAt:        d.createdAt,
      resolvedAt:       d.resolvedAt,
    }))
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUDIT LOG — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

function collectEntityIds(
  entries: { entityType: string; entityId: string }[],
  type: string
): string[] {
  const upper = type.toUpperCase()
  return [...new Set(entries.filter((e) => e.entityType.toUpperCase() === upper).map((e) => e.entityId))]
}

const PARTNER_RECOMMENDATION_ACTIONS = new Set([
  "partner.recommendation_created",
  "partner.recommendation_deactivated",
  "partner.recommendation_activated",
])

function isDisputeAuditEntry(entityType: string, action: string): boolean {
  return entityType.toUpperCase() === "DISPUTE" || action.startsWith("dispute.")
}

function extractDisputeAuditPayload(
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null
): { requestId?: string } | null {
  const data = after ?? before
  if (!data) return null

  const requestId =
    typeof data.requestId === "string" ? data.requestId : undefined

  return requestId ? { requestId } : null
}

function formatDisputeEntityLabel(
  tutorName: string,
  professionalName: string
): string {
  return `Disputa: ${tutorName} × ${professionalName}`
}

function resolveDisputeEntityLabel(
  action: string,
  entityType: string,
  entityId: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null,
  disputeLabels: Map<string, string>,
  disputeLabelsByRequestId: Map<string, string>
): string | null {
  if (!isDisputeAuditEntry(entityType, action)) return null

  const fromDisputeId = disputeLabels.get(entityId)
  if (fromDisputeId) return fromDisputeId

  const payload = extractDisputeAuditPayload(after, before)
  if (payload?.requestId) {
    const fromRequestId = disputeLabelsByRequestId.get(payload.requestId)
    if (fromRequestId) return fromRequestId
  }

  return `Disputa #${entityId}`
}

function extractRecommendationAuditPayload(
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null
): { partnerId?: string; professionalName?: string } | null {
  const data = after ?? before
  if (!data) return null

  const partnerId =
    typeof data.partnerId === "string" ? data.partnerId : undefined
  const professionalName =
    typeof data.professionalName === "string" ? data.professionalName : undefined

  if (!partnerId && !professionalName) return null
  return { partnerId, professionalName }
}

function resolvePartnerRecommendationEntityLabel(
  action: string,
  entityId: string,
  after: Record<string, unknown> | null,
  before: Record<string, unknown> | null,
  partnerNames: Map<string, string>
): string | null {
  if (!PARTNER_RECOMMENDATION_ACTIONS.has(action)) return null

  const payload = extractRecommendationAuditPayload(after, before)
  const partnerName = payload?.partnerId
    ? partnerNames.get(payload.partnerId)
    : undefined
  const professionalName = payload?.professionalName

  if (partnerName && professionalName) {
    return `Recomendação: ${partnerName} → ${professionalName}`
  }

  return `Recomendação #${entityId}`
}

export async function getAdminAuditLogs(
  filter: AdminAuditFilter = {}
): Promise<AdminAuditRow[]> {
  try {
    const [adminLogs, userLogs] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: {
          ...(filter.action     && { action:     { contains: filter.action,     mode: "insensitive" } }),
          ...(filter.entityType && { entityType: { equals:   filter.entityType, mode: "insensitive" } }),
        },
        include: {
          admin: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.auditLog.findMany({
        where: {
          ...(filter.action     && { action: { contains: filter.action, mode: "insensitive" } }),
          ...(filter.entityType && { entity: { equals: filter.entityType, mode: "insensitive" } }),
        },
        include: {
          user: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ])

    const allEntries = [
      ...adminLogs.map((l) => ({ entityType: l.entityType, entityId: l.entityId })),
      ...userLogs.map((l) => ({ entityType: l.entity, entityId: l.entityId })),
    ]

    const proIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "PROFESSIONAL"),
        ...collectEntityIds(allEntries, "PROFESSIONALPROFILE"),
      ]),
    ]
    const partnerIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "PARTNER"),
        ...userLogs.flatMap((l) => {
          if (!PARTNER_RECOMMENDATION_ACTIONS.has(l.action)) return []
          const payload = extractRecommendationAuditPayload(
            l.after as Record<string, unknown> | null,
            l.before as Record<string, unknown> | null
          )
          return payload?.partnerId ? [payload.partnerId] : []
        }),
      ]),
    ]
    const tutorProfileIds = collectEntityIds(allEntries, "TUTORPROFILE")
    const petIds = collectEntityIds(allEntries, "PET")
    const disputeIds = [
      ...new Set([
        ...collectEntityIds(allEntries, "DISPUTE"),
        ...adminLogs
          .filter((l) => isDisputeAuditEntry(l.entityType, l.action))
          .map((l) => l.entityId),
        ...userLogs
          .filter((l) => isDisputeAuditEntry(l.entity, l.action))
          .map((l) => l.entityId),
      ]),
    ]
    const disputeRequestIds = [
      ...new Set([
        ...adminLogs
          .filter((l) => isDisputeAuditEntry(l.entityType, l.action))
          .flatMap((l) => {
            const payload = extractDisputeAuditPayload(
              (l.metadata as Record<string, unknown> | null) ?? null,
              null
            )
            return payload?.requestId ? [payload.requestId] : []
          }),
        ...userLogs
          .filter((l) => isDisputeAuditEntry(l.entity, l.action))
          .flatMap((l) => {
            const payload = extractDisputeAuditPayload(
              l.after as Record<string, unknown> | null,
              l.before as Record<string, unknown> | null
            )
            return payload?.requestId ? [payload.requestId] : []
          }),
      ]),
    ]

    const [professionals, partners, tutorProfiles, pets, disputes] = await Promise.all([
      proIds.length
        ? prisma.professionalProfile.findMany({
            where: { id: { in: proIds } },
            select: {
              id: true,
              displayName: true,
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
      partnerIds.length
        ? prisma.partner.findMany({
            where: { id: { in: partnerIds } },
            select: { id: true, businessName: true, city: true },
          })
        : Promise.resolve([]),
      tutorProfileIds.length
        ? prisma.tutorProfile.findMany({
            where: { id: { in: tutorProfileIds } },
            select: {
              id: true,
              displayName: true,
              user: { select: { email: true } },
            },
          })
        : Promise.resolve([]),
      petIds.length
        ? prisma.pet.findMany({
            where: { id: { in: petIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      disputeIds.length || disputeRequestIds.length
        ? prisma.dispute.findMany({
            where: {
              OR: [
                ...(disputeIds.length ? [{ id: { in: disputeIds } }] : []),
                ...(disputeRequestIds.length
                  ? [{ requestId: { in: disputeRequestIds } }]
                  : []),
              ],
            },
            select: {
              id: true,
              requestId: true,
              request: {
                select: {
                  tutor: { select: { displayName: true } },
                  professional: { select: { displayName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

    const proLabel = new Map(
      professionals.map((p) => [
        p.id,
        `${p.displayName} — ${p.user.email ?? "sem email"}`,
      ])
    )
    const partnerLabel = new Map(
      partners.map((p) => [p.id, `${p.businessName} — parceiro (${p.city})`])
    )
    const partnerBusinessName = new Map(
      partners.map((p) => [p.id, p.businessName])
    )
    const tutorProfileLabel = new Map(
      tutorProfiles.map((t) => [
        t.id,
        `${t.displayName} — ${t.user.email ?? "sem email"}`,
      ])
    )
    const petLabel = new Map(pets.map((p) => [p.id, p.name]))
    const disputeLabel = new Map<string, string>()
    const disputeLabelByRequestId = new Map<string, string>()

    for (const dispute of disputes) {
      const label = formatDisputeEntityLabel(
        dispute.request.tutor.displayName,
        dispute.request.professional.displayName
      )
      disputeLabel.set(dispute.id, label)
      disputeLabelByRequestId.set(dispute.requestId, label)
    }

    function resolveEntityLabel(entityType: string, entityId: string): string | null {
      const type = entityType.toUpperCase()
      if (type === "PROFESSIONAL" || type === "PROFESSIONALPROFILE")
        return proLabel.get(entityId) ?? null
      if (type === "PARTNER") return partnerLabel.get(entityId) ?? null
      if (type === "TUTORPROFILE") return tutorProfileLabel.get(entityId) ?? null
      if (type === "PET") return petLabel.get(entityId) ?? null
      return null
    }

    const adminRows: AdminAuditRow[] = adminLogs.map((l) => {
      const metadata = (l.metadata as Record<string, unknown>) ?? null

      return {
        id:          l.id,
        actorEmail:  l.admin.email ?? "—",
        actorKind:   "admin",
        action:      l.action,
        entityType:  l.entityType,
        entityId:    l.entityId,
        entityLabel:
          resolveDisputeEntityLabel(
            l.action,
            l.entityType,
            l.entityId,
            metadata,
            null,
            disputeLabel,
            disputeLabelByRequestId
          ) ?? resolveEntityLabel(l.entityType, l.entityId),
        metadata,
        createdAt:   l.createdAt,
      }
    })

    const userRows: AdminAuditRow[] = userLogs.map((l) => {
      const after = l.after as Record<string, unknown> | null
      const before = l.before as Record<string, unknown> | null
      const fallbackLabel =
        typeof after?.displayName === "string"
          ? `${after.displayName} — ${l.user.email ?? "sem email"}`
          : typeof after?.name === "string"
            ? after.name
            : null

      return {
        id:          l.id,
        actorEmail:  l.user.email ?? "—",
        actorKind:   "user",
        action:      l.action,
        entityType:  l.entity,
        entityId:    l.entityId,
        entityLabel:
          resolveDisputeEntityLabel(
            l.action,
            l.entity,
            l.entityId,
            after,
            before,
            disputeLabel,
            disputeLabelByRequestId
          ) ??
          resolvePartnerRecommendationEntityLabel(
            l.action,
            l.entityId,
            after,
            before,
            partnerBusinessName
          ) ??
          resolveEntityLabel(l.entity, l.entityId) ??
          fallbackLabel,
        metadata:    (after ?? before) ?? null,
        createdAt:   l.createdAt,
      }
    })

    return [...adminRows, ...userRows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 500)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK SCORES — Etapa 5.5
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminRiskData(): Promise<AdminRiskRow[]> {
  try {
    const [riskResults, professionals] = await Promise.all([
      calculateAllRiskScores(),
      prisma.professionalProfile.findMany({
        where:  { deletedAt: null },
        select: { id: true, displayName: true, city: true },
      }),
    ])

    const cityMap = new Map(professionals.map((p) => [p.id, p.city]))

    return riskResults.map((r) => ({
      id:          r.professionalId,
      displayName: r.displayName,
      city:        cityMap.get(r.professionalId) ?? "—",
      score:       r.score,
      level:       r.level,
    }))
  } catch {
    return []
  }
}
