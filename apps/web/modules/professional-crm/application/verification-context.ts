/**
 * Módulo: professional-crm
 * Camada: application — contexto operacional de verificação
 */

import { findPendingVerificationRequest } from "@/modules/verification/infrastructure/repository"
import { hasApprovedVerificationRequest } from "@/modules/verification/infrastructure/repository"
import type { ProfessionalVerificationStatus } from "../domain/types"
import { resolveOperationalVerificationStatus } from "../domain/verification-status"

export type ProfessionalVerificationContext = {
  operationalStatus: ProfessionalVerificationStatus
  hasApprovedRequest: boolean
  hasPendingRequest: boolean
}

export async function getProfessionalVerificationContext(
  professionalId: string,
  profile: { isVerified: boolean; verifiedIdentity: boolean }
): Promise<ProfessionalVerificationContext> {
  const [pending, hasApprovedRequest] = await Promise.all([
    findPendingVerificationRequest("PROFESSIONAL", professionalId),
    hasApprovedVerificationRequest("PROFESSIONAL", professionalId),
  ])

  const hasPendingRequest = pending !== null
  const operationalStatus = resolveOperationalVerificationStatus(
    profile,
    hasApprovedRequest,
    hasPendingRequest
  )

  return { operationalStatus, hasApprovedRequest, hasPendingRequest }
}

// Re-export para consumo nas páginas
export { resolveOperationalVerificationStatus } from "../domain/verification-status"
