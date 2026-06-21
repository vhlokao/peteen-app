/**
 * módulo: antifraude
 * camada: application
 *
 * calculateRiskScore — calcula o Risk Score de um profissional em tempo real.
 *
 * Composição:
 *   - Flags OPEN contra o profissional
 *   - Disputas abertas em solicitações do profissional
 *   - Reviews ocultadas pelo admin
 *   - Taxa de cancelamentos pelo profissional
 *
 * Não persiste o score — calculado sob demanda para manter auditabilidade.
 */

import { prisma } from "@/lib/prisma/client"
import { computeRiskScore, type RiskScoreResult } from "../domain/risk-score"

export async function calculateRiskScore(
  professionalId: string
): Promise<RiskScoreResult> {
  const [openFlags, disputes, hiddenReviews, requestStats] = await Promise.all([
    // Flags OPEN direcionadas a este profissional
    prisma.operationalFlag.count({
      where: {
        targetType: "PROFESSIONAL",
        targetId:   professionalId,
        status:     "OPEN",
      },
    }),

    // Disputas em solicitações deste profissional
    prisma.dispute.count({
      where: {
        request: { professionalId },
      },
    }),

    // Reviews ocultadas pelo admin
    prisma.review.count({
      where: {
        request:      { professionalId },
        hiddenByAdmin: true,
      },
    }),

    // Totais de solicitações e cancelamentos pelo profissional
    prisma.serviceRequest.aggregate({
      where:  { professionalId },
      _count: { id: true },
    }).then(async (total) => {
      const cancelled = await prisma.serviceRequest.count({
        where: { professionalId, status: "CANCELLED_BY_PROFESSIONAL" },
      })
      return { total: total._count.id, cancelled }
    }),
  ])

  return computeRiskScore({
    openFlags,
    totalDisputes:  disputes,
    hiddenReviews,
    cancelledByPro: requestStats.cancelled,
    totalRequests:  requestStats.total,
  })
}

// ── Batch para o backoffice ────────────────────────────────────────────────────

export type ProfessionalRiskRow = {
  professionalId: string
  displayName:    string
  score:          number
  level:          string
}

export async function calculateAllRiskScores(): Promise<ProfessionalRiskRow[]> {
  const professionals = await prisma.professionalProfile.findMany({
    where:  { deletedAt: null },
    select: { id: true, displayName: true },
  })

  const results: ProfessionalRiskRow[] = []

  for (const pro of professionals) {
    try {
      const risk = await calculateRiskScore(pro.id)
      results.push({
        professionalId: pro.id,
        displayName:    pro.displayName,
        score:          risk.score,
        level:          risk.level,
      })
    } catch {
      results.push({
        professionalId: pro.id,
        displayName:    pro.displayName,
        score:          0,
        level:          "LOW",
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
