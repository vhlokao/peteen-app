/**
 * módulo: trust-graph
 * camada: domain — tipos
 *
 * Entidades e contratos do Trust Graph.
 * Puro — sem Prisma, sem IO, sem dependências externas.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type TrustConnectionType =
  | "PARTNER_RECOMMENDS_PROFESSIONAL"
  | "TUTOR_RECOMMENDS_PROFESSIONAL"
  | "PROFESSIONAL_RECOMMENDS_PROFESSIONAL"

export type TrustSourceType = "PARTNER" | "TUTOR" | "PROFESSIONAL"

export type TrustTargetType = "PROFESSIONAL"

// ─────────────────────────────────────────────────────────────────────────────
// ENTIDADE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export type TrustConnection = {
  id: string
  sourceType: TrustSourceType
  sourceId: string
  sourceName: string
  targetType: TrustTargetType
  targetId: string
  connectionType: TrustConnectionType
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJEÇÕES — subconjuntos usados nas diferentes camadas
// ─────────────────────────────────────────────────────────────────────────────

/** Conexão ativa com dados mínimos para cálculo de score */
export type ActiveConnection = Pick<
  TrustConnection,
  "id" | "connectionType" | "weight" | "sourceType" | "sourceName"
>

/** Resumo de endossos agrupados por tipo de origem */
export type TrustEndorsementSummary = {
  partnerEndorsements: number
  professionalEndorsements: number
  tutorEndorsements: number
  totalBonus: number
  connections: ActiveConnection[]
}

/** Linha para exibição no admin /admin/trust-graph */
export type AdminTrustConnectionRow = TrustConnection & {
  targetName: string // displayName do profissional alvo
}

/** Input para criação de conexão */
export type CreateTrustConnectionInput = {
  sourceType: TrustSourceType
  sourceId: string
  sourceName: string
  targetId: string
  connectionType: TrustConnectionType
  weight?: number
  /** Etapa 5.9 — FK para entidade Partner real */
  sourcePartnerId?: string
}
