/**
 * módulo: relationship
 * camada: infrastructure — repositório
 *
 * Acesso ao banco para TutorProfessionalRelationship.
 *
 * Padrão de upsert em duas fases:
 *   1. Upsert ATÔMICO que cria o vínculo ou incrementa os contadores
 *   2. Recalcular score e level a partir do estado JÁ incrementado e persistir
 *
 * Transação:
 *   `upsertRelationship` aceita um `TransactionClient` externo. Quando o
 *   chamador já está dentro de uma transação (é o caso da conclusão de
 *   atendimento — ver `completeServiceRequestAtomic`), as duas fases entram
 *   NA MESMA transação da mudança de status, de modo que ou tudo é gravado
 *   ou nada é. Sem o client externo, a função abre a própria transação e o
 *   comportamento é o de antes.
 *
 *   NUNCA aninhar: quando recebe um `tx`, esta função não abre transação
 *   própria — Prisma não suporta transação dentro de transação.
 */

import { prisma } from "@/lib/prisma/client"
import type { Prisma } from "@prisma/client"
import type {
  RelationshipEvent,
  TutorProfessionalRelationshipData,
  RelationshipAnalytics,
} from "../domain/types"
import {
  resolveRelationshipLevel,
  computeRelationshipScore,
} from "../domain/relationship-levels"
import { ANALYTICS_THRESHOLDS } from "../domain/constants"

/**
 * Cliente Prisma OU client de transação — permite que o chamador injete a
 * transação em curso e mantenha tudo num único commit.
 */
export type RelationshipDbClient = Prisma.TransactionClient | typeof prisma

// ─────────────────────────────────────────────────────────────────────────────
// applyRelationshipEvent
//
// Aplica um evento ao relacionamento tutor↔profissional usando o client
// recebido — normalmente o `tx` de uma transação maior. NÃO abre transação
// própria: quem chama é responsável por isso.
//
// Fase 1 usa `upsert`, não `findUnique` + `create`. Isso importa: o padrão
// anterior tinha uma janela em que duas PRIMEIRAS conclusões concorrentes do
// mesmo par liam "não existe" e ambas tentavam criar — uma violava o
// `@@unique([tutorId, professionalId])` e o incremento se perdia (o erro era
// engolido pelo `updateRelationship`). Com `upsert`, a decisão criar-ou-
// incrementar é resolvida pelo próprio banco.
//
// Fase 2 recalcula score e level a partir do estado JÁ incrementado devolvido
// pela fase 1 — nunca de uma leitura anterior, que estaria desatualizada sob
// concorrência.
// ─────────────────────────────────────────────────────────────────────────────

