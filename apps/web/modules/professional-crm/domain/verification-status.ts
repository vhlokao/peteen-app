/**
 * Módulo: professional-crm
 * Estado operacional de verificação — alinhado ao Verification Engine (Etapa 6.2).
 *
 * VerificationRequest APPROVED = histórico.
 * Selo ativo = isProfessionalVerificationActive(profile).
 */

import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import type { ProfessionalVerificationStatus } from "./types"

export {
  OPERATIONAL_VERIFICATION_LABELS,
  SUSPENDED_VERIFICATION_MESSAGE,
} from "./verification-messages"

export function resolveOperationalVerificationStatus(
  profile: { isVerified: boolean; verifiedIdentity: boolean },
  approvedRequest: boolean,
  pendingRequest: boolean
): ProfessionalVerificationStatus {
  if (isProfessionalVerificationActive(profile)) return "verified"
  if (pendingRequest) return "pending"
  if (approvedRequest) return "suspended"
  return "not_verified"
}
