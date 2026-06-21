/**
 * Módulo: relationship-history
 * Camada: infrastructure — consultas agregadas de histórico relacional
 */

import { prisma } from "@/lib/prisma/client"
import {
  ANALYTICS_THRESHOLDS,
  RELATIONSHIP_LEVEL_LABELS,
} from "@/modules/relationship/domain/constants"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@/modules/service-request/domain/types"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { SPECIES_LABELS, type Species } from "@/modules/tutor/domain/types"
import { getProfessionalVerificationContext } from "@/modules/professional-crm/application/verification-context"
import type {
  ProfessionalClientHistory,
  RelationshipPetRow,
  RelationshipRequestRow,
  RelationshipReviewRow,
  RelationshipSummary,
  TutorProfessionalHistory,
} from "../domain/types"

async function hasPairHistory(
  professionalId: string,
  tutorId: string
): Promise<boolean> {
  const [requestCount, relationship] = await Promise.all([
    prisma.serviceRequest.count({
      where: { professionalId, tutorId },
    }),
    prisma.tutorProfessionalRelationship.findUnique({
      where: {
        tutorId_professionalId: { tutorId, professionalId },
      },
      select: { id: true },
    }),
  ])

  return requestCount > 0 || relationship !== null
}

function buildSummary(
  relationship: {
    completedServices: number
    totalRequests: number
    lastServiceAt: Date | null
    relationshipLevel: RelationshipLevel
  } | null,
  fallback: { completedServices: number; totalRequests: number; lastServiceAt: Date | null }
): RelationshipSummary {
  const completedServices =
    relationship?.completedServices ?? fallback.completedServices
  const totalRequests = relationship?.totalRequests ?? fallback.totalRequests
  const lastServiceAt = relationship?.lastServiceAt ?? fallback.lastServiceAt
  const level = (relationship?.relationshipLevel ?? "NEW") as RelationshipLevel

  return {
    completedServices,
    totalRequests,
    lastServiceAt,
    relationshipLevel: level,
    relationshipLevelLabel: RELATIONSHIP_LEVEL_LABELS[level] ?? level,
    isRecurring: completedServices >= ANALYTICS_THRESHOLDS.RECURRING,
  }
}

function mapRequestRow(
  row: {
    id: string
    status: string
    serviceType: string
    createdAt: Date
    completedAt: Date | null
    pet: { name: string } | null
  },
  hrefPrefix: "professional" | "tutor"
): RelationshipRequestRow {
  const status = row.status as RequestStatus
  const serviceType = row.serviceType as ServiceType
  const occurredAt = row.completedAt ?? row.createdAt

  return {
    id: row.id,
    status: row.status,
    statusLabel: REQUEST_STATUS_LABELS[status] ?? row.status,
    serviceType: row.serviceType,
    serviceLabel: SERVICE_TYPE_LABELS[serviceType] ?? row.serviceType,
    petName: row.pet?.name ?? null,
    occurredAt,
    href:
      hrefPrefix === "tutor"
        ? `/tutor/requests/${row.id}`
        : `/requests/${row.id}`,
  }
}

async function findPetsForPair(
  professionalId: string,
  tutorId: string
): Promise<RelationshipPetRow[]> {
  const rows = await prisma.serviceRequest.findMany({
    where: {
      professionalId,
      tutorId,
      status: "COMPLETED",
      petId: { not: null },
    },
    select: {
      petId: true,
      completedAt: true,
      pet: { select: { id: true, name: true, species: true } },
    },
    orderBy: { completedAt: "desc" },
  })

  const byPet = new Map<
    string,
    { petName: string; species: string; count: number; lastServiceAt: Date | null }
  >()

  for (const row of rows) {
    if (!row.petId || !row.pet) continue
    const existing = byPet.get(row.petId)
    const completedAt = row.completedAt

    if (!existing) {
      byPet.set(row.petId, {
        petName: row.pet.name,
        species: row.pet.species,
        count: 1,
        lastServiceAt: completedAt,
      })
    } else {
      existing.count += 1
      if (
        completedAt &&
        (!existing.lastServiceAt || completedAt > existing.lastServiceAt)
      ) {
        existing.lastServiceAt = completedAt
      }
    }
  }

  return Array.from(byPet.entries())
    .map(([petId, data]) => ({
      petId,
      petName: data.petName,
      species: SPECIES_LABELS[data.species as Species] ?? data.species,
      attendanceCount: data.count,
      lastServiceAt: data.lastServiceAt,
    }))
    .sort((a, b) => {
      const aTime = a.lastServiceAt?.getTime() ?? 0
      const bTime = b.lastServiceAt?.getTime() ?? 0
      return bTime - aTime
    })
}

