"use server"

/**
 * Módulo: notifications
 * Camada: application — Server Actions de subscription.
 *
 * OWNERSHIP: o usuário vem SEMPRE de `requireAuth()`. Nenhuma action aqui
 * aceita userId, tutorId, professionalId ou recipientId vindos do client — a
 * identidade do ator é da sessão, nunca do payload.
 *
 * CONTRATO DE SUBSCRIBE (decidido na Microauditoria de Ownership):
 *   endpoint ativo inexistente   → create
 *   endpoint ativo + mesmo user  → refresh
 *   endpoint ativo + outro user  → SUBSCRIPTION_CONFLICT, ZERO mutação
 *
 * NUNCA há cross-user rebind. A tripla (endpoint, p256dh, auth) é um segredo
 * PORTADOR — copiável de um log, de uma extensão, de um XSS — e portanto não é
 * prova de posse do device. Transferir ownership com base nela permitiria a um
 * autenticado qualquer sequestrar o device de terceiro e fazê-lo vibrar com
 * notificações. O client resolve o conflito legítimo desinscrevendo e
 * negociando um endpoint NOVO, o que exige controle real de execução no browser.
 *
 * Server Actions (não Route Handlers) de propósito: o Next já traz proteção
 * CSRF nativa nelas.
 */

import { requireAuth } from "@/modules/identity/application/get-session"
import {
  CREATE_WINDOW_MS,
  MAX_ACTIVE_SUBSCRIPTIONS_PER_USER,
  MAX_CREATES_PER_WINDOW,
  type PushActionResult,
  type PushSubscriptionInput,
} from "../domain/push-types"
import { getVapidConfig, isPushEnabled } from "../infrastructure/push-config"
import { getCurrentPushIdentity } from "../infrastructure/runtime-environment"
import {
  createSubscriptionComLimites,
  findActiveByEndpoint,
  refreshSubscription,
  revokeSubscription,
} from "../infrastructure/push-repository"

/** Validação estrutural mínima. Não confia em nada vindo do client. */
function entradaInvalida(input: PushSubscriptionInput): boolean {
  const { endpoint, p256dh, auth } = input
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return true
  }
  if (endpoint.length < 20 || endpoint.length > 1000) return true
  if (!endpoint.startsWith("https://")) return true
  if (p256dh.length < 20 || p256dh.length > 255) return true
  if (auth.length < 10 || auth.length > 255) return true
  return false
}

/**
 * Registra (ou atualiza) a subscription do device corrente para o usuário da
 * sessão.
 */
