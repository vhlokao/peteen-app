/**
 * módulo: backoffice
 * camada: domain
 *
 * Tipos de domínio do Backoffice Admin.
 * Contratos puros — sem dependências de Prisma, Supabase ou UI.
 */

export type AdminDashboardMetrics = {
  totalUsers: number
  totalTutors: number
  totalProfessionals: number
  totalPets: number
  totalRequests: number
  pendingRequests: number
  completedRequests: number
  totalReviews: number
  averageTrustScore: number
  professionalsWithStaleScore: number
  recurringRelationships: number
  // Etapa 5.5 — Moderação
  openFlags: number
  openDisputes: number
  hiddenReviews: number
  // Etapa 5.8 — Trust Graph
  activeTrustConnections: number
  // Etapa 5.9 — Parceiros
  activePartners: number
  verifiedPartners: number
  professionalsRecommendedByPartners: number
}

export type AdminUserRow = {
  id: string
  email: string
  roles: string[]
  activePrimaryRole: string | null
  createdAt: Date
  onboardingCompletedAt: Date | null
  lastSeenAt: Date | null
}

export type AdminTutorRow = {
  id: string
  displayName: string
  city: string
  state: string
  petCount: number
  requestCount: number
  reviewCount: number
  createdAt: Date
}

export type AdminProfessionalRow = {
  id: string
  displayName: string
  city: string
  state: string
  serviceTypes: string[]
  trustScore: number
  trustLevel: string
  trustUpdatedAt: Date | null
  reviewCount: number
  averageRating: number | null
  completedServices: number
  recurringClients: number
  createdAt: Date
}

export type AdminRequestRow = {
  id: string
  tutorName: string
  professionalName: string
  petName: string | null
  serviceType: string
  status: string
  scheduledAt: Date | null
  createdAt: Date
  completedAt: Date | null
}

export type AdminReviewRow = {
  id:               string
  tutorName:        string
  professionalName: string
  rating:           number
  comment:          string | null
  serviceType:      string
  petSpecies:       string
  isVisible:        boolean
  isFlagged:        boolean
  hiddenByAdmin:    boolean
  hiddenReason:     string | null
  createdAt:        Date
}

export type AdminTrustRow = {
  id: string
  displayName: string
  city: string
  trustScore: number
  trustLevel: string
  trustUpdatedAt: Date | null
  reviewCount: number
  completedServices: number
}

export type AdminRelationshipRow = {
  id: string
  tutorName: string
  professionalName: string
  completedServices: number
  totalRequests: number
  reviewsGiven: number
  relationshipScore: number
  relationshipLevel: string
  firstServiceAt: Date | null
  lastServiceAt: Date | null
}

export type AdminFlagRow = {
  id:         string
  targetType: string
  targetId:   string
  reason:     string
  severity:   string
  source:     string
  status:     string
  createdAt:  Date
  resolvedAt: Date | null
}

export type AdminDisputeRow = {
  id:               string
  requestId:        string
  tutorName:        string
  professionalName: string
  reason:           string
  description:      string | null
  status:           string
  createdAt:        Date
  resolvedAt:       Date | null
}

export type AdminAuditRow = {
  id:           string
  /** Email de quem executou a ação (admin ou usuário da plataforma). */
  actorEmail:   string
  actorKind:    "admin" | "user"
  action:       string
  entityType:   string
  entityId:     string
  entityLabel:  string | null
  metadata:     Record<string, unknown> | null
  createdAt:    Date
}

export type AdminRiskRow = {
  id:          string
  displayName: string
  city:        string
  score:       number
  level:       string
}

// ── Filtros ────────────────────────────────────────────────────────────────────

export type AdminUsersFilter = {
  role?: string
  email?: string
}

export type AdminRequestsFilter = {
  status?: string
  serviceType?: string
}

export type AdminRelationshipsFilter = {
  relationshipLevel?: string
}

export type AdminFlagsFilter = {
  status?:     string
  severity?:   string
  targetType?: string
}

export type AdminDisputesFilter = {
  status?: string
}

export type AdminAuditFilter = {
  action?:     string
  entityType?: string
}