async function findRequestsForPair(
  professionalId: string,
  tutorId: string,
  hrefPrefix: "professional" | "tutor"
): Promise<RelationshipRequestRow[]> {
  const rows = await prisma.serviceRequest.findMany({
    where: { professionalId, tutorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      serviceType: true,
      createdAt: true,
      completedAt: true,
      pet: { select: { name: true } },
    },
  })

  return rows.map((row) => mapRequestRow(row, hrefPrefix))
}

async function findReviewsForPair(
  professionalId: string,
  tutorId: string
): Promise<RelationshipReviewRow[]> {
  const rows = await prisma.review.findMany({
    where: {
      tutorId,
      isVisible: true,
      hiddenByAdmin: false,
      request: { professionalId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      tutor: { select: { displayName: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
    authorName: row.tutor.displayName,
  }))
}

async function computeFallbackSummary(
  professionalId: string,
  tutorId: string
): Promise<{
  completedServices: number
  totalRequests: number
  lastServiceAt: Date | null
}> {
  const [totalRequests, completedServices, lastCompleted] = await Promise.all([
    prisma.serviceRequest.count({ where: { professionalId, tutorId } }),
    prisma.serviceRequest.count({
      where: { professionalId, tutorId, status: "COMPLETED" },
    }),
    prisma.serviceRequest.findFirst({
      where: { professionalId, tutorId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ])

  return {
    totalRequests,
    completedServices,
    lastServiceAt: lastCompleted?.completedAt ?? null,
  }
}

export async function getProfessionalClientHistory(
  professionalId: string,
  tutorId: string
): Promise<ProfessionalClientHistory | null> {
  const allowed = await hasPairHistory(professionalId, tutorId)
  if (!allowed) return null

  const [tutor, relationship, fallback, pets, requests, reviews] =
    await Promise.all([
      prisma.tutorProfile.findUnique({
        where: { id: tutorId },
        select: {
          id: true,
          displayName: true,
          city: true,
          neighborhood: true,
        },
      }),
      prisma.tutorProfessionalRelationship.findUnique({
        where: {
          tutorId_professionalId: { tutorId, professionalId },
        },
        select: {
          completedServices: true,
          totalRequests: true,
          lastServiceAt: true,
          relationshipLevel: true,
        },
      }),
      computeFallbackSummary(professionalId, tutorId),
      findPetsForPair(professionalId, tutorId),
      findRequestsForPair(professionalId, tutorId, "professional"),
      findReviewsForPair(professionalId, tutorId),
    ])

  if (!tutor) return null

  return {
    tutor: {
      id: tutor.id,
      displayName: tutor.displayName,
      city: tutor.city,
      neighborhood: tutor.neighborhood,
    },
    summary: buildSummary(
      relationship
        ? {
            ...relationship,
            relationshipLevel: relationship.relationshipLevel as RelationshipLevel,
          }
        : null,
      fallback
    ),
    pets,
    requests,
    reviews,
  }
}

export async function getTutorProfessionalHistory(
  tutorId: string,
  professionalId: string
): Promise<TutorProfessionalHistory | null> {
  const allowed = await hasPairHistory(professionalId, tutorId)
  if (!allowed) return null

  const [professional, relationship, fallback, pets, requests, reviews] =
    await Promise.all([
      prisma.professionalProfile.findUnique({
        where: { id: professionalId },
        select: {
          id: true,
          displayName: true,
          city: true,
          avatarUrl: true,
          trustScore: true,
          isVerified: true,
          verifiedIdentity: true,
        },
      }),
      prisma.tutorProfessionalRelationship.findUnique({
        where: {
          tutorId_professionalId: { tutorId, professionalId },
        },
        select: {
          completedServices: true,
          totalRequests: true,
          lastServiceAt: true,
          relationshipLevel: true,
          firstServiceAt: true,
        },
      }),
      computeFallbackSummary(professionalId, tutorId),
      findPetsForPair(professionalId, tutorId),
      findRequestsForPair(professionalId, tutorId, "tutor"),
      findReviewsForPair(professionalId, tutorId),
    ])

  if (!professional) return null

  const verification = await getProfessionalVerificationContext(
    professionalId,
    {
      isVerified: professional.isVerified,
      verifiedIdentity: professional.verifiedIdentity,
    }
  )

  const summary = buildSummary(
    relationship
      ? {
          ...relationship,
          relationshipLevel: relationship.relationshipLevel as RelationshipLevel,
        }
      : null,
    fallback
  )

  const lastHiredRequest = await prisma.serviceRequest.findFirst({
    where: { professionalId, tutorId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  return {
    professional: {
      id: professional.id,
      displayName: professional.displayName,
      city: professional.city,
      avatarUrl: professional.avatarUrl,
      trustScore: professional.trustScore,
      verificationStatus: verification.operationalStatus,
    },
    summary: {
      ...summary,
      lastHiredAt: lastHiredRequest?.createdAt ?? null,
    },
    pets,
    requests,
    reviews,
  }
}
