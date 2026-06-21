/**
 * módulo: trust-engine
 * camada: application
 *
 * calculateTrustScore — calcula o Trust Score consolidado de um profissional.
 *
 * Fonte de dados:
 *   1. TrustEvents (banco) → soma de pesos por categoria
 *   2. ServiceRequests COMPLETED (banco) → bônus progressivo de recorrência
 *
 * Relação de IDs:
 *   - ProfessionalProfile.id   → chave primária do perfil
 *   - ProfessionalProfile.userId → User.id → usado como TrustEvent.targetId
 *
 * Esta função é IDEMPOTENTE: pode ser chamada N vezes com o mesmo resultado.
 * O score reflete o estado atual do banco no momento da chamada.
 */

import { prisma } from "@/lib/prisma/client"
import type { TrustEventType } from "@/modules/service-request/domain/types"
import { getRelationshipsByProfessional } from "@/modules/relationship/infrastructure/repository"
import { getEndorsementSummary } from "@/modules/trust-graph/application/get-trust-connections"
import { getTerritorialPosition } from "@/modules/growth-engine/infrastructure/repository"
import type { TrustScoreResult } from "../domain/types"
import {
  REVIEW_EVENT_TYPES,
  COMPLETION_EVENT_TYPES,
  BONUS_EVENT_TYPES,
  PENALTY_EVENT_TYPES,
  REFERENCE_WEIGHTS,
} from "../domain/constants"
import {
  resolveTrustLevel,
  clampScore,
  totalRecurrenceBonus,
  round1,
} from "../domain/scoring"

const ZERO_RESULT: TrustScoreResult = {
  score: 0,
  level: "INITIAL",
  breakdown: {
    reviews: 0,
    completions: 0,
    recurrence: 0,
    bonuses: 0,
    identityVerified: 0,
    penalties: 0,
    trustGraphBonus: 0,
  },
  meta: { totalEvents: 0, totalCompletedRequests: 0, uniqueRecurringTutors: 0 },
}

export async function calculateTrustScore(
  professionalId: string
): Promise<TrustScoreResult> {
  // ── 1. Resolve professionalId → userId ─────────────────────────────────────
  // TrustEvent.targetId = professional's User.id (não ProfessionalProfile.id)
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: { userId: true, verifiedIdentity: true },
  })

  if (!profile) return ZERO_RESULT

  // ── 2. Busca paralela: events + relacionamentos + trust graph ─────────────
  //
  // Estratégia de recorrência em duas camadas:
  //   1. TutorProfessionalRelationship (pós-5.3, mais eficiente): dados pre-agregados
  //   2. Fallback para ServiceRequest COMPLETED (pré-5.3, histórico): se não há registros
  //
  // Trust Graph (5.8): soma dos pesos de conexões ativas, cap em 20.
  const [events, relationships, endorsementSummary, territorial] = await Promise.all([
    prisma.trustEvent.findMany({
      where: { targetId: profile.userId, isFlagged: false },
      select: { type: true, weight: true },
    }),
    getRelationshipsByProfessional(professionalId),
    getEndorsementSummary(professionalId),
    getTerritorialPosition(professionalId),
  ])

  // ── 3. Categoriza contribuição dos TrustEvents ─────────────────────────────
  let reviews    = 0
  let completions = 0
  let bonuses    = 0
  let penalties  = 0

  for (const event of events) {
    const type = event.type as TrustEventType
    if (type === "IDENTITY_VERIFIED") continue
    if (REVIEW_EVENT_TYPES.includes(type))     { reviews    += event.weight; continue }
    if (COMPLETION_EVENT_TYPES.includes(type)) { completions += event.weight; continue }
    if (BONUS_EVENT_TYPES.includes(type))      { bonuses    += event.weight; continue }
    if (PENALTY_EVENT_TYPES.includes(type))    { penalties  += event.weight; continue }
  }

  let identityVerified = 0
  if (profile.verifiedIdentity) {
    identityVerified = REFERENCE_WEIGHTS.IDENTITY_VERIFIED
  } else {
    identityVerified = events
      .filter((e) => e.type === "IDENTITY_VERIFIED")
      .reduce((sum, e) => sum + e.weight, 0)
  }

  // ── 4. Bônus de recorrência por tutorId ───────────────────────────────────
  // Progressão: 1º atendimento +1, 2º +3, 3º +5, 4º +7, 5º+ +10/sessão
  //
  // Com TutorProfessionalRelationship (pós-5.3): usa completedServices por tutor
  // Fallback para ServiceRequest (pré-5.3): computa ao vivo se sem registros
  let sessionsByTutor: Map<string, number>

  if (relationships.length > 0) {
    // Camada 1: relacionamentos pre-agregados (mais eficiente)
    sessionsByTutor = new Map(
      relationships.map((r) => [r.tutorId, r.completedServices])
    )
  } else {
    // Camada 2: fallback para dados históricos brutos
    const rawRequests = await prisma.serviceRequest.findMany({
      where:  { professionalId, status: "COMPLETED" },
      select: { tutorId: true },
    })
    sessionsByTutor = new Map<string, number>()
    for (const req of rawRequests) {
      sessionsByTutor.set(req.tutorId, (sessionsByTutor.get(req.tutorId) ?? 0) + 1)
    }
  }

  const recurrence = totalRecurrenceBonus(sessionsByTutor)

  // ── 5. Trust Graph bonus (Etapa 5.8) ─────────────────────────────────────
  const trustGraphBonus = endorsementSummary.totalBonus

  // ── 6. Consolida e normaliza ───────────────────────────────────────────────
  const raw =
    reviews +
    completions +
    recurrence +
    bonuses +
    identityVerified +
    penalties +
    trustGraphBonus
  const score = clampScore(raw)
  const level = resolveTrustLevel(score)

  return {
    score,
    level,
    breakdown: {
      reviews:         round1(reviews),
      completions:     round1(completions),
      recurrence:      round1(recurrence),
      bonuses:         round1(bonuses),
      identityVerified: round1(identityVerified),
      penalties:       round1(penalties),
      trustGraphBonus: round1(trustGraphBonus),
    },
    meta: {
      totalEvents:            events.length,
      totalCompletedRequests: [...sessionsByTutor.values()].reduce((a, b) => a + b, 0),
      uniqueRecurringTutors:  sessionsByTutor.size,
      ...(territorial && { territorial }),
    },
  }
}
