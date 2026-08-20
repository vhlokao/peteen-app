"use server"

/**
 * Módulo: notifications
 * Camada: application — leitura com guards de ownership
 */

import { unstable_rethrow } from "next/navigation"

import { getAuthContext, requireAdmin } from "@/modules/identity/application/get-session"
import { findProfessionalProfileByUserId } from "@/modules/professional/infrastructure/repository"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { requirePartnerContext } from "@/modules/partner-portal/application/require-partner"
import { findOwnedPartnerForUser } from "@/modules/partner-portal/infrastructure/repository"
import { requireTutorContext } from "@/modules/relationship-history/application/require-tutor"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import type { NotificationItem } from "../domain/types"
import {
  countAdminNotifications,
  countPartnerNotifications,
  countProfessionalNotifications,
  countTutorNotifications,
  getAdminNotifications,
  getPartnerNotifications,
  getProfessionalNotifications,
  getTutorNotifications,
} from "../infrastructure/queries"
import {
  applyReadState,
  buildNotificationProbeToken,
  countUnread,
  isKeyOwnedByFeed,
  unreadKeysToPersist,
} from "../domain/read-state"
import {
  findReadKeys,
  markNotificationRead,
  markNotificationsRead,
} from "../infrastructure/read-repository"
import {
  getProfessionalNotificationProbeSource,
  getTutorNotificationProbeSource,
} from "../infrastructure/probe-queries"

/**
 * Feed do tutor JÁ com estado de leitura carimbado.
 *
 * A derivação continua sendo a fonte do que existe; `notification_reads` só
 * responde o que já foi lido. Ausência de linha = não lida.
 */
export async function getTutorNotificationsAction(): Promise<NotificationItem[]> {
  const { profile, session } = await requireTutorContext()
  const items = await getTutorNotifications(profile.id)
  const readKeys = await findReadKeys(session.id, items.map((item) => item.id))
  return applyReadState(items, readKeys)
}

export async function getProfessionalNotificationsAction(): Promise<NotificationItem[]> {
  const { profile, session } = await requireProfessionalContext()
  const items = await getProfessionalNotifications(profile.id)
  const readKeys = await findReadKeys(session.id, items.map((item) => item.id))
  return applyReadState(items, readKeys)
}

export async function getPartnerNotificationsAction(): Promise<NotificationItem[]> {
  const { partner } = await requirePartnerContext()
  return getPartnerNotifications(partner.id)
}

export async function getAdminNotificationsAction(): Promise<NotificationItem[]> {
  await requireAdmin()
  return getAdminNotifications()
}

export async function getTutorNotificationCountAction(): Promise<number> {
  const { profile } = await requireTutorContext()
  return countTutorNotifications(profile.id)
}

export async function getProfessionalNotificationCountAction(): Promise<number> {
  const { profile } = await requireProfessionalContext()
  return countProfessionalNotifications(profile.id)
}

export async function getPartnerNotificationCountAction(): Promise<number> {
  const { partner } = await requirePartnerContext()
  return countPartnerNotifications(partner.id)
}

/** Contador para layout — não redireciona em /partner/pending (ver nota sobre sessão ausente abaixo) */
export async function getPartnerNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  const owned = await findOwnedPartnerForUser(session.id)
  if (
    !owned ||
    !owned.partnerProfile.linkedPartnerId ||
    owned.partnerProfile.linkedPartnerId !== owned.partner.id
  ) {
    return 0
  }
  return countPartnerNotifications(owned.partner.id)
}

