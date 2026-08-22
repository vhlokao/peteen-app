import "server-only"

/**
 * Módulo: backoffice
 * Camada: infrastructure — leitura operacional de push.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGRA DE SEGREDO — A MAIS IMPORTANTE DESTE ARQUIVO
 *
 * `endpoint`, `p256dh` e `auth` juntos permitem ENVIAR push para o aparelho de
 * alguém. Nenhum `select` deste arquivo os inclui, e nenhum pode passar a
 * incluir: um backoffice que exibisse a tripla transformaria qualquer captura
 * de tela numa credencial de envio.
 *
 * O que sai daqui é: `endpointHash` (SHA-256, já cortado na exibição, serve
 * para correlacionar o mesmo aparelho ao longo do tempo) e
 * `vapidKeyFingerprint` (hash de chave PÚBLICA, não é segredo).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 *
 * Toda leitura tem `take` explícito. As duas listas resolvem o nome do
 * destinatário por JOIN do Prisma (`include`), nunca por consulta por linha —
 * a lista de entregas com N+1 seria uma query por push numa tabela que já tem
 * dezenas de linhas e só cresce.
 */

import { prisma } from "@/lib/prisma/client"

// ─────────────────────────────────────────────────────────────────────────────
// Entregas
// ─────────────────────────────────────────────────────────────────────────────

export type PushDeliveryRow = {
  id: string
  eventKey: string
  eventType: string
  entityId: string
  channel: string
  recipientEmail: string
  attemptedCount: number
  acceptedCount: number
  failedCount: number
  invalidCount: number
  lastError: string | null
  createdAt: Date
}

export type PushDeliveryFilter = {
  eventType?: string
  /** Só entregas com alguma falha registrada. */
  somenteFalhas?: boolean
  /** Recorte temporal em dias, a partir de agora. */
  dias?: number
}

const LIMITE_ENTREGAS = 200

