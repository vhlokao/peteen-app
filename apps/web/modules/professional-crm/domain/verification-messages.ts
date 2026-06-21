/**
 * Constantes de verificação — seguras para import em Client Components.
 * Sem imports de server modules ou helpers async.
 */

import type { ProfessionalVerificationStatus } from "./types"

export const OPERATIONAL_VERIFICATION_LABELS: Record<
  ProfessionalVerificationStatus,
  string
> = {
  verified: "Verificado",
  pending: "Verificação em análise",
  suspended: "Selo suspenso",
  not_verified: "Não verificado",
}

export const SUSPENDED_VERIFICATION_MESSAGE =
  "Seu selo de verificação está suspenso. Fale com o suporte/admin para reativação."
