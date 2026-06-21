/**
 * módulo: moderation
 * camada: domain
 *
 * Tipos de domínio para Flags Operacionais, Disputas e Auditoria Admin.
 */

export type FlagTargetType = "USER" | "PROFESSIONAL" | "REVIEW" | "REQUEST"
export type FlagSeverity   = "LOW"  | "MEDIUM" | "HIGH" | "CRITICAL"
export type FlagSource     = "SYSTEM" | "USER_REPORT" | "ADMIN"
export type FlagStatus     = "OPEN"   | "RESOLVED"    | "DISMISSED"
export type DisputeStatus  = "OPEN"   | "UNDER_REVIEW" | "RESOLVED" | "REJECTED"

export const FLAG_SEVERITY_LABELS: Record<FlagSeverity, string> = {
  LOW:      "Baixo",
  MEDIUM:   "Médio",
  HIGH:     "Alto",
  CRITICAL: "Crítico",
}

export const FLAG_SOURCE_LABELS: Record<FlagSource, string> = {
  SYSTEM:      "Sistema",
  USER_REPORT: "Relato de usuário",
  ADMIN:       "Admin",
}

export const FLAG_STATUS_LABELS: Record<FlagStatus, string> = {
  OPEN:      "Aberto",
  RESOLVED:  "Resolvido",
  DISMISSED: "Dispensado",
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN:         "Aberta",
  UNDER_REVIEW: "Em análise",
  RESOLVED:     "Resolvida",
  REJECTED:     "Rejeitada",
}

export type OperationalFlagData = {
  id:         string
  targetType: FlagTargetType
  targetId:   string
  reason:     string
  severity:   FlagSeverity
  source:     FlagSource
  status:     FlagStatus
  createdAt:  Date
  resolvedAt: Date | null
  resolvedBy: string | null
}

export type DisputeData = {
  id:          string
  requestId:   string
  openedBy:    string
  reason:      string
  description: string | null
  status:      DisputeStatus
  createdAt:   Date
  resolvedAt:  Date | null
  resolvedBy:  string | null
}

export type AdminAuditLogData = {
  id:         string
  adminId:    string
  action:     string
  entityType: string
  entityId:   string
  metadata:   Record<string, unknown> | null
  createdAt:  Date
}

// ── Rate limiting ──────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  SERVICE_REQUESTS_PER_DAY: 10,
  REVIEWS_PER_DAY:          20,
  FLAGS_PER_DAY:            20,
} as const

// ── Criação ───────────────────────────────────────────────────────────────────

export type CreateFlagInput = {
  targetType: FlagTargetType
  targetId:   string
  reason:     string
  severity?:  FlagSeverity
  source?:    FlagSource
}

export type CreateDisputeInput = {
  requestId:   string
  openedBy:    string
  reason:      string
  description?: string
}

export type CreateAdminAuditInput = {
  adminId:    string
  action:     string
  entityType: string
  entityId:   string
  metadata?:  Record<string, unknown>
}
