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
import { REPUTATION_CREDIT_WINDOW_MS } from "../domain/reputation-window"
import {
  resolveTrustLevel,
  clampScore,
  totalRecurrenceBonus,
  eligibleSessionsByTutor,
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

  // ── 2. Busca paralela: events + conclusões + trust graph ──────────────────
  //
  // As conclusões vêm de ServiceRequest (e não do contador pré-agregado do
  // relacionamento) porque o bônus de recorrência precisa do INSTANTE de cada
  // conclusão para decidir elegibilidade — ver seção 4.
  //
  // Trust Graph (5.8): soma dos pesos de conexões ativas, cap em 20.
  const [events, rawCompletions, endorsementSummary, territorial] = await Promise.all([
    prisma.trustEvent.findMany({
      where: { targetId: profile.userId, isFlagged: false },
      select: { type: true, weight: true },
    }),
    prisma.serviceRequest.findMany({
      where:  { professionalId, status: "COMPLETED", completedAt: { not: null } },
      select: { tutorId: true, completedAt: true },
    }),
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
  // A contagem NÃO usa `TutorProfessionalRelationship.completedServices`.
  // Aquele contador é dado operacional bruto (número real de atendimentos,
  // usado em CRM, histórico e métricas informativas) e aumenta em toda
  // conclusão — inclusive várias do mesmo par no mesmo dia. Como este bônus
  // é o maior ganho reputacional do motor, usá-lo direto deixava o Trust
  // Score inflável por conclusões repetidas.
  //
  // Em vez disso, a contagem ELEGÍVEL é derivada dos instantes reais de
  // conclusão (`ServiceRequest.completedAt`): no máximo uma conclusão por
  // par gera crédito dentro de cada janela (ver countEligibleCompletions).
  // Nada é escondido — o antifraude lê ServiceRequest direto e continua
  // enxergando todas as conclusões.
  const completionsByTutor = new Map<string, Date[]>()
  for (const req of rawCompletions) {
    if (!req.completedAt) continue
    const list = completionsByTutor.get(req.tutorId)
    if (list) list.push(req.completedAt)
    else completionsByTutor.set(req.tutorId, [req.completedAt])
  }

  const sessionsByTutor = eligibleSessionsByTutor(
    completionsByTutor,
    REPUTATION_CREDIT_WINDOW_MS
  )

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
      // Número REAL de atendimentos concluídos — nunca a contagem elegível.
      // Este campo alimenta o perfil público (discover/[professionalId]) e o
      // painel admin: subnotificar o trabalho de fato realizado seria injusto
      // com o profissional. A elegibilidade afeta só o bônus, não o histórico.
      totalCompletedRequests: rawCompletions.length,
      uniqueRecurringTutors:  sessionsByTutor.size,
      ...(territorial && { territorial }),
    },
  }
}
