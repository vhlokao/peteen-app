/**
 * Módulo: professional-availability
 * Camada: domain — formatação para UI (MVP 7.6)
 */

import { WEEKDAY_DEFINITIONS, WEEKDAY_LABELS } from "./constants"
import type { PublicAvailabilityDay, WeeklyAvailabilityRow } from "./types"

export function buildDefaultWeeklyAvailability(): WeeklyAvailabilityRow[] {
  return WEEKDAY_DEFINITIONS.map((d) => ({
    weekday: d.weekday,
    isActive: false,
    startTime: null,
    endTime: null,
  }))
}

export function mergeWithDefaults(
  rows: WeeklyAvailabilityRow[]
): WeeklyAvailabilityRow[] {
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]))
  return WEEKDAY_DEFINITIONS.map((d) => {
    const existing = byWeekday.get(d.weekday)
    return (
      existing ?? {
        weekday: d.weekday,
        isActive: false,
        startTime: null,
        endTime: null,
      }
    )
  })
}

export function toPublicAvailabilityDays(
  rows: WeeklyAvailabilityRow[]
): PublicAvailabilityDay[] {
  return rows
    .filter((r) => r.isActive && r.startTime && r.endTime)
    .sort((a, b) => a.weekday - b.weekday)
    .map((r) => ({
      weekday: r.weekday,
      label: WEEKDAY_LABELS[r.weekday] ?? `Dia ${r.weekday}`,
      startTime: r.startTime!,
      endTime: r.endTime!,
    }))
}

export function formatPublicAvailabilityLine(day: PublicAvailabilityDay): string {
  return `${day.label}, das ${day.startTime} às ${day.endTime}`
}
