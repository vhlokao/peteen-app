/**
 * módulo: trust-graph
 * camada: application
 *
 * Funções de consulta para consumo externo (Trust Engine, Badges, Profile).
 * Encapsula repository + domain scoring.
 */

import { getActiveConnectionsForProfessional, getActiveConnectionsBatch } from "../infrastructure/repository"
import { buildEndorsementSummary } from "../domain/scoring"
import type { ActiveConnection, TrustEndorsementSummary } from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getEndorsementSummary — retorna o resumo de endossos de um profissional.
 * Usado pelo Trust Engine e pelo perfil público.
 */
export async function getEndorsementSummary(
  professionalId: string
): Promise<TrustEndorsementSummary> {
  const connections = await getActiveConnectionsForProfessional(professionalId)
  return buildEndorsementSummary(connections)
}

/**
 * getPartnerEndorsements — retorna apenas as conexões de parceiros.
 * Usado pela seção "RECOMENDADO POR" no perfil público.
 */
export async function getPartnerEndorsements(
  professionalId: string
): Promise<ActiveConnection[]> {
  const connections = await getActiveConnectionsForProfessional(professionalId)
  return connections.filter(
    (c) => c.connectionType === "PARTNER_RECOMMENDS_PROFESSIONAL"
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH — para o Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getEndorsementSummaryBatch — resolve endorsements para N profissionais de uma vez.
 * Eficiente para o Recommendation Engine.
 */
export async function getEndorsementSummaryBatch(
  professionalIds: string[]
): Promise<Map<string, TrustEndorsementSummary>> {
  const connectionsMap = await getActiveConnectionsBatch(professionalIds)
  const result = new Map<string, TrustEndorsementSummary>()

  for (const id of professionalIds) {
    const connections = connectionsMap.get(id) ?? []
    result.set(id, buildEndorsementSummary(connections))
  }

  return result
}
