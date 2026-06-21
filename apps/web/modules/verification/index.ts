/**
 * módulo: verification — Etapa 6.2
 */

export type {
  VerificationEntityType,
  VerificationRequestStatus,
  VerificationRequest,
  VerificationAdminRow,
  VerificationMetrics,
  VerificationLifecycleEvent,
} from "./domain/types"

export {
  VERIFICATION_ENTITY_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_SEAL_LABELS,
} from "./domain/constants"

export {
  isProfessionalVerificationActive,
  isPartnerVerificationActive,
} from "./domain/verification-state"
