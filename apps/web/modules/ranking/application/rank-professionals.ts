/**
 * módulo: ranking
 * camada: application
 *
 * rankProfessionals — ponto de entrada do Ranking Engine.
 *
 * Recebe candidatos já filtrados por cidade/serviço (DB layer)
 * e os reordena contextualmente (application layer).
 *
 * Arquitetura de duas fases:
 *   1. DB fetcha candidatos filtrados (findPublicProfessionals)
 *   2. Ranking Engine reordena com contexto semântico (esta função)
 *
 * A separação permite:
 *   - Substituir o scoring em Fase 6 sem mudar a query
 *   - Testabilidade isolada do ranking
 *   - Fallback seguro: se ranking falha, usa trustScore DESC (já ordenado pelo DB)
 *
 * Fase 6: substituir fetchContextualStats + computeRankScore por modelo de ML.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import { getRelationshipStatsForRanking } from "@/modules/relationship/infrastructure/repository"
import type { ProfessionalPublicProfile, ServiceType } from "@/modules/professional/domain/types"
import type {
  RankContext,
  RankedProfile,
  ProfessionalRankStats,
  ProfessionalRelationshipStats,
  ServiceTypeStats,
} from "../domain/types"
import { computeRankScore } from "../domain/scoring"

// ─────────────────────────────────────────────────────────────────────────────
// fetchContextualStats
//
// Uma única query para todos os candidatos, agrupada por (professionalId, serviceType).
// Retorna um Map de professionalId → stats contextuais.
//
// Tabelas reais (via @@map no schema Prisma):
//   Review         → reviews
//   ServiceRequest → service_requests
// ─────────────────────────────────────────────────────────────────────────────

type ContextualStatsRow = {
  professionalId: string
  serviceType: string
  count: number
  avgRating: number
}

async function fetchContextualStats(
  professionalIds: string[]
): Promise<Map<string, Pick<ProfessionalRankStats, "reviewsByServiceType">>> {
  if (professionalIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<ContextualStatsRow[]>`
    SELECT
      sr."professionalId",
      r."serviceType",
      COUNT(r.id)::int     AS "count",
      AVG(r.rating)::float AS "avgRating"
    FROM reviews r
    JOIN service_requests sr ON sr.id = r."requestId"
    WHERE sr."professionalId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(professionalIds)}]::text[]`})
      AND r."isVisible" = true
      AND r."isFlagged" = false
    GROUP BY sr."professionalId", r."serviceType"
  `

  // fetchContextualStats retorna apenas reviewsByServiceType.
  // relationships é injetado em rankProfessionals via getRelationshipStatsForRanking.
  const map = new Map<string, Pick<ProfessionalRankStats, "reviewsByServiceType">>()

  for (const row of rows) {
    const existing = map.get(row.professionalId)
    const stat: ServiceTypeStats = {
      count:     Number(row.count),
      avgRating: Number(row.avgRating),
    }

    if (existing) {
      existing.reviewsByServiceType[row.serviceType as ServiceType] = stat
    } else {
      map.set(row.professionalId, {
        reviewsByServiceType: { [row.serviceType as ServiceType]: stat },
      })
    }
  }

  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// rankProfessionals — ponto de entrada público
// ─────────────────────────────────────────────────────────────────────────────

const ZERO_RELATIONSHIP: ProfessionalRelationshipStats = {
  totalRelationships: 0,
  recurringClients:   0,
  trustedClients:     0,
  partnerClients:     0,
}

export async function rankProfessionals(
  professionals: ProfessionalPublicProfile[],
  context: RankContext
): Promise<RankedProfile[]> {
  if (professionals.length === 0) return []

  try {
    const professionalIds = professionals.map((p) => p.id)

    // Duas queries paralelas para todos os candidatos:
    //   1. Reviews contextuais por serviceType (Fase 5.2)
    //   2. Stats de relacionamento por recorrência (Fase 5.3)
    const [statsMap, relationshipMap] = await Promise.all([
      fetchContextualStats(professionalIds),
      getRelationshipStatsForRanking(professionalIds),
    ])

    const ranked = professionals.map((pro) => {
      const stats: ProfessionalRankStats = {
        reviewsByServiceType: statsMap.get(pro.id)?.reviewsByServiceType ?? {},
        relationships:        relationshipMap.get(pro.id) ?? ZERO_RELATIONSHIP,
      }
      const breakdown = computeRankScore(pro, context, stats)
      return {
        ...pro,
        rankScore:        breakdown.total,
        rankBreakdown:    breakdown,
        relationshipStats: relationshipMap.get(pro.id) ?? ZERO_RELATIONSHIP,
      } satisfies RankedProfile
    })

    // Score maior = melhor posição
    // Desempate 1: averageRating DESC
    // Desempate 2: reviewCount DESC
    // Desempate 3: trustScore DESC
    ranked.sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
      const ratingA = a.averageRating ?? 0
      const ratingB = b.averageRating ?? 0
      if (ratingB !== ratingA) return ratingB - ratingA
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
      return b.trustScore - a.trustScore
    })

    return ranked
  } catch (err) {
    // Fallback seguro: retorna candidatos com ranking = trustScore (já ordenados pelo DB)
    console.error("[rankProfessionals]", err)
    return professionals.map((pro) => ({
      ...pro,
      rankScore: pro.trustScore,
      rankBreakdown: {
        trustBase:            pro.trustScore * 0.4,
        serviceCompatibility: 0,
        contextualReviews:    0,
        overallRating:        0,
        reviewVolume:         0,
        relationshipBoost:    0,
        total:                pro.trustScore * 0.4,
      },
      relationshipStats: ZERO_RELATIONSHIP,
    }))
  }
}
