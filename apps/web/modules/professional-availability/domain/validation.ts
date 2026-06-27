/**
 * Módulo: professional-availability
 * Camada: domain — validação pura de horários (MVP 7.6)
 */

import { TIME_PATTERN, WEEKDAY_DEFINITIONS } from "./constants"
import type { WeeklyAvailabilityInput } from "./types"

const VALID_WEEKDAYS = new Set<number>(WEEKDAY_DEFINITIONS.map((d) => d.weekday))

function parseMinutes(time: string): number {
  const parts = time.split(":").map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

export function normalizeTimeInput(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (!TIME_PATTERN.test(trimmed)) return null
  return trimmed
}

export function validateWeeklyAvailability(
  days: WeeklyAvailabilityInput[]
): { valid: true; days: WeeklyAvailabilityInput[] } | { valid: false; error: string } {
  if (!Array.isArray(days) || days.length !== WEEKDAY_DEFINITIONS.length) {
    return { valid: false, error: "Confira os horários informados antes de salvar." }
  }

  const seen = new Set<number>()
  const normalized: WeeklyAvailabilityInput[] = []

  for (const day of days) {
    if (!VALID_WEEKDAYS.has(day.weekday) || seen.has(day.weekday)) {
      return { valid: false, error: "Confira os horários informados antes de salvar." }
    }
    seen.add(day.weekday)

    if (!day.isActive) {
      normalized.push({
        weekday: day.weekday,
        isActive: false,
        startTime: null,
        endTime: null,
      })
      continue
    }

    const startTime = normalizeTimeInput(day.startTime)
    const endTime = normalizeTimeInput(day.endTime)

    if (!startTime || !endTime) {
      return { valid: false, error: "Confira os horários informados antes de salvar." }
    }

    if (parseMinutes(endTime) <= parseMinutes(startTime)) {
      return { valid: false, error: "Confira os horários informados antes de salvar." }
    }

    normalized.push({
      weekday: day.weekday,
      isActive: true,
      startTime,
      endTime,
    })
  }

  return { valid: true, days: normalized }
}
