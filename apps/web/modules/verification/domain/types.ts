/**
 * módulo: verification
 * camada: domain — tipos puros (Etapa 6.2)
 */

export type VerificationEntityType = "PROFESSIONAL" | "PARTNER"

export type VerificationRequestStatus = "PENDING" | "APPROVED" | "REJECTED"

export type VerificationRequest = {
  id: string
  entityType: VerificationEntityType
  entityId: string
  status: VerificationRequestStatus
  requestedAt: Date
  reviewedAt: Date | null
  reviewedByAdminId: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type VerificationLifecycleEvent = {
  action: "verification.suspended" | "verification.reactivated"
  adminEmail: string
  createdAt: Date
  reason: string | null
}

export type VerificationAdminRow = VerificationRequest & {
  entityName: string
  reviewedByAdminEmail: string | null
  /** Estado operacional atual da entidade (selo ativo ou não) */
  entityIsVerified: boolean
  entityIsSuspended: boolean
  canSuspend: boolean
  canReactivate: boolean
  lastLifecycleEvent: VerificationLifecycleEvent | null
}

export type VerificationMetrics = {
  pending: number
  approved: number
  rejected: number
}

export type VerificationListFilters = {
  entityType?: VerificationEntityType
  status?: VerificationRequestStatus
}

export type CreateVerificationRequestInput = {
  entityType: VerificationEntityType
  entityId: string
  notes?: string
  requestedAt?: Date
}
