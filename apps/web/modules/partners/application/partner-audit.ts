/**
 * módulo: partners
 * camada: application — auditoria de eventos do parceiro (Etapa 6.1)
 *
 * Eventos de onboarding público são registrados via primeiro admin do sistema,
 * mantendo trilha unificada em AdminAuditLog.
 */

import { prisma } from "@/lib/prisma/client"
import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"

let cachedSystemAdminId: string | null = null

async function getSystemAdminUserId(): Promise<string | null> {
  if (cachedSystemAdminId) return cachedSystemAdminId

  const admin = await prisma.adminProfile.findFirst({
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  })

  cachedSystemAdminId = admin?.userId ?? null
  return cachedSystemAdminId
}

export async function recordPartnerAudit(
  action: string,
  partnerId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const adminId = await getSystemAdminUserId()
    if (!adminId) return

    await createAdminAudit({
      adminId,
      action,
      entityType: "PARTNER",
      entityId:   partnerId,
      metadata:   { source: "partner_onboarding", ...metadata },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
