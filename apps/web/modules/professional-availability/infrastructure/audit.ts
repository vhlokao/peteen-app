/**
 * Módulo: professional-availability
 * Camada: infrastructure — auditoria via AuditLog (MVP 7.6)
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { WeeklyAvailabilityRow } from "../domain/types"

export type AvailabilityAuditAction = "professional.availability_updated"

function availabilityAuditPayload(
  professionalProfileId: string,
  days: WeeklyAvailabilityRow[]
): Record<string, unknown> {
  return {
    professionalProfileId,
    activeDays: days.filter((d) => d.isActive).length,
    schedule: days.map((d) => ({
      weekday: d.weekday,
      isActive: d.isActive,
      startTime: d.startTime,
      endTime: d.endTime,
    })),
  }
}

export async function recordAvailabilityAudit(
  userId: string,
  professionalProfileId: string,
  after: WeeklyAvailabilityRow[],
  before: WeeklyAvailabilityRow[] | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "professional.availability_updated",
        entity: "ProfessionalProfile",
        entityId: professionalProfileId,
        before: before
          ? (availabilityAuditPayload(professionalProfileId, before) as Prisma.InputJsonValue)
          : undefined,
        after: availabilityAuditPayload(
          professionalProfileId,
          after
        ) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
