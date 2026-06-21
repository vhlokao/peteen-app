/**
 * módulo: ranking
 * camada: domain — funções puras de scoring
 *
 * Zero dependências externas. Zero acesso ao banco.
 * Toda a lógica de ranking é determinística e testável de forma isolada.
 *
 * Princípio de design:
 *   Preço NÃO é fator de ranking.
 *   Recorrência e contexto valem mais que avaliação bruta.
 *   Trust Score é a base — não o único critério.
 */

import type { ProfessionalPublicProfile } from "@/modules/professional/domain/types"
import type {
  RankContext,
  ProfessionalRankStats,
  RankScoreBreakdown,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// PESOS
//
// Todos os parâmetros do ranking estão aqui.
// Alterar aqui afeta todos os resultados de discovery.
//
// Score máximo teórico: ~90 pts (profissional perfeito, contexto total)
// Score mínimo: 0 (profissional novo, sem histórico)
// ─────────────────────────────────────────────────────────────────────────────

export const RANK_WEIGHTS = {
  /**
   * Multiplicador do Trust Score (0–100) para score base.
   * Trust Score 80 → 80 × 0.40 = 32 pts base.
   * Limita o Trust Score a 40% do score total — impede monopolização.
   */
  TRUST_BASE: 0.40,

  /**
   * Boost por oferecer o serviço buscado.
   * Profissional com catálogo compatível sobe na lista contextual.
   */
  SERVICE_COMPATIBILITY: 15,

  /**
   * Boost por cada review contextual (mesmo serviceType buscado).
   * Ex: 5 reviews de DOG_WALK = 5 × 2 = 10 pts (capped).
   */
  CONTEXTUAL_REVIEW_COUNT:     2,
  CONTEXTUAL_REVIEW_COUNT_MAX: 10,

  /**
   * Boost da média contextual (reviews do mesmo serviceType).
   * Avg 5.0 = 10 pts. Avg 4.0 = 8 pts. Avg 3.0 = 6 pts.
   */
  CONTEXTUAL_AVG_RATING_MAX: 10,

  /**
   * Boost da média geral de avaliações.
   * Avg 5.0 = 15 pts máx.
   */
  OVERALL_AVG_RATING_MAX: 15,

  /**
   * Boost por volume total de reviews (diversidade de clientes).
   * 0.5 pt por review, capped em 10 pts.
   */
  REVIEW_VOLUME:     0.5,
  REVIEW_VOLUME_MAX: 10,

  /**
   * Boost de relacionamento — recorrência real de clientes.
   *
   * Filosofia: um profissional que tutores voltam a contratar vale mais
   * do que um profissional com avaliações altas mas sem histórico de retorno.
   *
   * Pesos por nível de relacionamento:
   *   RECURRING (3+ atendimentos): +1.5 pt por cliente
   *   TRUSTED (5+ atendimentos):   +3.0 pt por cliente
   *   PARTNER (10+ atendimentos):  +5.0 pt por cliente
   *
   * Cap: 15 pts — impede que um profissional com poucos tutores fiéis
   * domine completamente o ranking sobre profissionais com mais diversidade.
   *
   * Score máximo teórico com relacionamento: ~105 pts
   * (40 trust + 15 service + 20 contextual + 15 rating + 10 volume + 15 relationship)
   */
  RECURRING_CLIENT:       1.5,
  TRUSTED_CLIENT:         3.0,
  PARTNER_CLIENT:         5.0,
  RELATIONSHIP_BOOST_MAX: 15,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// computeRankScore — função pura de scoring
//
// Recebe o perfil, o contexto de busca e as stats contextuais.
// Retorna o breakdown auditável com o total.
// ─────────────────────────────────────────────────────────────────────────────

export function computeRankScore(
  pro: Pick<
    ProfessionalPublicProfile,
    "trustScore" | "services" | "averageRating" | "reviewCount"
  >,
  ctx: RankContext,
  stats: ProfessionalRankStats
): RankScoreBreakdown {
  // ── 1. Trust Score base (0–40 pts) ─────────────────────────────────────
  const trustBase = pro.trustScore * RANK_WEIGHTS.TRUST_BASE

  // ── 2. Compatibilidade de serviço (0–15 pts) ────────────────────────────
  let serviceCompatibility = 0
  if (ctx.serviceType) {
    const offersService = pro.services.some((s) => s.serviceType === ctx.serviceType)
    if (offersService) serviceCompatibility = RANK_WEIGHTS.SERVICE_COMPATIBILITY
  }

  // ── 3. Reviews contextuais (mesmo serviceType) (0–20 pts) ───────────────
  let contextualReviews = 0
  if (ctx.serviceType) {
    const ctxStats = stats.reviewsByServiceType[ctx.serviceType]
    if (ctxStats && ctxStats.count > 0) {
      const fromCount = Math.min(
        ctxStats.count * RANK_WEIGHTS.CONTEXTUAL_REVIEW_COUNT,
        RANK_WEIGHTS.CONTEXTUAL_REVIEW_COUNT_MAX
      )
      const fromRating = (ctxStats.avgRating / 5) * RANK_WEIGHTS.CONTEXTUAL_AVG_RATING_MAX
      contextualReviews = fromCount + fromRating
    }
  }

  // ── 4. Média geral de avaliações (0–15 pts) ─────────────────────────────
  const overallRating =
    pro.averageRating !== null
      ? (pro.averageRating / 5) * RANK_WEIGHTS.OVERALL_AVG_RATING_MAX
      : 0

  // ── 5. Volume de reviews (0–10 pts) ─────────────────────────────────────
  const reviewVolume = Math.min(
    pro.reviewCount * RANK_WEIGHTS.REVIEW_VOLUME,
    RANK_WEIGHTS.REVIEW_VOLUME_MAX
  )

  // ── 6. Boost de relacionamento (0–15 pts) ─────────────────────────────
  // Recorrência real de clientes — diferencial do Peteen vs marketplace genérico.
  // Tutores recorrentes (RECURRING/TRUSTED/PARTNER) amplificam a posição no ranking.
  const rel = stats.relationships
  const rawRelBoost =
    rel.recurringClients * RANK_WEIGHTS.RECURRING_CLIENT +
    rel.trustedClients   * RANK_WEIGHTS.TRUSTED_CLIENT   +
    rel.partnerClients   * RANK_WEIGHTS.PARTNER_CLIENT

  const relationshipBoost = Math.min(rawRelBoost, RANK_WEIGHTS.RELATIONSHIP_BOOST_MAX)

  const total =
    trustBase + serviceCompatibility + contextualReviews +
    overallRating + reviewVolume + relationshipBoost

  return {
    trustBase:            r1(trustBase),
    serviceCompatibility: r1(serviceCompatibility),
    contextualReviews:    r1(contextualReviews),
    overallRating:        r1(overallRating),
    reviewVolume:         r1(reviewVolume),
    relationshipBoost:    r1(relationshipBoost),
    total:                r1(total),
  }
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}
