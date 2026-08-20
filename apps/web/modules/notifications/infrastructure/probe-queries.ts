/**
 * Módulo: notifications
 * Camada: infrastructure — agregações do probe barato da central.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CONTRATO: NUNCA DERIVAR O FEED AQUI
 *
 * `getTutorNotifications` custa 4–5 queries e monta objetos em memória.
 * Chamá-la a cada 10s, por aba aberta, é o "polling pesado" que a missão
 * veta explicitamente. Este arquivo responde uma pergunta muito mais barata
 * — "mudou alguma coisa?" — com `max(updatedAt)` e `count` sobre as MESMAS
 * tabelas de origem, resolvidos pelos índices que já existem.
 *
 * As fontes de cada papel espelham as de queries.ts. Se um evento novo for
 * adicionado lá e a fonte dele não estiver aqui, a notificação aparecerá no
 * próximo foco/refresh, mas não no tique de 10s — é degradação silenciosa, e
 * por isso as duas listas precisam andar juntas.
 */

import { subDays } from "date-fns"

import { prisma } from "@/lib/prisma/client"
import type { NotificationProbeSource } from "../domain/read-state"
import { countReadsSince } from "./read-repository"

/** Mesma janela do feed derivado (ver queries.ts). */
const RECENT_WINDOW_DAYS = 30

function recentSince(): Date {
  return subDays(new Date(), RECENT_WINDOW_DAYS)
}

/**
 * Reduz uma lista de agregados `{ _max, _count }` a um par
 * (instante mais recente, total de linhas).
 *
 * `count` existe porque `max` sozinho é cego para remoção: um CareUpdate
 * soft-deletado sai do feed sem mover nenhum `updatedAt` para frente, e sem a
 * contagem a tela continuaria exibindo um item que já não é verdade.
 */
function reduceSignals(
  signals: { latest: Date | null; count: number }[]
): { latestActivityAt: Date | null; activityCount: number } {
  let latestActivityAt: Date | null = null
  let activityCount = 0

  for (const signal of signals) {
    activityCount += signal.count
    if (signal.latest && (!latestActivityAt || signal.latest > latestActivityAt)) {
      latestActivityAt = signal.latest
    }
  }

  return { latestActivityAt, activityCount }
}

// ── Tutor ─────────────────────────────────────────────────────────────────────

/**
 * Fontes do tutor: requests próprias, disputas das próprias requests,
 * atualizações do Diário das próprias requests. Ownership (`tutorId`) é
 * fronteira de segurança no WHERE, igual ao feed.
 */
export async function getTutorNotificationProbeSource(
  tutorId: string,
  userId: string
): Promise<NotificationProbeSource> {
  const since = recentSince()

  const [requests, disputes, careUpdates, readCount] = await Promise.all([
    prisma.serviceRequest.aggregate({
      where: { tutorId, updatedAt: { gte: since } },
      _max: { updatedAt: true },
      _count: { _all: true },
    }),
    prisma.dispute.aggregate({
      where: { request: { tutorId }, createdAt: { gte: since } },
      _max: { createdAt: true },
      _count: { _all: true },
    }),
    prisma.careUpdate.aggregate({
      where: { request: { tutorId }, deletedAt: null, createdAt: { gte: since } },
      _max: { createdAt: true },
      _count: { _all: true },
    }),
    countReadsSince(userId, since),
  ])

  const { latestActivityAt, activityCount } = reduceSignals([
    { latest: requests._max.updatedAt, count: requests._count._all },
    { latest: disputes._max.createdAt, count: disputes._count._all },
    { latest: careUpdates._max.createdAt, count: careUpdates._count._all },
  ])

  return { latestActivityAt, activityCount, readCount }
}

// ── Profissional ──────────────────────────────────────────────────────────────

/**
 * Fontes do profissional: requests recebidas, avaliações recebidas, disputas
 * abertas nas próprias requests.
 *
 * `TutorProfessionalRelationship` (evento "cliente recorrente") ficou de fora
 * de propósito: é um marco raro, derivado de uma conclusão que JÁ move
 * `ServiceRequest.updatedAt` no mesmo fluxo — a mudança é capturada pela
 * primeira fonte, sem uma quarta agregação por ciclo.
 */
export async function getProfessionalNotificationProbeSource(
  professionalId: string,
  userId: string
): Promise<NotificationProbeSource> {
  const since = recentSince()

  const [requests, reviews, disputes, readCount] = await Promise.all([
    prisma.serviceRequest.aggregate({
      where: { professionalId, updatedAt: { gte: since } },
      _max: { updatedAt: true },
      _count: { _all: true },
    }),
    prisma.review.aggregate({
      where: {
        request: { professionalId },
        createdAt: { gte: since },
        isVisible: true,
        hiddenByAdmin: false,
      },
      _max: { createdAt: true },
      _count: { _all: true },
    }),
    prisma.dispute.aggregate({
      where: { request: { professionalId }, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      _max: { createdAt: true },
      _count: { _all: true },
    }),
    countReadsSince(userId, since),
  ])

  const { latestActivityAt, activityCount } = reduceSignals([
    { latest: requests._max.updatedAt, count: requests._count._all },
    { latest: reviews._max.createdAt, count: reviews._count._all },
    { latest: disputes._max.createdAt, count: disputes._count._all },
  ])

  return { latestActivityAt, activityCount, readCount }
}
