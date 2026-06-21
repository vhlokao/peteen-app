/**
 * módulo: badges
 * camada: domain
 *
 * Tipos para o sistema de Badges e Selos de Verificação do Peteen.
 *
 * Não é gamificação. É legibilidade de confiança.
 * Badges são conquistados por comportamento real, não por pontos.
 */

// ── Badges (conquistados por comportamento) ───────────────────────────────────

export type BadgeType =
  | "FIRST_CLIENT"      // completedServices >= 1
  | "RECURRING"         // completedServices >= 3
  | "TRUSTED"           // trustScore >= 25
  | "HIGHLY_RATED"      // reviewCount >= 5 AND averageRating >= 4.5
  | "EXPERT"            // reviewCount >= 10
  | "PARTNER_ENDORSED"  // Etapa 5.8: pelo menos 1 parceiro ativo recomendando

// ── Selos de Verificação (concedidos manualmente pelo sistema) ─────────────

export type VerificationSeal =
  | "VERIFIED_PROFILE"  // Ativável via Backoffice — isVerified no DB
  | "VERIFIED_IDENTITY" // Arquitetura futura — verifiedIdentity no DB
  | "VERIFIED_PHONE"    // Arquitetura futura — verifiedPhone no DB
  | "VERIFIED_PARTNER"  // Arquitetura futura — verifiedPartner no DB

// ── Dados enriquecidos ────────────────────────────────────────────────────────

export type BadgeData = {
  type:        BadgeType
  label:       string
  description: string
  emoji:       string
}

export type VerificationData = {
  type:        VerificationSeal
  label:       string
  description: string
  emoji:       string
  active:      boolean
  activatable: boolean  // true = pode ser ativado via Backoffice hoje
  /** Oculto na UI pública até existir fluxo documental dedicado */
  internalOnly?: boolean
}

// ── Input para o resolver (dados brutos, sem dependência de DB) ───────────────

export type BadgeInput = {
  completedServices:   number
  trustScore:          number
  reviewCount:         number
  averageRating:       number | null
  // Selos de verificação
  verifiedProfile:     boolean  // = isVerified no ProfessionalProfile
  verifiedIdentity:    boolean
  verifiedPhone:       boolean
  verifiedPartner:     boolean
  // Etapa 5.8 — Trust Graph
  partnerEndorsements: number   // total de parceiros ativos recomendando este profissional
}

export type BadgeResolverResult = {
  badges:        BadgeData[]
  verifications: VerificationData[]
}
