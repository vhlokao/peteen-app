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

/**
 * Próximo passo curto para o card da lista (UX 3.8B). Só os estados com
 * orientação real recebem texto — estados terminais sem ação (cancelado,
 * expirado) ficam null e o card não exibe a linha.
 */
export const PROFESSIONAL_REQUEST_CARD_NEXT_STEP: Partial<Record<RequestStatus, string>> = {
  PENDING: "Você ainda precisa aceitar ou recusar.",
  ACCEPTED: "Combine os detalhes antes do atendimento.",
  IN_PROGRESS: "O atendimento está acontecendo.",
  COMPLETED: "Este atendimento foi finalizado.",
  DISPUTED: "O caso está em análise.",
}

/**
 * "O que fazer agora" — bloco principal do detalhe (UX 3.8B). Cobre os 8
 * estados reais, sem ação inventada — a ação em si (aceitar/recusar/
 * iniciar/concluir) continua vindo do RequestActions já existente.
 */
export const PROFESSIONAL_REQUEST_NOW_STEP: Record<RequestStatus, string> = {
  PENDING: "Analise os dados e responda à solicitação.",
  ACCEPTED: "Combine os últimos detalhes com o tutor.",
  IN_PROGRESS: "O atendimento está em andamento.",
  COMPLETED: "O atendimento foi concluído.",
  CANCELLED_BY_TUTOR: "O tutor cancelou esta solicitação.",
  CANCELLED_BY_PROFESSIONAL: "Você cancelou esta solicitação.",
  DISPUTED: "Este atendimento está em análise.",
  EXPIRED: "O prazo para responder expirou.",
}

/** CTA principal do card — texto de navegação, não dispara transição alguma. */
export const PROFESSIONAL_REQUEST_CARD_CTA: Partial<Record<RequestStatus, string>> = {
  PENDING: "Responder",
  ACCEPTED: "Ver atendimento",
  IN_PROGRESS: "Continuar",
  COMPLETED: "Ver histórico",
}

export type ProfessionalRequestGroup = "new" | "ongoing" | "history"

/**
 * Classificação Novas/Em andamento/Histórico — conferida contra o
 * comportamento real: só PENDING/ACCEPTED/IN_PROGRESS têm alguma ação
 * disponível (RequestActions); todo o resto (COMPLETED e os 4 estados
 * terminais) não tem nenhuma transição possível, por isso cai junto em
 * Histórico.
 */
export const PROFESSIONAL_REQUEST_GROUP: Record<RequestStatus, ProfessionalRequestGroup> = {
  PENDING: "new",
  ACCEPTED: "ongoing",
  IN_PROGRESS: "ongoing",
  COMPLETED: "history",
  CANCELLED_BY_TUTOR: "history",
  CANCELLED_BY_PROFESSIONAL: "history",
  DISPUTED: "history",
  EXPIRED: "history",
}
