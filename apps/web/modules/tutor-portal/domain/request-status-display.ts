/**
 * request-status-display — fonte única de tradução humana do RequestStatus
 * para a experiência do tutor (lista + detalhe).
 *
 * Antes desta etapa existiam DOIS mapas de status divergentes:
 *   - tutor-request-card.tsx: STATUS_BADGE (labels curtos, ex. "Aguardando")
 *   - [requestId]/page.tsx: STATUS_BADGE_STYLES (só cor, usava
 *     REQUEST_STATUS_LABELS para o texto, ex. "Aguardando resposta")
 * Cores e labels não coincidiam entre lista e detalhe. Este módulo
 * substitui os dois — nenhum enum novo, `RequestStatus` continua sendo o
 * único tipo de status (Service Request State Machine intocada).
 */

import type { RequestStatus } from "@/modules/service-request/domain/types"

export type RequestStatusTone = "pending" | "info" | "progress" | "success" | "neutral" | "danger"

export type RequestStatusMeta = {
  /** Label humano — usado no pill de status em lista e detalhe. */
  label: string
  tone: RequestStatusTone
  /** Frase curta de "o que fazer agora" — null quando não há ação/expectativa real. */
  nextStep: string | null
  /**
   * true = aparece na seção/aba "Ativos" da lista.
   * Classificação preservada da regra original (page.tsx anterior):
   * PENDING/ACCEPTED/IN_PROGRESS = ativos; DISPUTED já era tratado como
   * "Encerradas" (TERMINAL) no código atual — mantido aqui sem alteração.
   */
  isActive: boolean
}

export const REQUEST_STATUS_META: Record<RequestStatus, RequestStatusMeta> = {
  PENDING: {
    label: "Aguardando resposta do profissional",
    tone: "pending",
    nextStep: "O profissional ainda precisa responder.",
    isActive: true,
  },
  ACCEPTED: {
    label: "Solicitação aceita",
    tone: "info",
    nextStep: "Confira a data e combine os detalhes.",
    isActive: true,
  },
  IN_PROGRESS: {
    label: "Cuidado em andamento",
    tone: "progress",
    nextStep: "O atendimento está acontecendo.",
    isActive: true,
  },
  COMPLETED: {
    label: "Atendimento concluído",
    tone: "success",
    nextStep: "Avalie a experiência.",
    isActive: false,
  },
  CANCELLED_BY_TUTOR: {
    label: "Cancelado por você",
    tone: "neutral",
    nextStep: null,
    isActive: false,
  },
  CANCELLED_BY_PROFESSIONAL: {
    label: "Cancelado pelo profissional",
    tone: "neutral",
    nextStep: null,
    isActive: false,
  },
  DISPUTED: {
    label: "Em análise",
    tone: "danger",
    nextStep: "Acompanhe a análise do caso.",
    isActive: false,
  },
  EXPIRED: {
    label: "Solicitação expirada",
    tone: "neutral",
    nextStep: null,
    isActive: false,
  },
}

export const REQUEST_STATUS_TONE_CLASS: Record<RequestStatusTone, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  info: "bg-primary/10 text-primary",
  progress: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
}

export function isActiveRequestStatus(status: RequestStatus): boolean {
  return REQUEST_STATUS_META[status].isActive
}

/**
 * Cores do badge de status (reskin visual) — keyed por status, não por tone.
 * Separado de REQUEST_STATUS_TONE_CLASS porque o agrupamento visual novo não
 * bate 1:1 com os tones existentes (ex.: CANCELLED_BY_TUTOR e EXPIRED
 * compartilhavam o tone "neutral" mas agora têm cores diferentes).
 */
export const REQUEST_STATUS_COLORS: Record<
  RequestStatus,
  { bg: string; fg: string; dot: string }
> = {
  PENDING: { bg: "#FBF1DC", fg: "#9A6F16", dot: "#E0A93B" },
  ACCEPTED: { bg: "#E7F1EC", fg: "#2F6B4F", dot: "#40916C" },
  IN_PROGRESS: { bg: "#E8EEF6", fg: "#243B7A", dot: "#2C4893" },
  COMPLETED: { bg: "#F0EEE8", fg: "#6B6B63", dot: "#8A897F" },
  CANCELLED_BY_TUTOR: { bg: "#FBEDE8", fg: "#B4523F", dot: "#C7756A" },
  CANCELLED_BY_PROFESSIONAL: { bg: "#FBEDE8", fg: "#B4523F", dot: "#C7756A" },
  DISPUTED: { bg: "#FBF1DC", fg: "#9A6F16", dot: "#E0A93B" },
  EXPIRED: { bg: "#F0EEE8", fg: "#6B6B63", dot: "#8A897F" },
}
