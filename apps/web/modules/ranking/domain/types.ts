/**
 * módulo: ranking
 * camada: domain — tipos
 *
 * O Ranking Engine recebe candidatos (já filtrados por cidade/serviço)
 * e os reordena com base em contexto semântico: qual profissional é
 * a melhor escolha para ESTE pet, ESTE tipo de serviço, NESTE momento.
 *
 * Fase 5.2: ranking determinístico com pesos explícitos.
 * Fase 6:   substituir por modelo de scoring personalizado por tutor.
 * Fase 7:   integrar sinais de densidade local e sazonalidade.
 */

import type { ProfessionalPublicProfile, ServiceType } from "@/modules/professional/domain/types"
import type { Species } from "@/modules/tutor/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTO DE BUSCA
//
// Informa ao Ranking Engine quais dimensões contextuais estão ativas.
// Campos ausentes = sem boost contextual para aquela dimensão.
// ─────────────────────────────────────────────────────────────────────────────

export type RankContext = {
  /** Tipo de serviço buscado pelo tutor */
  serviceType?: ServiceType
  /**
   * Espécie do pet — boost em reviews contextualmente compatíveis.
   * Fase 5.2: não implementado (requer autenticação do tutor na busca).
   * Fase 6: receber via petContext do tutor autenticado.
   */
  petSpecies?: Species
  /** Raça do pet — refinamento futuro */
  petBreed?: string
  /**
   * Cidade do tutor (busca ativa ou perfil) — boost de proximidade
   * (Proximity V1). Ausente = sem boost de localização para ninguém.
   */
  tutorCity?: string
  /**
   * Bairro do tutor — boost adicional de proximidade (Proximity V1).
   * Só tem efeito se tutorCity também estiver presente e bater.
   */
  tutorNeighborhood?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS CONTEXTUAIS POR PROFISSIONAL
//
// Agregados de reviews por serviceType — fetched em uma única query para
// todos os candidatos, evitando N+1.
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceTypeStats = {
  /** Número de reviews para este serviceType */
  count: number
  /** Média de rating para este serviceType */
  avgRating: number
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS DE RELACIONAMENTO POR PROFISSIONAL
//
// Dados de recorrência para o boost de relacionamento no ranking.
// Fetched em uma única query para todos os candidatos, evitando N+1.
// ─────────────────────────────────────────────────────────────────────────────

export type ProfessionalRelationshipStats = {
  totalRelationships: number
  recurringClients:   number  // completedServices >= 3
  trustedClients:     number  // completedServices >= 5
  partnerClients:     number  // completedServices >= 10
}

export type ProfessionalRankStats = {
  reviewsByServiceType: Partial<Record<ServiceType, ServiceTypeStats>>
  relationships: ProfessionalRelationshipStats
}

// ─────────────────────────────────────────────────────────────────────────────
// RANK SCORE BREAKDOWN
//
// Decomposição auditável do score de ranking.
// Permite exibir na UI "por que este profissional está nesta posição".
// ─────────────────────────────────────────────────────────────────────────────

export type RankScoreBreakdown = {
  /** Contribuição do Trust Score (base) */
  trustBase: number
  /** Boost por oferecer o serviço buscado */
  serviceCompatibility: number
  /** Boost por reviews contextuais (mesmo serviceType) */
  contextualReviews: number
  /** Contribuição da média geral de avaliações */
  overallRating: number
  /** Contribuição do volume total de avaliações */
  reviewVolume: number
  /**
   * Boost por recorrência e relacionamentos.
   * Profissionais com tutores recorrentes, confiáveis e parceiros sobem no ranking.
   * Fase 5.3: calculado a partir de TutorProfessionalRelationship.
   */
  relationshipBoost: number
  /**
   * Boost por proximidade — mesma cidade e/ou bairro do tutor.
   * Proximity V1: match textual (cidade/bairro), sem distância geográfica real.
   */
  locationScore: number
  /** Score total de ranking */
  total: number
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKED PROFILE
//
// Extensão de ProfessionalPublicProfile com dados de ranking.
// Transparente para ProfessionalCard — todos os campos originais estão presentes.
// ─────────────────────────────────────────────────────────────────────────────

export type RankedProfile = ProfessionalPublicProfile & {
  rankScore: number
  rankBreakdown: RankScoreBreakdown
  /**
   * Stats de relacionamento do profissional — exposto para a UI de discovery.
   * Permite mostrar "X tutores voltaram" no card sem uma query adicional,
   * pois os dados já foram carregados no ranking.
   */
  relationshipStats: ProfessionalRelationshipStats
}
