/**
 * Módulo: professional-availability
 * Camada: domain — tipos puros (MVP 7.6)
 */

export type WeeklyAvailabilityInput = {
  weekday: number
  isActive: boolean
  startTime: string | null
  endTime: string | null
}

export type WeeklyAvailabilityRow = {
  weekday: number
  isActive: boolean
  startTime: string | null
  endTime: string | null
}

export type PublicAvailabilityDay = {
  weekday: number
  label: string
  startTime: string
  endTime: string
}

export type SaveAvailabilityPayload = {
  days: WeeklyAvailabilityInput[]
}