export async function applyRelationshipEvent(
  client: RelationshipDbClient,
  tutorId: string,
  professionalId: string,
  event: RelationshipEvent
): Promise<TutorProfessionalRelationshipData> {
  const now = event.type === "SERVICE_COMPLETED" ? event.serviceAt : new Date()

  const isCompletion = event.type === "SERVICE_COMPLETED"
  const isReview     = event.type === "REVIEW_GIVEN"
  const isTutorCancel = event.type === "CANCELLATION_BY_TUTOR"
  const isProCancel   = event.type === "CANCELLATION_BY_PRO"
  const isDispute     = event.type === "DISPUTE"

  // `totalRequests` NÃO é escrito aqui (nem no create, nem no update): passou a
  // ser derivado de ServiceRequest na leitura. A coluna continua no schema como
  // legado, congelada nos valores atuais, sem leitor e sem escritor — ver o
  // comentário dela no schema.
  //
  // ── Fase 1: cria OU incrementa, de forma atômica ──────────────────────────
  const record = await client.tutorProfessionalRelationship.upsert({
    where: { tutorId_professionalId: { tutorId, professionalId } },
    create: {
      tutorId,
      professionalId,
      completedServices: isCompletion ? 1 : 0,
      reviewsGiven:      isReview ? 1 : 0,
      cancelledByTutor:  isTutorCancel ? 1 : 0,
      cancelledByPro:    isProCancel ? 1 : 0,
      disputedServices:  isDispute ? 1 : 0,
      firstServiceAt:    isCompletion ? now : null,
      lastServiceAt:     isCompletion ? now : null,
    },
    update: {
      ...(isCompletion ? { completedServices: { increment: 1 } } : {}),
      ...(isReview ? { reviewsGiven: { increment: 1 } } : {}),
      ...(isTutorCancel ? { cancelledByTutor: { increment: 1 } } : {}),
      ...(isProCancel ? { cancelledByPro: { increment: 1 } } : {}),
      ...(isDispute ? { disputedServices: { increment: 1 } } : {}),
      ...(isCompletion ? { lastServiceAt: now } : {}),
    },
  })

  // `firstServiceAt` só pode ser preenchido quando ainda está null — o caso
  // real é um vínculo criado por evento não-conclusão (review, por exemplo)
  // recebendo depois a primeira conclusão. Nunca sobrescreve um valor já
  // gravado, senão a data do primeiro atendimento andaria para frente.
  const precisaFirstServiceAt = isCompletion && record.firstServiceAt === null

  // ── Fase 2: derivados a partir do estado já incrementado ──────────────────
  const newScore = computeRelationshipScore({
    completedServices: record.completedServices,
    reviewsGiven:      record.reviewsGiven,
    cancelledByTutor:  record.cancelledByTutor,
    cancelledByPro:    record.cancelledByPro,
    disputedServices:  record.disputedServices,
  })
  const newLevel = resolveRelationshipLevel(record.completedServices)

  const updated = await client.tutorProfessionalRelationship.update({
    where: { id: record.id },
    data: {
      relationshipScore: newScore,
      relationshipLevel: newLevel,
      ...(precisaFirstServiceAt ? { firstServiceAt: now } : {}),
    },
  })

  return updated as TutorProfessionalRelationshipData
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertRelationship
//
// Variante autônoma: abre a própria transação. Usada pelos fluxos que ainda
// não fazem parte de uma transação maior (ex.: REVIEW_GIVEN em
// createReviewAction). A conclusão de atendimento NÃO passa por aqui — ela
// injeta seu próprio `tx` via `applyRelationshipEvent`.
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertRelationship(
  tutorId: string,
  professionalId: string,
  event: RelationshipEvent
): Promise<TutorProfessionalRelationshipData> {
  return prisma.$transaction((tx) =>
    applyRelationshipEvent(tx, tutorId, professionalId, event)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// findRelationship — busca o relacionamento entre um tutor e um profissional
// ─────────────────────────────────────────────────────────────────────────────

export async function findRelationship(
  tutorId: string,
  professionalId: string
): Promise<TutorProfessionalRelationshipData | null> {
  try {
    const record = await prisma.tutorProfessionalRelationship.findUnique({
      where: { tutorId_professionalId: { tutorId, professionalId } },
    })
    return record as TutorProfessionalRelationshipData | null
  } catch (err) {
    console.error("[findRelationship] tabela indisponível:", err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipAnalytics
//
// Métricas públicas de recorrência de um profissional.
// Chamado no perfil público /discover/[professionalId].
// ─────────────────────────────────────────────────────────────────────────────

const ZERO_ANALYTICS: RelationshipAnalytics = {
  totalRelationships:   0,
  recurringClients:     0,
  trustedClients:       0,
  partnerClients:       0,
  avgCompletedServices: 0,
  maxCompletedServices: 0,
}

export async function getRelationshipAnalytics(
  professionalId: string
): Promise<RelationshipAnalytics> {
  try {
    const [relationships, agg] = await Promise.all([
      prisma.tutorProfessionalRelationship.findMany({
        where:  { professionalId },
        select: { completedServices: true },
      }),
      prisma.tutorProfessionalRelationship.aggregate({
        where: { professionalId },
        _count: { id: true },
        _avg:   { completedServices: true },
        _max:   { completedServices: true },
      }),
    ])

    const recurringClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.RECURRING
    ).length

    const trustedClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.TRUSTED
    ).length

    const partnerClients = relationships.filter(
      (r) => r.completedServices >= ANALYTICS_THRESHOLDS.PARTNER
    ).length

    return {
      totalRelationships:   agg._count.id,
      recurringClients,
      trustedClients,
      partnerClients,
      avgCompletedServices: Math.round((agg._avg.completedServices ?? 0) * 10) / 10,
      maxCompletedServices: agg._max.completedServices ?? 0,
    }
  } catch (err) {
    console.error("[getRelationshipAnalytics] tabela indisponível:", err)
    return ZERO_ANALYTICS
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipStatsForRanking
//
// Versão eficiente para o Ranking Engine — uma query para N profissionais.
// Retorna um Map de professionalId → stats de relacionamento.
// Evita N+1 ao rankear múltiplos candidatos.
// ─────────────────────────────────────────────────────────────────────────────

export type RankingRelationshipStats = {
  totalRelationships: number
  recurringClients:   number  // completedServices >= ANALYTICS_THRESHOLDS.RECURRING
  trustedClients:     number  // completedServices >= ANALYTICS_THRESHOLDS.TRUSTED
  partnerClients:     number  // completedServices >= ANALYTICS_THRESHOLDS.PARTNER
}

export async function getRelationshipStatsForRanking(
  professionalIds: string[]
): Promise<Map<string, RankingRelationshipStats>> {
  if (professionalIds.length === 0) return new Map()

  let rows: Array<{ professionalId: string; completedServices: number }>
  try {
    rows = await prisma.tutorProfessionalRelationship.findMany({
      where:  { professionalId: { in: professionalIds } },
      select: { professionalId: true, completedServices: true },
    })
  } catch (err) {
    console.error("[getRelationshipStatsForRanking] tabela indisponível, sem boost:", err)
    return new Map()
  }

  const map = new Map<string, RankingRelationshipStats>()

  for (const row of rows) {
    const existing = map.get(row.professionalId) ?? {
      totalRelationships: 0,
      recurringClients:   0,
      trustedClients:     0,
      partnerClients:     0,
    }

    existing.totalRelationships++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.RECURRING) existing.recurringClients++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.TRUSTED)   existing.trustedClients++
    if (row.completedServices >= ANALYTICS_THRESHOLDS.PARTNER)   existing.partnerClients++

    map.set(row.professionalId, existing)
  }

  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// getMyRelationshipsForProfessionals
//
// Para a página /discover — retorna um Map de professionalId → completedServices
// do tutor autenticado, em uma única query para todos os candidatos.
// Evita N+1 ao renderizar a lista de cards.
// ─────────────────────────────────────────────────────────────────────────────

export async function getMyRelationshipsForProfessionals(
  tutorId: string,
  professionalIds: string[]
): Promise<Map<string, number>> {
  if (!tutorId || professionalIds.length === 0) return new Map()

  try {
    const records = await prisma.tutorProfessionalRelationship.findMany({
      where:  { tutorId, professionalId: { in: professionalIds } },
      select: { professionalId: true, completedServices: true },
    })
    return new Map(records.map((r) => [r.professionalId, r.completedServices]))
  } catch (err) {
    console.error("[getMyRelationshipsForProfessionals] tabela indisponível:", err)
    return new Map()
  }
}

// getRelationshipsByProfessional foi removida: o Trust Engine deixou de
// derivar o bônus de recorrência de `completedServices` (contador operacional
// bruto) e passou a derivá-lo dos instantes reais de conclusão em
// ServiceRequest, para poder aplicar a janela de elegibilidade. As demais
// leituras do relacionamento (CRM, analytics, ranking) seguem inalteradas.
