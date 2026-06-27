/**
 * Módulo: disputes
 * Camada: domain — tipos e constantes de disputas (MVP 7.4)
 */

export const DISPUTE_REASON_OPTIONS = [
  "Serviço não realizado",
  "Serviço incompleto",
  "Problema com o profissional",
  "Outro",
] as const

export type DisputeReason = (typeof DISPUTE_REASON_OPTIONS)[number]

/** Status persistidos no schema (UNDER_REVIEW = "Em análise" na UI) */
export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED"

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
}

export const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ["OPEN", "UNDER_REVIEW"]

export type DisputeSummary = {
  id: string
  requestId: string
  reason: string
  description: string | null
  status: DisputeStatus
  createdAt: Date
  resolvedAt: Date | null
}

export type AdminDisputeListRow = DisputeSummary & {
  tutorName: string
  professionalName: string
  serviceLabel: string
}

export type CreateDisputeFormInput = {
  reason: DisputeReason
  description?: string
}
