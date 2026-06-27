/**
 * Módulo: professional-availability
 * Camada: infrastructure — persistência Prisma (MVP 7.6)
 */

import { prisma } from "@/lib/prisma/client"
import type { WeeklyAvailabilityInput, WeeklyAvailabilityRow } from "../domain/types"

function toRow(record: {
  weekday: number
  startTime: string
  endTime: string
  isActive: boolean
}): WeeklyAvailabilityRow {
  return {
    weekday: record.weekday,
    isActive: record.isActive,
    startTime: record.isActive ? record.startTime : null,
    endTime: record.isActive ? record.endTime : null,
  }
}

export async function findAvailabilityByProfessionalId(
  professionalProfileId: string
): Promise<WeeklyAvailabilityRow[]> {
  const rows = await prisma.professionalAvailability.findMany({
    where: { professionalProfileId },
    orderBy: { weekday: "asc" },
    select: {
      weekday: true,
      startTime: true,
      endTime: true,
      isActive: true,
    },
  })
  return rows.map(toRow)
}

export async function saveProfessionalWeeklyAvailability(
  professionalProfileId: string,
  days: WeeklyAvailabilityInput[]
): Promise<WeeklyAvailabilityRow[]> {
  await prisma.$transaction(
    days.map((day) =>
      prisma.professionalAvailability.upsert({
        where: {
          professionalProfileId_weekday: {
            professionalProfileId,
            weekday: day.weekday,
          },
        },
        create: {
          professionalProfileId,
          weekday: day.weekday,
          isActive: day.isActive,
          startTime: day.startTime ?? "00:00",
          endTime: day.endTime ?? "00:00",
        },
        update: {
          isActive: day.isActive,
          startTime: day.startTime ?? "00:00",
          endTime: day.endTime ?? "00:00",
        },
      })
    )
  )

  return findAvailabilityByProfessionalId(professionalProfileId)
}
