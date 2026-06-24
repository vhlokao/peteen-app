/**
 * Módulo: professional-services
 * Camada: infrastructure — auditoria via AuditLog
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { ServiceData } from "@/modules/professional/domain/types"

export type ServiceAuditAction =
  | "professional.service_created"
  | "professional.service_updated"
  | "professional.service_activated"
  | "professional.service_deactivated"

function serviceAuditPayload(service: ServiceData): Record<string, unknown> {
  return {
    id: service.id,
    professionalId: service.professionalId,
    name: service.name,
    serviceType: service.serviceType,
    priceMin: service.priceMin,
    priceMax: service.priceMax,
    isActive: service.isActive,
  }
}

export async function recordServiceAudit(
  userId: string,
  action: ServiceAuditAction,
  service: ServiceData,
  before?: ServiceData | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "Service",
        entityId: service.id,
        before: before
          ? (serviceAuditPayload(before) as Prisma.InputJsonValue)
          : undefined,
        after: serviceAuditPayload(service) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
