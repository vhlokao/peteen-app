/**
 * módulo: relationship
 * camada: infrastructure — repositório
 *
 * Acesso ao banco para TutorProfessionalRelationship.
 *
 * Padrão de upsert em duas fases:
 *   1. Garantir que o registro existe (upsert atômico com incremento de contadores)
 *   2. Recalcular score e level a partir do estado atual
 *   3. Persistir score e level atualizados
 *
 * As duas fases são executadas em uma única transação para garantir consistência.
 */

import { prisma } from "@/lib/prisma/client"
import type {
  RelationshipEvent,
  TutorProfessionalRelationshipData,
  RelationshipAnalytics,
} from "../domain/types"
import {
  resolveRelationshipLevel,
  computeRelationshipScore,
} from "../domain/relationship-levels"
import { ANALYTICS_THRESHOLDS } from "../domain/constants"

// ─────────────────────────────────────────────────────────────────────────────
// upsertRelationship
//
// Aplica um evento ao relacionamento tutor↔profissional e persiste o resultado.
// Cria o registro se não existir. Toda a operação é atômica (transação).
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertRelationship(
  tutorId: string,
  professionalId: string,
  event: RelationshipEvent
): Promise<TutorProfessionalRelationshipData> {
  const now = event.type === "SERVICE_COMPLETED" ? event.serviceAt : new Date()

  const isCompletion = event.type === "SERVICE_COMPLETED"
  const isReview     = event.type === "REVIEW_GIVEN"
  const isTutorCancel = event.type === "CANCELLATION_BY_TUTOR"
  const isProCancel   = event.type === "CANCELLATION_BY_PRO"
  const isDispute     = event.type === "DISPUTE"

  const updated = await prisma.$transaction(async (tx) => {
    // ── Fase 1: garantir que o registro existe e buscar estado atual ──────────
    const existing = await tx.tutorProfessionalRelationship.findUnique({
      where: { tutorId_professionalId: { tutorId, professionalId } },
    })

    let record
    if (!existing) {
      // Cria com valores iniciais baseados no evento
      record = await tx.tutorProfessionalRelationship.create({
        data: {
          tutorId,
          professionalId,
          totalRequests:     isCompletion || isTutorCancel ? 1 : 0,
          completedServices: isCompletion ? 1 : 0,
          reviewsGiven:      isReview ? 1 : 0,
          cancelledByTutor:  isTutorCancel ? 1 : 0,
          cancelledByPro:    isProCancel ? 1 : 0,
          disputedServices:  isDispute ? 1 : 0,
          firstServiceAt:    isCompletion ? now : null,
          lastServiceAt:     isCompletion ? now : null,
        },
      })
    } else {
      // Incrementa contadores atomicamente
      record = await tx.tutorProfessionalRelationship.update({
        where: { id: existing.id },
        data: {
          ...(isCompletion || isTutorCancel ? { totalRequests: { increment: 1 } } : {}),
          ...(isCompletion ? { completedServices: { increment: 1 } } : {}),
          ...(isReview ? { reviewsGiven: { increment: 1 } } : {}),
          ...(isTutorCancel ? { cancelledByTutor: { increment: 1 } } : {}),
          ...(isProCancel ? { cancelledByPro: { increment: 1 } } : {}),
          ...(isDispute ? { disputedServices: { increment: 1 } } : {}),
          ...(isCompletion ? { lastServiceAt: now } : {}),
          ...(isCompletion && !existing.firstServiceAt ? { firstServiceAt: now } : {}),
        },
      })
    }

    // ── Fase 2: recalcula score e level a partir do estado atualizado ─────────
    const newScore = computeRelationshipScore({
      completedServices: record.completedServices,
      reviewsGiven:      record.reviewsGiven,
      cancelledByTutor:  record.cancelledByTutor,
      cancelledByPro:    record.cancelledByPro,
      disputedServices:  record.disputedServices,
    })
    const newLevel = resolveRelationshipLevel(record.completedServices)

    // ── Fase 3: persiste score e level ────────────────────────────────────────
    return tx.tutorProfessionalRelationship.update({
      where: { id: record.id },
      data: {
        relationshipScore: newScore,
        relationshipLevel: newLevel,
      },
    })
  })

  return updated as TutorProfessionalRelationshipData
}

// ─────────────────────────────────────────────────────────────────────────────
// findRelationship — busca o relacionamento entre um tutor e um profissional
// ─────────────────────────────────────────────────────────────────────────────

