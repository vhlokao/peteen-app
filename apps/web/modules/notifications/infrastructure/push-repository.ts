import "server-only"

/**
 * Módulo: notifications
 * Camada: infrastructure — persistência de PushSubscription.
 *
 * REGRA DE SEGREDO: `p256dh` e `auth` (junto do `endpoint`) permitem ENVIAR push
 * para o aparelho. Uma única função deste arquivo os seleciona —
 * `findActiveSubscriptionsForSend`, consumida só pelo dispatcher no servidor.
 * Todas as demais leituras usam SAFE_SELECT, que os omite. Qualquer novo select
 * que os inclua é bug de revisão.
 *
 * REGRA DE OWNERSHIP: toda mutação é escopada por `userId` no WHERE. Nunca
 * existe revogação por endpoint isolado — isso permitiria a um autenticado
 * qualquer derrubar a subscription de terceiro conhecendo/adivinhando o
 * endpoint.
 */

import { createHash } from "crypto"

import { prisma } from "@/lib/prisma/client"
import type { RevokedReason } from "../domain/push-types"

/** Projeção sem material de chave. Padrão para tudo que não seja envio. */
const SAFE_SELECT = {
  id: true,
  userId: true,
  endpointHash: true,
  createdAt: true,
  lastSeenAt: true,
  revokedAt: true,
  revokedReason: true,
} as const

export type SafeSubscription = {
  id: string
  userId: string
  endpointHash: string
  createdAt: Date
  lastSeenAt: Date
  revokedAt: Date | null
  revokedReason: string | null
}

/** Material necessário para enviar. NUNCA sai do servidor. */
export type SendableSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * SHA-256 do endpoint. Sobrevive à revogação (que anula o endpoint) e permite
 * correlacionar o mesmo device ao longo do tempo sem guardar o segredo.
 * Endpoints são URLs de alta entropia — o hash não é reversível na prática.
 */
export function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex")
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca por endpoint entre as ATIVAS. Revogadas têm endpoint NULL, então nunca
 * aparecem aqui — é o que permite ao mesmo device reassinar depois.
 */
export async function findActiveByEndpoint(endpoint: string): Promise<SafeSubscription | null> {
  return prisma.pushSubscription.findFirst({
    where: { endpoint, revokedAt: null },
    select: SAFE_SELECT,
  })
}

export async function findActiveByUser(userId: string): Promise<SafeSubscription[]> {
  return prisma.pushSubscription.findMany({
    where: { userId, revokedAt: null },
    select: SAFE_SELECT,
    orderBy: { lastSeenAt: "desc" },
  })
}

/** Teto de devices ativos (MAX_ACTIVE_SUBSCRIPTIONS_PER_USER). */
export async function countActiveByUser(userId: string): Promise<number> {
  return prisma.pushSubscription.count({ where: { userId, revokedAt: null } })
}

/**
 * Rate limit de criações. Usa `createdAt` — por construção só conta linhas
 * novas, então um refresh do mesmo endpoint nunca infla o limite.
 */
export async function countCreatedByUserSince(userId: string, since: Date): Promise<number> {
  return prisma.pushSubscription.count({
    where: { userId, createdAt: { gte: since } },
  })
}

/**
 * ÚNICA função que seleciona material de chave. Consumida apenas pelo
 * dispatcher, no servidor. Filtra `endpoint: { not: null }` além de
 * `revokedAt: null` — defesa em profundidade contra uma linha inconsistente
 * (revogação que anulou o endpoint mas falhou ao gravar revokedAt).
 */
