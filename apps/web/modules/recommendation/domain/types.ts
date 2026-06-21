/**
 * módulo: recommendation
 * camada: domain
 *
 * Tipos para o Motor de Recomendações do Peteen.
 *
 * Princípio: sem IA, sem ML — regras determinísticas com dados já existentes.
 * Fatores: cidade, serviço, Trust Score, badges, recorrência, avaliações, verificação, trust graph.
 */

import type { ServiceType, TrustLevel } from "@/modules/professional/domain/types"

// ── Fator individual ──────────────────────────────────────────────────────────

/** Um fator que contribuiu para o score de recomendação com seu peso em pontos. */
export type RecommendationFactor = {
  key:    string
  label:  string
  points: number
}

// ── Score calculado ───────────────────────────────────────────────────────────

/** Score calculado para um profissional em determinado contexto de tutor. */
export type RecommendationScore = {
  professionalId: string
  totalScore:     number             // 0–100
  factors:        RecommendationFactor[]
  mainReason:     string             // label do fator de maior peso
}

// ── Input para o scorer (sem IO) ──────────────────────────────────────────────

/**
 * Dados necessários para calcular o score de recomendação.
 * Função pura — sem efeitos colaterais, sem dependências externas.
 */
export type RecommendationInput = {
  professionalId:           string
  professionalCity:         string
  professionalServiceTypes: ServiceType[]
  trustScore:               number
  isVerified:               boolean
  activeBadgeCount:         number
  reviewCount:              number
  averageRating:            number | null
  recurringClientsCount:    number    // tutores com 3+ sessões com este profissional
  tutorCompletedServices:   number    // pessoal: qtd vezes o tutor atual já contratou
  tutorCity:                string | null
  tutorNeighborhood:        string | null
  tutorRegionId:            string | null
  tutorNeighborhoodId:      string | null
  professionalNeighborhood: string | null
  professionalRegionId:     string | null
  professionalNeighborhoodId: string | null
  requestedServiceType:     ServiceType | null
  // Etapa 5.8 — Trust Graph
  partnerEndorsements:      number    // parceiros ativos recomendando este profissional
  professionalEndorsements: number    // profissionais ativos recomendando
  tutorEndorsements:        number    // tutores ativos recomendando
}

// ── Profissional enriquecido para UI ─────────────────────────────────────────

/** Profissional com score e dados para exibição nos blocos de recomendação. */
export type RecommendedProfessional = {
  professionalId: string
  displayName:    string
  city:           string
  state:          string
  avatarUrl:      string | null
  trustScore:     number
  trustLevel:     TrustLevel
  isVerified:     boolean
  serviceTypes:   ServiceType[]
  reviewCount:    number
  averageRating:  number | null
  score:          RecommendationScore
}

// ── Blocos de recomendação ────────────────────────────────────────────────────

/** Identificadores dos 5 blocos de recomendação do Discovery. */
export type RecommendationBlockId =
  | "for_you"          // Recomendados para você — score geral com contexto pessoal
  | "top_rated"        // Bem avaliados — rating >= 4.0 com min reviews
  | "recurring"        // Tutores que voltaram — clientes recorrentes >= 2
  | "verified"         // Verificados pelo Peteen — isVerified = true
  | "partner_endorsed" // Etapa 5.8 — recomendados por parceiros da rede

/** Um bloco de recomendações com título, descrição e lista de profissionais. */
export type RecommendationBlock = {
  id:            RecommendationBlockId
  title:         string
  description:   string
  professionals: RecommendedProfessional[]
}

// ── Contexto do tutor ─────────────────────────────────────────────────────────

/** Contexto do tutor para personalização das recomendações. */
export type RecommendationContext = {
  tutorCity:            string | null
  tutorNeighborhood:    string | null
  tutorRegionId:        string | null
  tutorNeighborhoodId:  string | null
  requestedServiceType: ServiceType | null
  /** professionalId → completedServices do tutor atual (recorrência pessoal) */
  myRelMap:             Map<string, number>
}
