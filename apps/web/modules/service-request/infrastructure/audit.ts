/**
 * Módulo: service-request
 * Camada: infrastructure — auditoria via AuditLog
 *
 * Mesmo padrão de modules/disputes/infrastructure/audit.ts: fire-and-forget,
 * nunca propaga erro — auditoria nunca deve quebrar o fluxo principal.
 */

import { prisma } from "@/lib/prisma/client"

export async function recordRequestAudit(
  userId: string,
  action: string,
  requestId: string,
  before: { status: string },
  after: { status: string }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "ServiceRequest",
        entityId: requestId,
        before,
        after,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