export async function getPushDeliveries(
  filtro: PushDeliveryFilter = {}
): Promise<PushDeliveryRow[]> {
  const desde =
    filtro.dias && filtro.dias > 0
      ? new Date(Date.now() - filtro.dias * 24 * 60 * 60 * 1000)
      : undefined

  const linhas = await prisma.pushDelivery.findMany({
    where: {
      ...(filtro.eventType ? { eventType: filtro.eventType } : {}),
      ...(desde ? { createdAt: { gte: desde } } : {}),
      // "Alguma falha" inclui `invalidCount` — uma subscription morta é falha
      // de entrega para quem investiga, ainda que o sistema a trate como
      // higiene esperada.
      ...(filtro.somenteFalhas
        ? { OR: [{ failedCount: { gt: 0 } }, { invalidCount: { gt: 0 } }] }
        : {}),
    },
    select: {
      id: true,
      eventKey: true,
      eventType: true,
      entityId: true,
      channel: true,
      attemptedCount: true,
      acceptedCount: true,
      failedCount: true,
      invalidCount: true,
      lastError: true,
      createdAt: true,
      recipient: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: LIMITE_ENTREGAS,
  })

  return linhas.map((l) => ({
    id: l.id,
    eventKey: l.eventKey,
    eventType: l.eventType,
    entityId: l.entityId,
    channel: l.channel,
    recipientEmail: l.recipient.email,
    attemptedCount: l.attemptedCount,
    acceptedCount: l.acceptedCount,
    failedCount: l.failedCount,
    invalidCount: l.invalidCount,
    lastError: l.lastError,
    createdAt: l.createdAt,
  }))
}

/** Tipos de evento existentes, para popular o filtro sem hard-code. */
export async function getPushEventTypes(): Promise<string[]> {
  const linhas = await prisma.pushDelivery.findMany({
    distinct: ["eventType"],
    select: { eventType: true },
    orderBy: { eventType: "asc" },
    take: 50,
  })
  return linhas.map((l) => l.eventType)
}

/**
 * Entregas de UMA entidade (tipicamente uma Request), para a timeline
 * operacional. `entityId` é o id da Request em todos os eventos de
 * ServiceRequest — ver push-service-request-events.ts.
 */
export async function getPushDeliveriesForEntity(
  entityId: string
): Promise<PushDeliveryRow[]> {
  const linhas = await prisma.pushDelivery.findMany({
    where: { entityId },
    select: {
      id: true,
      eventKey: true,
      eventType: true,
      entityId: true,
      channel: true,
      attemptedCount: true,
      acceptedCount: true,
      failedCount: true,
      invalidCount: true,
      lastError: true,
      createdAt: true,
      recipient: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  return linhas.map((l) => ({
    id: l.id,
    eventKey: l.eventKey,
    eventType: l.eventType,
    entityId: l.entityId,
    channel: l.channel,
    recipientEmail: l.recipient.email,
    attemptedCount: l.attemptedCount,
    acceptedCount: l.acceptedCount,
    failedCount: l.failedCount,
    invalidCount: l.invalidCount,
    lastError: l.lastError,
    createdAt: l.createdAt,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Saúde de subscriptions
// ─────────────────────────────────────────────────────────────────────────────

export type SubscriptionHealthRow = {
  id: string
  email: string
  endpointHash: string
  ativa: boolean
  revokedReason: string | null
  revokedAt: Date | null
  /**
   * "Registrada ou revalidada", NUNCA prova de entrega — ver o bloco de
   * semântica em notifications/infrastructure/push-repository.ts.
   */
  lastSeenAt: Date
  createdAt: Date
  runtimeEnvironment: string | null
  vapidKeyFingerprint: string | null
}

const LIMITE_SUBSCRIPTIONS = 200

/**
 * Saúde das subscriptions. Ativas primeiro — é o que responde "por que fulano
 * não recebeu?"; as revogadas contam a história de como se chegou ali.
 */
export async function getSubscriptionHealth(params: {
  somenteAtivas?: boolean
} = {}): Promise<SubscriptionHealthRow[]> {
  const linhas = await prisma.pushSubscription.findMany({
    where: params.somenteAtivas ? { revokedAt: null } : {},
    select: {
      id: true,
      endpointHash: true,
      revokedAt: true,
      revokedReason: true,
      lastSeenAt: true,
      createdAt: true,
      runtimeEnvironment: true,
      vapidKeyFingerprint: true,
      user: { select: { email: true } },
    },
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: LIMITE_SUBSCRIPTIONS,
  })

  return linhas.map((l) => ({
    id: l.id,
    email: l.user.email,
    endpointHash: l.endpointHash,
    ativa: l.revokedAt === null,
    revokedReason: l.revokedReason,
    revokedAt: l.revokedAt,
    lastSeenAt: l.lastSeenAt,
    createdAt: l.createdAt,
    runtimeEnvironment: l.runtimeEnvironment,
    vapidKeyFingerprint: l.vapidKeyFingerprint,
  }))
}

export type PushOverview = {
  subscriptionsAtivas: number
  subscriptionsRevogadas: number
  entregas7d: number
  entregasComFalha7d: number
}

/**
 * Números do topo. Quatro `count` em paralelo — nenhum carrega linha.
 */
export async function getPushOverview(): Promise<PushOverview> {
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [ativas, revogadas, entregas, comFalha] = await Promise.all([
    prisma.pushSubscription.count({ where: { revokedAt: null } }),
    prisma.pushSubscription.count({ where: { revokedAt: { not: null } } }),
    prisma.pushDelivery.count({ where: { createdAt: { gte: seteDias } } }),
    prisma.pushDelivery.count({
      where: {
        createdAt: { gte: seteDias },
        OR: [{ failedCount: { gt: 0 } }, { invalidCount: { gt: 0 } }],
      },
    }),
  ])

  return {
    subscriptionsAtivas: ativas,
    subscriptionsRevogadas: revogadas,
    entregas7d: entregas,
    entregasComFalha7d: comFalha,
  }
}
