/**
 * Módulo: disputes
 * Camada: infrastructure — auditoria via AuditLog
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { DisputeStatus, DisputeSummary } from "../domain/types"

export type DisputeAuditAction = "dispute.created" | "dispute.status_updated"

function disputeAuditPayload(dispute: DisputeSummary): Record<string, unknown> {
  return {
    id: dispute.id,
    requestId: dispute.requestId,
    reason: dispute.reason,
    status: dispute.status,
    description: dispute.description,
  }
}

export async function recordDisputeAudit(
  userId: string,
  action: DisputeAuditAction,
  dispute: DisputeSummary,
  before?: DisputeSummary | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "Dispute",
        entityId: dispute.id,
        before: before
          ? (disputeAuditPayload(before) as Prisma.InputJsonValue)
          : undefined,
        after: disputeAuditPayload(dispute) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}

export function toDisputeSummary(row: {
  id: string
  requestId: string
  reason: string
  description: string | null
  status: string
  createdAt: Date
  resolvedAt: Date | null
}): DisputeSummary {
  return {
    id: row.id,
    requestId: row.requestId,
    reason: row.reason,
    description: row.description,
    status: row.status as DisputeStatus,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}