export async function getAdminNotificationCountAction(): Promise<number> {
  await requireAdmin()
  return countAdminNotifications()
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de leitura — mutations
// ─────────────────────────────────────────────────────────────────────────────

export type MarkReadResult = { success: true } | { success: false; error: string }

/**
 * Deriva o feed do papel ATIVO do usuário autenticado.
 *
 * É o coração da autorização das mutations: a lista de chaves marcáveis é
 * sempre produzida no servidor, a partir da sessão. Uma chave que o cliente
 * inventar não estará aqui — e sem estar aqui, não vira linha.
 */
async function deriveOwnFeed(
  role: "tutor" | "professional"
): Promise<{ userId: string; items: NotificationItem[] } | null> {
  if (role === "tutor") {
    const ctx = await getAuthContext()
    if (!ctx.authenticated || !ctx.user.roles.includes("TUTOR")) return null
    const profile = await findTutorProfileByUserId(ctx.user.id)
    if (!profile) return null
    return { userId: ctx.user.id, items: await getTutorNotifications(profile.id) }
  }

  const ctx = await getAuthContext()
  if (!ctx.authenticated || !ctx.user.roles.includes("PROFESSIONAL")) return null
  const profile = await findProfessionalProfileByUserId(ctx.user.id)
  if (!profile) return null
  return { userId: ctx.user.id, items: await getProfessionalNotifications(profile.id) }
}

/**
 * Marca UMA notificação como lida.
 *
 * A chave chega do cliente, mas NÃO é confiada: só é persistida se pertencer
 * ao feed derivado no servidor para este usuário. Sem essa checagem, qualquer
 * string viraria linha em `notification_reads` — poluição de tabela e, pior,
 * um oráculo para descobrir por tentativa e erro se um evento alheio existe.
 *
 * Idempotente: o índice único `(userId, notificationKey)` mais
 * `skipDuplicates` garantem que dois cliques não dupliquem nem estourem erro.
 */
export async function markNotificationReadAction(
  role: "tutor" | "professional",
  notificationKey: string
): Promise<MarkReadResult> {
  try {
    if (typeof notificationKey !== "string" || notificationKey.length === 0) {
      return { success: false, error: "Notificação inválida." }
    }
    // Teto do schema (VarChar(200)) — recusar aqui evita que uma string
    // enorme chegue ao banco só para ser rejeitada lá.
    if (notificationKey.length > 200) {
      return { success: false, error: "Notificação inválida." }
    }

    const own = await deriveOwnFeed(role)
    if (!own) return { success: false, error: "Acesso negado." }

    if (!isKeyOwnedByFeed(own.items, notificationKey)) {
      return { success: false, error: "Notificação não encontrada." }
    }

    await markNotificationRead(own.userId, notificationKey)
    return { success: true }
  } catch (err) {
    unstable_rethrow(err) // sinais de controle do Next nunca são falha
    console.error("[markNotificationReadAction]", err)
    return { success: false, error: "Não foi possível marcar como lida." }
  }
}

/**
 * Marca como lidas TODAS as notificações atualmente visíveis do usuário.
 *
 * O cliente não envia lista nenhuma — o servidor deriva o próprio feed e
 * persiste só as chaves ainda não lidas. `createMany + skipDuplicates` torna
 * a operação idempotente mesmo com dois cliques simultâneos.
 */
export async function markAllNotificationsReadAction(
  role: "tutor" | "professional"
): Promise<MarkReadResult> {
  try {
    const own = await deriveOwnFeed(role)
    if (!own) return { success: false, error: "Acesso negado." }

    const readKeys = await findReadKeys(own.userId, own.items.map((item) => item.id))
    const pendentes = unreadKeysToPersist(applyReadState(own.items, readKeys))

    await markNotificationsRead(own.userId, pendentes)
    return { success: true }
  } catch (err) {
    unstable_rethrow(err) // sinais de controle do Next nunca são falha
    console.error("[markAllNotificationsReadAction]", err)
    return { success: false, error: "Não foi possível marcar todas como lidas." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe barato — detecta novidade sem re-derivar o feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devolve só um token comparável (timestamp + dois inteiros, sem PII). Ver
 * infrastructure/probe-queries.ts para por que isto NÃO chama
 * `getTutorNotifications`.
 */
export async function getTutorNotificationProbeAction(): Promise<
  { success: true; token: string } | { success: false }
> {
  try {
    const ctx = await getAuthContext()
    if (!ctx.authenticated || !ctx.user.roles.includes("TUTOR")) return { success: false }
    const profile = await findTutorProfileByUserId(ctx.user.id)
    if (!profile) return { success: false }

    const source = await getTutorNotificationProbeSource(profile.id, ctx.user.id)
    return { success: true, token: buildNotificationProbeToken(source) }
  } catch (err) {
    // `redirect`, `notFound` e "Dynamic server usage" são SINAIS DE CONTROLE
    // do Next, não falhas — ele os propaga como exceção. Engoli-los aqui fazia
    // o build registrar a rota como erro de prerender e devolver o ErrorState
    // para dentro do shell estático. `unstable_rethrow` relança só esses e
    // deixa passar as falhas de verdade.
    unstable_rethrow(err)
    console.error("[getTutorNotificationProbeAction]", err)
    return { success: false }
  }
}

export async function getProfessionalNotificationProbeAction(): Promise<
  { success: true; token: string } | { success: false }
> {
  try {
    const ctx = await getAuthContext()
    if (!ctx.authenticated || !ctx.user.roles.includes("PROFESSIONAL")) {
      return { success: false }
    }
    const profile = await findProfessionalProfileByUserId(ctx.user.id)
    if (!profile) return { success: false }

    const source = await getProfessionalNotificationProbeSource(profile.id, ctx.user.id)
    return { success: true, token: buildNotificationProbeToken(source) }
  } catch (err) {
    unstable_rethrow(err) // ver nota no probe do tutor
    console.error("[getProfessionalNotificationProbeAction]", err)
    return { success: false }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contadores de NÃO LIDAS para o layout (badge)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Badge = não lidas, não "eventos recentes".
 *
 * Sem sessão de aplicação devolve 0 em vez de lançar: roda no render do
 * layout, onde um throw viraria stack trace de fluxo esperado. É a mesma
 * degradação graciosa que já existia para persona errada / sem perfil — a
 * autorização real de cada rota continua na página e no middleware.
 *
 * Custo: reaproveita a MESMA derivação do feed e soma UMA leitura indexada de
 * `notification_reads`. Não é barato — mas é exatamente o custo que o layout
 * já pagava antes desta missão (`countTutorNotifications` também derivava o
 * feed inteiro). O que NÃO fazemos é pagá-lo a cada 10s: o polling usa o
 * probe agregado, e este caminho só roda no render do Server Component.
 */
export async function getTutorNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  if (!session.roles.includes("TUTOR")) return 0
  const profile = await findTutorProfileByUserId(session.id)
  if (!profile) return 0

  const items = await getTutorNotifications(profile.id)
  const readKeys = await findReadKeys(session.id, items.map((item) => item.id))
  return countUnread(applyReadState(items, readKeys))
}

export async function getProfessionalNotificationCountForLayoutAction(): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated) return 0
  const session = ctx.user
  if (!session.roles.includes("PROFESSIONAL")) return 0
  const profile = await findProfessionalProfileByUserId(session.id)
  if (!profile) return 0

  const items = await getProfessionalNotifications(profile.id)
  const readKeys = await findReadKeys(session.id, items.map((item) => item.id))
  return countUnread(applyReadState(items, readKeys))
}