export async function findActiveSubscriptionsForSend(userId: string): Promise<SendableSubscription[]> {
  const linhas = await prisma.pushSubscription.findMany({
    where: {
      userId,
      revokedAt: null,
      endpoint: { not: null },
      p256dh: { not: null },
      auth: { not: null },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  return linhas
    .filter((l): l is { id: string; endpoint: string; p256dh: string; auth: string } =>
      l.endpoint !== null && l.p256dh !== null && l.auth !== null
    )
    .map((l) => ({ id: l.id, endpoint: l.endpoint, p256dh: l.p256dh, auth: l.auth }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────────────────

export async function createSubscription(params: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}): Promise<SafeSubscription> {
  return prisma.pushSubscription.create({
    data: {
      userId: params.userId,
      endpoint: params.endpoint,
      p256dh: params.p256dh,
      auth: params.auth,
      endpointHash: hashEndpoint(params.endpoint),
    },
    select: SAFE_SELECT,
  })
}

export type CreateComLimitesResultado =
  | { ok: true; subscription: SafeSubscription }
  | { ok: false; motivo: "RATE_LIMIT_DEVICES" | "RATE_LIMIT_CREATES" }

/**
 * Criação com os dois tetos verificados ATOMICAMENTE.
 *
 * POR QUE EXISTE — a versão anterior fazia count → count → create fora de
 * transação. Isso é TOCTOU, e a QA independente comprovou que a proteção era
 * inteiramente contornável: 10 creates simultâneos com teto 6 produziram 6
 * ativas… não, produziram 10; e 15 simultâneos com teto 10/h produziram 15.
 * Cada request lia a contagem antes de qualquer outra escrever.
 *
 * POR QUE `SELECT ... FOR UPDATE` NA LINHA DE `users`, e não outra coisa:
 *   - `INSERT ... WHERE (SELECT COUNT(*)) < n` NÃO resolve sob READ COMMITTED:
 *     transações concorrentes enxergam snapshots equivalentes e ambas passam.
 *   - Um advisory lock global serializaria TODOS os usuários entre si.
 *   - Travar a linha do próprio usuário serializa exatamente o necessário: as
 *     mutations deste user. Usuários diferentes travam linhas diferentes e não
 *     se bloqueiam (verificado empiricamente).
 *
 * A linha de `users` é usada apenas como âncora de lock — NUNCA é escrita.
 *
 * Compatível com o Transaction Pooler do Supabase (pgbouncer, porta 6543):
 * `FOR UPDATE` é escopado à transação, não à sessão, então o modo transaction
 * do pgbouncer o suporta. Verificado contra o banco real antes de implementar.
 */
export async function createSubscriptionComLimites(params: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  maxAtivas: number
  maxCriacoesNaJanela: number
  janelaMs: number
}): Promise<CreateComLimitesResultado> {
  return prisma.$transaction(
    async (tx) => {
      // Serializa as mutations DESTE usuário. Só leitura — a linha nunca muda.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${params.userId} FOR UPDATE`

      const ativas = await tx.pushSubscription.count({
        where: { userId: params.userId, revokedAt: null },
      })
      if (ativas >= params.maxAtivas) {
        return { ok: false as const, motivo: "RATE_LIMIT_DEVICES" as const }
      }

      const desde = new Date(Date.now() - params.janelaMs)
      const criadas = await tx.pushSubscription.count({
        where: { userId: params.userId, createdAt: { gte: desde } },
      })
      if (criadas >= params.maxCriacoesNaJanela) {
        return { ok: false as const, motivo: "RATE_LIMIT_CREATES" as const }
      }

      const subscription = await tx.pushSubscription.create({
        data: {
          userId: params.userId,
          endpoint: params.endpoint,
          p256dh: params.p256dh,
          auth: params.auth,
          endpointHash: hashEndpoint(params.endpoint),
        },
        select: SAFE_SELECT,
      })
      return { ok: true as const, subscription }
    },
    // Sob concorrência alta do mesmo usuário, as transações entram em fila.
    // Os limites acima cobrem a espera real (3 queries curtas por transação)
    // com folga, sem mascarar um travamento de verdade.
    { timeout: 15000, maxWait: 15000 }
  )
}

/**
 * Mesmo usuário reassinando o mesmo endpoint. Atualiza `lastSeenAt` e as chaves
 * (o browser pode rotacioná-las via `pushsubscriptionchange`).
 *
 * Escopado por `userId` no WHERE: se o endpoint tiver mudado de dono entre a
 * leitura e esta escrita, `updateMany` afeta 0 linhas em vez de sobrescrever
 * dado alheio. NÃO cria linha nova — por isso não conta no rate limit.
 */
export async function refreshSubscription(params: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}): Promise<number> {
  const r = await prisma.pushSubscription.updateMany({
    where: { userId: params.userId, endpoint: params.endpoint, revokedAt: null },
    data: {
      p256dh: params.p256dh,
      auth: params.auth,
      lastSeenAt: new Date(),
    },
  })
  return r.count
}

/**
 * Revogação por ação do próprio usuário (logout, opt-out).
 *
 * SEMPRE escopada por userId + endpoint. Revogar por endpoint isolado seria um
 * primitivo de DoS: qualquer autenticado derrubaria a subscription de terceiro.
 *
 * Anula endpoint/p256dh/auth e preserva endpointHash — libera o unique para o
 * mesmo device reassinar e elimina material de chave que perdeu utilidade.
 *
 * Retorna a contagem afetada. 0 é resultado LEGÍTIMO e idempotente: já revogada,
 * inexistente, ou de outro dono. O chamador nunca distingue os três — isso
 * viraria oráculo de enumeração.
 */
export async function revokeSubscription(params: {
  userId: string
  endpoint: string
  reason: RevokedReason
}): Promise<number> {
  const r = await prisma.pushSubscription.updateMany({
    where: { userId: params.userId, endpoint: params.endpoint, revokedAt: null },
    data: {
      endpoint: null,
      p256dh: null,
      auth: null,
      revokedAt: new Date(),
      revokedReason: params.reason,
    },
  })
  return r.count
}

/**
 * Revogação por 404/410 do push service — a subscription está comprovadamente
 * morta na origem.
 *
 * Escopada por `id` (não por endpoint) porque o dispatcher já leu a linha e sabe
 * exatamente qual é; e sem `userId` porque não há ator humano aqui — é o próprio
 * push service informando a morte, não um usuário pedindo revogação.
 *
 * NUNCA é acionada por logout. Web Push e Supabase Auth são sistemas
 * independentes: nenhum signOut, nem global, invalida uma subscription.
 */
export async function revokeGoneSubscription(subscriptionId: string): Promise<number> {
  const r = await prisma.pushSubscription.updateMany({
    where: { id: subscriptionId, revokedAt: null },
    data: {
      endpoint: null,
      p256dh: null,
      auth: null,
      revokedAt: new Date(),
      revokedReason: "gone",
    },
  })
  return r.count
}
