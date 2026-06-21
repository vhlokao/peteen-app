"use server"

/**
 * módulo: trust-engine
 * camada: application
 *
 * recalculateAllTrustScores — backfill para profissionais com trustScore desatualizado.
 *
 * Necessário para:
 *   - Profissionais criados antes do hook updateProfessionalTrust existir
 *   - Ajustes nos pesos do Trust Engine (RANK_WEIGHTS ou RECURRENCE_SESSION_BONUS)
 *   - Qualquer drift entre trustScore no banco e o calculado em tempo real
 *
 * Design:
 *   - Processa sequencialmente para não sobrecarregar o banco
 *   - Retorna um relatório com successes, failures e detalhes
 *   - Seguro para reexecução (idempotente)
 */

import { prisma } from "@/lib/prisma/client"
import { updateProfessionalTrust } from "./update-professional-trust"

export type RecalculateReport = {
  total: number
  success: number
  failed: number
  skipped: number
  details: Array<{
    professionalId: string
    displayName: string
    previousScore: number
    newScore: number | null
    status: "updated" | "failed" | "skipped"
    error?: string
  }>
  durationMs: number
}

export async function recalculateAllTrustScores(): Promise<RecalculateReport> {
  const startedAt = Date.now()

  const professionals = await prisma.professionalProfile.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      trustScore: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const report: RecalculateReport = {
    total:   professionals.length,
    success: 0,
    failed:  0,
    skipped: 0,
    details: [],
    durationMs: 0,
  }

  for (const pro of professionals) {
    try {
      // Recalcula e persiste no banco
      await updateProfessionalTrust(pro.id)

      // Busca o novo score para o relatório
      const updated = await prisma.professionalProfile.findUnique({
        where: { id: pro.id },
        select: { trustScore: true },
      })

      report.success++
      report.details.push({
        professionalId: pro.id,
        displayName:    pro.displayName,
        previousScore:  pro.trustScore,
        newScore:       updated?.trustScore ?? null,
        status:         "updated",
      })
    } catch (err) {
      report.failed++
      report.details.push({
        professionalId: pro.id,
        displayName:    pro.displayName,
        previousScore:  pro.trustScore,
        newScore:       null,
        status:         "failed",
        error:          err instanceof Error ? err.message : String(err),
      })
    }
  }

  report.durationMs = Date.now() - startedAt
  return report
}
