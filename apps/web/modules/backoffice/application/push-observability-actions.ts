"use server"

/**
 * Módulo: backoffice
 * Camada: application — Server Actions de observabilidade de push.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTORIZAÇÃO
 *
 * Toda action chama `requireAdminOrRedirect()` ANTES de qualquer leitura, sem
 * depender do guard do AdminShell — defesa em profundidade, mesmo padrão já
 * usado em `/admin/requests/[requestId]` e `/admin/partners/[id]`. Server
 * Actions são endpoints de verdade: um layout que protege a PÁGINA não protege
 * a action, que pode ser invocada diretamente.
 *
 * NENHUMA action daqui recebe identificador de usuário como parâmetro de
 * escopo. O admin lê a plataforma inteira por definição do papel; não há
 * "escopo do cliente" a confiar, e por isso não há como um parâmetro forjado
 * ampliar acesso.
 */

import { requireAdminOrRedirect } from "@/modules/identity/application/get-session"
import {
  getPushDeliveries,
  getPushEventTypes,
  getPushOverview,
  getSubscriptionHealth,
  type PushDeliveryFilter,
  type PushDeliveryRow,
  type PushOverview,
  type SubscriptionHealthRow,
} from "../infrastructure/push-observability-repository"

export async function getPushObservabilityAction(filtro: PushDeliveryFilter = {}): Promise<{
  overview: PushOverview
  deliveries: PushDeliveryRow[]
  subscriptions: SubscriptionHealthRow[]
  eventTypes: string[]
}> {
  await requireAdminOrRedirect()

  // Paralelo: as quatro leituras são independentes, e em série a página
  // somaria quatro round-trips ao Postgres sem nenhum ganho.
  const [overview, deliveries, subscriptions, eventTypes] = await Promise.all([
    getPushOverview(),
    getPushDeliveries(filtro),
    getSubscriptionHealth(),
    getPushEventTypes(),
  ])

  return { overview, deliveries, subscriptions, eventTypes }
}