export async function subscribeToPushAction(
  input: PushSubscriptionInput
): Promise<PushActionResult> {
  let userId: string
  try {
    const user = await requireAuth()
    userId = user.id
  } catch {
    return { success: false, code: "UNAUTHENTICATED" }
  }

  const vapid = getVapidConfig()
  if (!vapid) {
    return { success: false, code: "PUSH_DISABLED" }
  }
  if (entradaInvalida(input)) {
    return { success: false, code: "INVALID_SUBSCRIPTION" }
  }

  // Identidade DESTE ambiente — estágio + par VAPID — derivada inteiramente do
  // servidor. Nenhum dos dois eixos vem do client: um fingerprint forjado faria
  // uma subscription de dev parecer de produção, e um ambiente forjado faria um
  // device de produção parecer de preview. Os dois juntos são o que autoriza um
  // sender a acordar este aparelho.
  const identidade = getCurrentPushIdentity(vapid.publicKey)

  try {
    const existente = await findActiveByEndpoint(input.endpoint)

    // ── endpoint ativo + OUTRO usuário → conflito, zero mutação ──────────────
    // Não revoga, não transfere, não toca a linha alheia. O código é genérico:
    // revelar "pertence a outro usuário" transformaria esta action em oráculo
    // de enumeração de endpoints ativos.
    if (existente && existente.userId !== userId) {
      console.warn("[push] endpoint_conflict", { subscriptionId: existente.id })
      return { success: false, code: "SUBSCRIPTION_CONFLICT" }
    }

    // ── endpoint ativo + MESMO usuário → refresh (não conta no rate limit) ───
    if (existente) {
      const afetadas = await refreshSubscription({
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        identidade,
      })
      if (afetadas > 0) {
        return { success: true, alreadyActive: true }
      }
      // Corrida: a linha mudou entre a leitura e a escrita (revogada por outro
      // fluxo). Cai para o caminho de criação abaixo.
    }

    // ── Criação com os dois tetos verificados ATOMICAMENTE ───────────────────
    // Os counts e o create vivem na MESMA transação, atrás de um
    // `SELECT ... FOR UPDATE` na linha deste usuário. Sem isso o par
    // count→create é TOCTOU e os tetos são inteiramente contornáveis por
    // concorrência (comprovado em QA: 10 simultâneos com teto 6 criavam 10).
    //
    // Rejeita ao atingir o teto — nunca revoga LRU automaticamente: derrubar em
    // silêncio o device mais antigo de alguém é decisão do usuário, não nossa.
    const resultado = await createSubscriptionComLimites({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      identidade,
      maxAtivas: MAX_ACTIVE_SUBSCRIPTIONS_PER_USER,
      maxCriacoesNaJanela: MAX_CREATES_PER_WINDOW,
      janelaMs: CREATE_WINDOW_MS,
    })

    if (!resultado.ok) {
      return { success: false, code: resultado.motivo }
    }
    return { success: true, alreadyActive: false }
  } catch (err) {
    // P2002 no unique de endpoint: outro request criou a mesma linha entre a
    // leitura e a escrita.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      // Reconfirma o dono antes de responder sucesso. Se a corrida foi com
      // OUTRO usuário, o resultado correto é conflito — nunca deixar o chamador
      // acreditar que passou a ter uma subscription que não é dele.
      const dono = await findActiveByEndpoint(input.endpoint).catch(() => null)
      if (dono && dono.userId !== userId) {
        return { success: false, code: "SUBSCRIPTION_CONFLICT" }
      }
      return { success: true, alreadyActive: true }
    }
    // Log sem PII: nenhum endpoint, chave, e-mail ou userId.
    console.error("[push] subscribe_failed", { erro: String(err).slice(0, 120) })
    return { success: false, code: "INTERNAL" }
  }
}

/**
 * Revoga a subscription do device corrente.
 *
 * SEMPRE escopada por userId (sessão) + endpoint. Revogar por endpoint isolado
 * permitiria a qualquer autenticado derrubar a subscription de terceiro.
 *
 * IDEMPOTENTE E SEGURA: já revogada, inexistente ou de outro dono devolvem o
 * mesmo `{ success: true }`. O chamador nunca consegue distinguir os três casos
 * — isso viraria oráculo de enumeração.
 */
export async function unsubscribeFromPushAction(endpoint: string): Promise<PushActionResult> {
  let userId: string
  try {
    const user = await requireAuth()
    userId = user.id
  } catch {
    return { success: false, code: "UNAUTHENTICATED" }
  }

  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 1000) {
    return { success: false, code: "INVALID_SUBSCRIPTION" }
  }

  try {
    await revokeSubscription({ userId, endpoint, reason: "user_optout" })
    return { success: true, alreadyActive: false }
  } catch (err) {
    console.error("[push] unsubscribe_failed", { erro: String(err).slice(0, 120) })
    return { success: false, code: "INTERNAL" }
  }
}

/**
 * Revogação no logout. Idêntica à de opt-out, mudando só `revokedReason` — a
 * distinção importa para auditoria (saber por que um device parou de receber).
 *
 * Chamada ANTES de `supabase.auth.signOut()`, enquanto a sessão ainda existe:
 * depois do signOut não há sessão para autorizar a revogação. É por isso que a
 * ordem revoke → unsubscribe → signOut é obrigatória e não uma preferência.
 */
export async function revokePushOnLogoutAction(endpoint: string): Promise<PushActionResult> {
  let userId: string
  try {
    const user = await requireAuth()
    userId = user.id
  } catch {
    return { success: false, code: "UNAUTHENTICATED" }
  }

  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 1000) {
    return { success: false, code: "INVALID_SUBSCRIPTION" }
  }

  try {
    await revokeSubscription({ userId, endpoint, reason: "logout" })
    return { success: true, alreadyActive: false }
  } catch (err) {
    console.error("[push] logout_revoke_failed", { erro: String(err).slice(0, 120) })
    return { success: false, code: "INTERNAL" }
  }
}

/** Expõe ao client apenas se push está habilitado. Nunca expõe a config. */
export async function isPushEnabledAction(): Promise<boolean> {
  return isPushEnabled()
}
