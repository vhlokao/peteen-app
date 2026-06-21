/**
 * Módulo: review
 * Camada: domain
 *
 * A review é o fechamento do loop de confiança do Peteen.
 * Sem review, o Trust Score não cresce, o Ranking não evolui e o Trust Graph não existe.
 *
 * Decisões de design críticas:
 *
 *   1. Uma review por ServiceRequest — enforced pelo schema (@unique requestId)
 *      e verificado na application layer antes de qualquer escrita.
 *
 *   2. PetContext como snapshot imutável — a reputação contextual do profissional
 *      é válida para AQUELE animal, naquele estado, naquele momento.
 *      Modificações futuras no pet não alteram reviews passadas.
 *
 *   3. serviceType obrigatório no domínio — uma review de banho é diferente
 *      de uma review de hospedagem, mesmo do mesmo profissional.
 *      O Ranking Engine usa essa distinção para rankings contextuais.
 *
 *   4. TrustEvents emitidos passivamente — a review não "calcula" o Trust Score.
 *      Ela apenas registra o evento. O Trust Engine o processa de forma assíncrona.
 *
 *   5. Proteções antifraude como dados do domínio — as constantes de rate limiting
 *      e janelas de tempo estão declaradas aqui, não espalhadas em código de aplicação.
 */

import { z } from "zod"
import type { ActionResult } from "@/modules/tutor/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"
import type { PetContextSnapshot, Species } from "@/modules/tutor/domain/types"
import type { TrustEventType } from "@/modules/service-request/domain/types"

export type { ActionResult }

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE DOMÍNIO — antifraude e limites
//
// Representadas como dados, não como números mágicos no código.
// Alterar um limite aqui afeta todo o sistema automaticamente.
// ─────────────────────────────────────────────────────────────────────────────

export const REVIEW_LIMITS = {
  /** Máximo de reviews que um tutor pode criar em 24 horas */
  MAX_REVIEWS_PER_DAY: 5,

  /** Reviews de requests concluídos há mais de 30 dias são bloqueadas */
  MAX_DAYS_AFTER_COMPLETION: 30,

  /** Se rating <= 2, comentário é obrigatório com ao menos este tamanho */
  MIN_COMMENT_LENGTH_FOR_NEGATIVE: 20,

  /** Comentário máximo */
  MAX_COMMENT_LENGTH: 1000,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// MAPEAMENTO DE TRUST EVENTS
//
// Relação entre rating e evento de confiança.
// Declarado como dado para que o Trust Engine possa ajustar pesos via configuração.
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewTrustMapping = {
  type: TrustEventType
  weight: number
  label: string
}

export const RATING_TO_TRUST_EVENT: Readonly<Record<1 | 2 | 3 | 4 | 5, ReviewTrustMapping>> = {
  1: { type: "REVIEW_NEGATIVE", weight: -4.0, label: "Avaliação muito negativa" },
  2: { type: "REVIEW_NEGATIVE", weight: -2.5, label: "Avaliação negativa" },
  3: { type: "REVIEW_NEUTRAL",  weight:  0.5, label: "Avaliação neutra" },
  4: { type: "REVIEW_POSITIVE", weight:  2.0, label: "Avaliação positiva" },
  5: { type: "REVIEW_POSITIVE", weight:  3.5, label: "Avaliação muito positiva" },
} as const

/** Retorna o mapeamento de trust para um dado rating (1-5) */
export function getTrustMappingForRating(rating: number): ReviewTrustMapping {
  const clamped = Math.max(1, Math.min(5, Math.round(rating))) as 1 | 2 | 3 | 4 | 5
  return RATING_TO_TRUST_EVENT[clamped]
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DE VALIDAÇÃO — CreateReview
// ─────────────────────────────────────────────────────────────────────────────

export const CreateReviewSchema = z
  .object({
    requestId: z.string().min(1, "Solicitação é obrigatória"),
    rating: z
      .number({ error: () => "Rating deve ser um número" })
      .int("Rating deve ser um número inteiro")
      .min(1, "Rating mínimo é 1")
      .max(5, "Rating máximo é 5"),
    comment: z
      .string()
      .max(REVIEW_LIMITS.MAX_COMMENT_LENGTH, `Comentário pode ter no máximo ${REVIEW_LIMITS.MAX_COMMENT_LENGTH} caracteres`)
      .optional(),
  })
  .refine(
    (data) => {
      // Reviews negativas exigem comentário substantivo
      // Antifraude: impede "review drive-by" sem contexto
      if (data.rating <= 2) {
        return (
          data.comment !== undefined &&
          data.comment.trim().length >= REVIEW_LIMITS.MIN_COMMENT_LENGTH_FOR_NEGATIVE
        )
      }
      return true
    },
    {
      message: `Reviews com rating 1-2 exigem um comentário com ao menos ${REVIEW_LIMITS.MIN_COMMENT_LENGTH_FOR_NEGATIVE} caracteres explicando o problema.`,
      path: ["comment"],
    }
  )

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO PUROS
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewData = {
  id: string
  tutorId: string          // TutorProfile.id — quem escreveu a review
  requestId: string        // ServiceRequest.id — contexto da review
  rating: number           // 1-5
  comment: string | null
  serviceType: ServiceType // contexto reputacional obrigatório
  petContext: PetContextSnapshot // snapshot imutável do pet no momento da review
  isVisible: boolean
  isFlagged: boolean
  flagReason: string | null
  flaggedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * ReviewWithContext — projeção enriquecida para exibição pública.
 *
 * Inclui o sumário do tutor (autor), para que os profissionais e futuros tutores
 * possam ver quem avaliou e o contexto do atendimento.
 *
 * Trust Graph (Fase 4):
 *   Esta estrutura é o "nó de evidência" do Trust Graph.
 *   Cada review representa uma aresta directed: tutor → profissional,
 *   com peso = rating e label = serviceType + petContext.
 *   Reviews recorrentes (isRecurringRelationship = true) têm peso de aresta
 *   amplificado pelo número de atendimentos anteriores.
 */
export type ReviewWithContext = ReviewData & {
  tutor: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  isRecurringRelationship: boolean
  totalServicesInRelationship: number
}

/**
 * ReviewSummary — agregação para exibição no perfil público do profissional.
 *
 * Ranking Engine (Fase 4):
 *   O Ranking Engine usa o `averageByServiceType` para pontuar profissionais
 *   de forma contextual: um profissional com 5.0 em DOG_WALK para cachorros
 *   filhotes aparece primeiro para tutores com filhotes, mesmo que o average
 *   geral seja 4.2.
 */
export type ReviewSummary = {
  professionalId: string
  totalReviews: number
  averageRating: number
  averageByServiceType: Partial<Record<ServiceType, { count: number; average: number }>>
  averageBySpecies: Partial<Record<Species, { count: number; average: number }>>
  recentReviews: ReviewWithContext[]
}

/**
 * TrustEventContext — payload do TrustEvent emitido por uma review.
 *
 * Contém todos os dados que o Trust Engine, Ranking Engine e Trust Graph
 * precisam sem fazer queries adicionais.
 *
 * Trust Score: usa rating + weight
 * Ranking Engine: usa serviceType + petSpecies + petHasSpecialNeeds para score contextual
 * Trust Graph: usa isRecurringRelationship + totalServicesInRelationship para peso da aresta
 */
export type ReviewTrustEventContext = {
  reviewId: string
  rating: number
  serviceType: ServiceType
  petSpecies: Species
  petBreed: string | null
  petHasSpecialNeeds: boolean
  isRecurringRelationship: boolean
  totalServicesInRelationship: number
}
