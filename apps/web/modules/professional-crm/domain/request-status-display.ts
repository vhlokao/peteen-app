import type { RequestStatus } from "@/modules/service-request/domain/types"

/**
 * Status na perspectiva do profissional (Home operacional) — mesmos 8
 * estados reais da state machine, só a redação muda em relação ao
 * REQUEST_STATUS_LABELS central (que é neutro/perspectiva do tutor).
 * Nenhum estado novo, nenhuma transição alterada.
 */
export const PROFESSIONAL_REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Aguardando sua resposta",
  ACCEPTED: "Solicitação aceita",
  IN_PROGRESS: "Atendimento em andamento",
  COMPLETED: "Atendimento concluído",
  CANCELLED_BY_TUTOR: "Cancelado pelo tutor",
  CANCELLED_BY_PROFESSIONAL: "Cancelado por você",
  DISPUTED: "Em análise",
  EXPIRED: "Solicitação expirada",
}

export type ProfessionalRequestStatusTone = "pending" | "info" | "progress" | "success" | "neutral" | "danger"

export const PROFESSIONAL_REQUEST_STATUS_TONE: Record<RequestStatus, ProfessionalRequestStatusTone> = {
  PENDING: "pending",
  ACCEPTED: "info",
  IN_PROGRESS: "progress",
  COMPLETED: "success",
  CANCELLED_BY_TUTOR: "neutral",
  CANCELLED_BY_PROFESSIONAL: "neutral",
  DISPUTED: "danger",
  EXPIRED: "neutral",
}

export const PROFESSIONAL_REQUEST_STATUS_TONE_CLASS: Record<ProfessionalRequestStatusTone, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  info: "bg-primary/10 text-primary",
  progress: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
}
