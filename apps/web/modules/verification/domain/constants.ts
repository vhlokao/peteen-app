/**
 * módulo: verification
 * camada: domain — constantes (Etapa 6.2)
 */

import type { VerificationEntityType, VerificationRequestStatus } from "./types"

export const VERIFICATION_ENTITY_TYPE_LABELS: Record<VerificationEntityType, string> = {
  PROFESSIONAL: "Profissional",
  PARTNER:      "Parceiro",
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationRequestStatus, string> = {
  PENDING:  "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
}

export const VERIFICATION_SEAL_LABELS = {
  active:    "Selo ativo",
  suspended: "Selo suspenso",
} as const