export async function findRelationship(
  tutorId: string,
  professionalId: string
): Promise<TutorProfessionalRelationshipData | null> {
  try {
    const record = await prisma.tutorProfessionalRelationship.findUnique({
      where: { tutorId_professionalId: { tutorId, professionalId } },
    })
    return record as TutorProfessionalRelationshipData | null
  } catch (err) {
    console.error("[findRelationship] tabela indisponível:", err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipAnalytics
//
// Métricas públicas de recorrência de um profissional.
// Chamado no perfil público /discover/[professionalId].
// ─────────────────────────────────────────────────────────────────────────────

const ZERO_ANALYTICS: RelationshipAnalytics = {
  totalRelationships:   0,
  recurringClients:     0,
  trustedClients:       0,
  partnerClients:       0,
  avgCompletedServices: 0,
  maxCompletedServices: 0,
}

export async function getRelationshipAnalytics(
  professionalId: string
): Promise<RelationshipAnalytics> {
  try {
    const [relationships, agg] = await Promise.all([
      prisma.tutorProfessionalRelationship.findMany({
        where:  { professionalId },
        select: { completedServices: true },
      }),
      prisma.tutorProfessionalRelationship.aggregate({
        where: { professionalId },
        _count: { id: true },
        _avg:   { completedServices: true },
        _max:   { completedServices: true },
      }),
    ])

    const recurringClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.RECURRING
    ).length

    const trustedClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.TRUSTED
    ).length

    const partnerClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.PARTNER
    ).length

    return {
      totalRelationships:   agg._count.id,
      recurringClients,
      trustedClients,
      partnerClients,
      avgCompletedServices: Math.round((agg._avg.completedServices ?? 0) * 10) / 10,
      maxCompletedServices: agg._max.completedServices ?? 0,
    }
  } catch (err) {
    console.error("[getRelationshipAnalytics] tabela indisponível:", err)
    return ZERO_ANALYTICS
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipStatsForRanking
//
// Versão eficiente para o Ranking Engine — uma query para N profissionais.
// Retorna um Map de professionalId → stats de relacionamento.
// Evita N+1 ao rankear múltiplos candidatos.
// ─────────────────────────────────────────────────────────────────────────────

export type RankingRelationshipStats = {
  totalRelationships: number
  recurringClients:   number  // completedServices >= ANALYTICS_THRESHOLDS.RECURRING
  trustedClients:     number  // completedServices >= ANALYTICS_THRESHOLDS.TRUSTED
  partnerClients:     number  // completedServices >= ANALYTICS_THRESHOLDS.PARTNER
}

export async function getRelationshipStatsForRanking(
  professionalIds: string[]
): Promise<Map<string, RankingRelationshipStats>> {
  if (professionalIds.length === 0) return new Map()

  let rows: Array<{ professionalId: string; completedServices: number }>
  try {
    rows = await prisma.tutorProfessionalRelationship.findMany({
      where:  { professionalId: { in: professionalIds } },
      select: { professionalId: true, completedServices: true },
    })
  } catch (err) {
    console.error("[getRelationshipStatsForRanking] tabela indisponível, sem boost:", err)
    return new Map()
  }

  const map = new Map<string, RankingRelationshipStats>()

  for (const row of rows) {
    const existing = map.get(row.professionalId) ?? {
      totalRelationships: 0,
      recurringClients:   0,
      trustedClients:     0,
      partnerClients:     0,
    }

    existing.totalRelationships++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.RECURRING) existing.recurringClients++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.TRUSTED)   existing.trustedClients++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.PARTNER)   existing.partnerClients++

    map.set(row.professionalId, existing)
  }

  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// getMyRelationshipsForProfessionals
//
// Para a página /discover — retorna um Map de professionalId → completedServices
// do tutor autenticado, em uma única query para todos os candidatos.
// Evita N+1 ao renderizar a lista de cards.
// ─────────────────────────────────────────────────────────────────────────────

export async function getMyRelationshipsForProfessionals(
  tutorId: string,
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (!tutorId || professionalIds.length === 0) return new Map()

  try {
    const records = await prisma.tutorProfessionalRelationship.findMany({
      where:  { tutorId, professionalId: { in: professionalIds } },
      select: { professionalId: true, completedServices: true },
    })
    return new Map(records.map((r) => [r.professionalId, r.completedServices]))
  } catch (err) {
    console.error("[getMyRelationshipsForProfessionals] tabela indisponível:", err)
    return new Map()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipsByProfessional
//
// Para recalcular o Trust Score — retorna pares (tutorId, completedServices)
// de todos os relacionamentos de um profissional.
// Substitui a query raw de ServiceRequest COMPLETED no Trust Engine.
//
// Falha silenciosa: retorna [] se a tabela não existir ou o client estiver
// desatualizado (ex: dev server não reiniciado após prisma generate).
// O Trust Engine possui fallback para ServiceRequest nesse caso.
// ─────────────────────────────────────────────────────────────────────────────

export async function getRelationshipsByProfessional(
  professionalId: string
): Promise<Array<{ tutorId: string; completedServices: number }>> {
  try {
    return await prisma.tutorProfessionalRelationship.findMany({
      where:  { professionalId },
      select: { tutorId: true, completedServices: true },
    })
  } catch (err) {
    console.error("[getRelationshipsByProfessional] fallback para ServiceRequest:", err)
    return []
  }
}
