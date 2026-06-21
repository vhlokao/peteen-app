/**
 * módulo: relationship
 * camada: domain — tipos
 *
 * TutorProfessionalRelationship é a entidade central do diferencial do Peteen.
 * Representa o vínculo contínuo e crescente entre um tutor e um profissional.
 *
 * Princípio: uma pessoa voltar para o mesmo profissional vale mais
 * do que uma nova avaliação isolada.
 */

// ─────────────────────────────────────────────────────────────────────────────
// NÍVEL DE RELACIONAMENTO
// Derivado de completedServices — nunca de score
// ─────────────────────────────────────────────────────────────────────────────

export type RelationshipLevel = "NEW" | "KNOWN" | "RECURRING" | "TRUSTED" | "PARTNER"

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS — disparam atualizações no relacionamento
// ─────────────────────────────────────────────────────────────────────────────

export type RelationshipEvent =
  | { type: "SERVICE_COMPLETED"; serviceAt: Date }
  | { type: "REVIEW_GIVEN" }
  | { type: "CANCELLATION_BY_TUTOR" }
  | { type: "CANCELLATION_BY_PRO" }
  | { type: "DISPUTE" }

// ─────────────────────────────────────────────────────────────────────────────
// ENTIDADE DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

export type TutorProfessionalRelationshipData = {
  id: string
  tutorId: string
  professionalId: string

  // Contadores
  totalRequests: number
  completedServices: number
  reviewsGiven: number
  cancelledByTutor: number
  cancelledByPro: number
  disputedServices: number

  // Timeline
  firstServiceAt: Date | null
  lastServiceAt: Date | null

  // Score e nível
  relationshipScore: number
  relationshipLevel: RelationshipLevel

  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — métricas públicas de recorrência de um profissional
// ─────────────────────────────────────────────────────────────────────────────

export type RelationshipAnalytics = {
  /** Total de tutores que já contrataram este profissional */
  totalRelationships: number
  /** Tutores com 3+ atendimentos (nível RECURRING ou superior) */
  recurringClients: number
  /** Tutores com 5+ atendimentos (nível TRUSTED ou superior) */
  trustedClients: number
  /** Tutores com 10+ atendimentos (nível PARTNER) */
  partnerClients: number
  /** Média de atendimentos por tutor */
  avgCompletedServices: number
  /** Máximo de atendimentos por um único tutor */
  maxCompletedServices: number
}

// ─────────────────────────────────────────────────────────────────────────────
// PADRÃO DE RETORNO — alinhado com o resto do sistema
// ─────────────────────────────────────────────────────────────────────────────

export type RelationshipActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
