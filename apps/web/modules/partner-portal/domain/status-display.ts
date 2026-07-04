import type { PartnerVerificationStatus } from "@/modules/partners/domain/types"

/**
 * Estados reais confirmados antes de implementar:
 * - Recomendação (TrustConnection): só existe isActive boolean -> "Ativa"/"Inativa".
 *   Não existe fluxo de aprovação/análise para recomendações — ao criar, a
 *   conexão já nasce ativa (sujeita a um limite antifraude de endossos).
 * - Verificação do parceiro (PartnerVerificationStatus): NONE, PENDING_VERIFICATION,
 *   VERIFIED — sem estado "suspenso" (isso é exclusivo do profissional).
 */

export type RecommendationTone = "success" | "neutral"

export function recommendationTone(isActive: boolean): RecommendationTone {
  return isActive ? "success" : "neutral"
}

export const RECOMMENDATION_TONE_CLASS: Record<RecommendationTone, string> = {
  success: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
}

export type VerificationTone = "success" | "pending" | "neutral"

export const PARTNER_VERIFICATION_TONE: Record<PartnerVerificationStatus, VerificationTone> = {
  NONE: "neutral",
  PENDING_VERIFICATION: "pending",
  VERIFIED: "success",
}

export const VERIFICATION_TONE_CLASS: Record<VerificationTone, string> = {
  success: "bg-success/10 text-success",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-muted text-muted-foreground",
}
