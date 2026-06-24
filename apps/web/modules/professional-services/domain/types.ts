/**
 * Módulo: professional-services
 * Camada: domain — tipos para gestão contínua de serviços
 */

import type { ServiceData, ServiceType } from "@/modules/professional/domain/types"

export type ProfessionalServiceRow = ServiceData

export type ProfessionalServiceFormInput = {
  name: string
  description?: string
  serviceType: ServiceType
  /** Preço base — mapeado para priceMin no modelo */
  basePrice?: number
}

export type ProfessionalServiceUpdateInput = {
  name?: string
  description?: string
  serviceType?: ServiceType
  basePrice?: number
}

export function formatServiceBasePrice(service: Pick<ServiceData, "priceMin" | "priceMax">): string {
  const min = service.priceMin
  const max = service.priceMax

  if (min != null && max != null && min !== max) {
    return `R$ ${min.toFixed(2)} – R$ ${max.toFixed(2)}`
  }
  const value = min ?? max
  if (value != null) {
    return `R$ ${value.toFixed(2)}`
  }
  return "—"
}

export function summarizeDescription(description: string | null, maxLen = 80): string {
  if (!description?.trim()) return "—"
  const trimmed = description.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}
