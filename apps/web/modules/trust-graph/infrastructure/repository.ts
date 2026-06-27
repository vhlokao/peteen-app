/**
 * módulo: trust-graph
 * camada: infrastructure — repository
 *
 * Acesso ao banco de dados para TrustConnection.
 * Única camada com Prisma neste módulo.
 */

import { prisma } from "@/lib/prisma/client"
import { Prisma } from "@prisma/client"
import type {
  TrustConnection,
  ActiveConnection,
  AdminTrustConnectionRow,
  CreateTrustConnectionInput,
  TrustConnectionType,
  TrustSourceType,
} from "../domain/types"
import { TRUST_CONNECTION_WEIGHTS } from "../domain/constants"

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

/** Busca conexões ativas para um profissional (para Trust Engine e badges) */
export async function getActiveConnectionsForProfessional(
  targetId: string
): Promise<ActiveConnection[]> {
  try {
    const rows = await prisma.trustConnection.findMany({
      where: { targetId, isActive: true },
      select: { id: true, connectionType: true, weight: true, sourceType: true, sourceName: true },
      orderBy: { weight: "desc" },
    })
    return rows.map((r) => ({
      ...r,
      connectionType: r.connectionType as TrustConnectionType,
      sourceType:     r.sourceType as unknown as ActiveConnection["sourceType"],
    }))
  } catch {
    return []
  }
}

/** Busca todas as conexões ativas para vários profissionais de uma vez (batch) */
export async function getActiveConnectionsBatch(
  targetIds: string[]
): Promise<Map<string, ActiveConnection[]>> {
  const result = new Map<string, ActiveConnection[]>()
  if (targetIds.length === 0) return result

  try {
    const rows = await prisma.trustConnection.findMany({
      where: { targetId: { in: targetIds }, isActive: true },
      select: { id: true, targetId: true, connectionType: true, weight: true, sourceType: true, sourceName: true },
    })

    for (const row of rows) {
      const list = result.get(row.targetId) ?? []
      list.push({
        id:             row.id,
        connectionType: row.connectionType as TrustConnectionType,
        weight:         row.weight,
        sourceType:     row.sourceType as unknown as ActiveConnection["sourceType"],
        sourceName:     row.sourceName,
      })
      result.set(row.targetId, list)
    }
  } catch {
    // fallback gracioso: retorna mapa vazio
  }

  return result
}

/** Lista todas as conexões (para o admin) com nome do profissional alvo */
export async function getAllConnectionsAdmin(filters?: {
  sourceType?: TrustSourceType
  connectionType?: TrustConnectionType
  isActive?: boolean
}): Promise<AdminTrustConnectionRow[]> {
  const where: Prisma.TrustConnectionWhereInput = {}
  if (filters?.sourceType)      where.sourceType      = filters.sourceType
  if (filters?.connectionType)  where.connectionType  = filters.connectionType
  if (filters?.isActive !== undefined) where.isActive = filters.isActive

  try {
    const rows = await prisma.trustConnection.findMany({
      where,
      include: { targetProfile: { select: { displayName: true } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    })

    return rows.map((r) => ({
      id:             r.id,
      sourceType:     r.sourceType as unknown as TrustConnection["sourceType"],
      sourceId:       r.sourceId,
      sourceName:     r.sourceName,
      targetType:     r.targetType as unknown as TrustConnection["targetType"],
      targetId:       r.targetId,
      connectionType: r.connectionType as TrustConnectionType,
      weight:         r.weight,
      isActive:       r.isActive,
      createdAt:      r.createdAt,
      updatedAt:      r.updatedAt,
      targetName:     r.targetProfile.displayName,
    }))
  } catch {
    return []
  }
}

/** Conta total de conexões ativas (para dashboard) */
export async function countActiveConnections(): Promise<number> {
  try {
    return await prisma.trustConnection.count({ where: { isActive: true } })
  } catch {
    return 0
  }
}

/**
 * Conta conexões ativas de uma fonte específica, opcionalmente filtradas por tipo.
 *
 * Guardrail antifraude MVP:
 *   Usado para verificar se um parceiro atingiu o limite de endossos ativos
 *   antes de criar ou reativar uma TrustConnection.
 */
export async function countActiveConnectionsBySource(
  sourceId: string,
  connectionType?: TrustConnectionType
): Promise<number> {
  try {
    return await prisma.trustConnection.count({
      where: {
        sourceId,
        isActive: true,
        ...(connectionType ? { connectionType } : {}),
      },
    })
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCRITA
// ─────────────────────────────────────────────────────────────────────────────

/** Cria nova conexão de confiança. Lança erro se duplicada. */
export async function createTrustConnection(
  input: CreateTrustConnectionInput
): Promise<TrustConnection> {
  const weight = input.weight ?? TRUST_CONNECTION_WEIGHTS[input.connectionType]

  const row = await prisma.trustConnection.create({
    data: {
      sourceType:      input.sourceType,
      sourceId:        input.sourceId,
      sourceName:      input.sourceName,
      sourcePartnerId: input.sourcePartnerId ?? null,
      targetId:        input.targetId,
      connectionType:  input.connectionType,
      weight,
    },
  })

  return {
    ...row,
    sourceType:     row.sourceType as unknown as TrustConnection["sourceType"],
    targetType:     row.targetType as unknown as TrustConnection["targetType"],
    connectionType: row.connectionType as TrustConnectionType,
  }
}

/** Altera isActive de uma conexão */
export async function setConnectionActive(
  id: string,
  isActive: boolean
): Promise<void> {
  await prisma.trustConnection.update({ where: { id }, data: { isActive } })
}
