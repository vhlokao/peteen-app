/**
 * Módulo: disputes
 * Camada: domain — formatadores de UI (polish 7.8)
 */

import type { DisputeStatus } from "./types"
import { DISPUTE_STATUS_LABELS } from "./types"

export const DISPUTE_STATUS_COLORS: Record<DisputeStatus, string> = {
  OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  UNDER_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400",
}

export type DisputeBannerCopy = {
  title: string
  description: string
  tone: "attention" | "info" | "success" | "neutral"
}

export function getDisputeBannerCopy(status: DisputeStatus): DisputeBannerCopy {
  switch (status) {
    case "OPEN":
      return {
        title: "Este atendimento possui uma disputa aberta.",
        description:
          "A equipe Peteen pode analisar o caso para entender o que aconteceu. Isso não significa uma penalidade automática.",
        tone: "attention",
      }
    case "UNDER_REVIEW":
      return {
        title: "Esta disputa está em análise pela equipe Peteen.",
        description: "Aguarde a atualização do status.",
        tone: "info",
      }
    case "RESOLVED":
      return {
        title: "Esta disputa foi marcada como resolvida.",
        description: "O registro permanece no histórico desta solicitação.",
        tone: "success",
      }
    case "REJECTED":
      return {
        title: "Esta disputa foi encerrada sem alteração adicional.",
        description: "O registro permanece no histórico desta solicitação.",
        tone: "neutral",
      }
  }
}

export function formatDisputeStatusLabel(status: DisputeStatus): string {
  return DISPUTE_STATUS_LABELS[status]
}

export function formatShortId(id: string, length = 8): string {
  if (id.length <= length) return id
  return id.slice(0, length)
}
