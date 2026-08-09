import "server-only"

/**
 * Módulo: notifications
 * Camada: infrastructure — wrapper do `web-push`.
 *
 * `import "server-only"`: alcançar este arquivo de um bundle client quebra o
 * BUILD. É a garantia mecânica de que VAPID_PRIVATE_KEY nunca vai ao browser.
 *
 * Nada aqui loga payload, endpoint ou chave — só código de status e ids
 * técnicos, no mesmo padrão de log estruturado sem PII já usado no cron.
 */

import webpush from "web-push"

import type { PushPayload, PushSendOutcome } from "../domain/push-types"
import { classifyPushStatus } from "../domain/push-events"
import { getVapidConfig } from "./push-config"

export type SendResult = {
  outcome: PushSendOutcome
  /** Código HTTP do push service, quando houve resposta. */
  statusCode: number | null
  /** Motivo curto para PushDelivery.lastError. NUNCA corpo de resposta. */
  shortError: string | null
}

/**
 * Configura o VAPID uma única vez por processo. Retorna false quando push está
 * desabilitado — o chamador trata como no-op, nunca como erro.
 */
let vapidAplicado = false
function ensureVapid(): boolean {
  const cfg = getVapidConfig()
  if (!cfg) return false
  if (!vapidAplicado) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
    vapidAplicado = true
  }
  return true
}

/**
 * Teto de espera por resposta do push service.
 *
 * POR QUE EXISTE: um push service que ACEITA a conexão e nunca responde deixava
 * o envio pendurado por dezenas de segundos (medido em QA: >45s sem concluir).
 * Como os hooks de domínio (`notifyRequestCreated`/`notifyRequestAccepted`) são
 * awaitados DEPOIS da operação já persistida, isso podia estourar o tempo do
 * runtime e devolver erro ao usuário numa operação que funcionou — a request
 * ficava criada e a tela dizia que falhou.
 *
 * 3s é folgado para um POST curto a um push service saudável (FCM/Mozilla
 * respondem em dezenas de ms) e curto o bastante para não competir com o
 * orçamento de tempo da Server Action.
 *
 * Usa o timeout NATIVO da lib (repassado ao socket HTTPS): aborta a requisição
 * de verdade. Um `Promise.race` externo devolveria o controle mas deixaria o
 * socket vazando até o SO derrubá-lo.
 */
const PUSH_REQUEST_TIMEOUT_MS = 3000

/**
 * Envia para UMA subscription. Nunca lança: toda falha vira um SendResult
 * classificado, porque o dispatcher precisa contabilizar device a device sem
 * que um aparelho morto interrompa os demais.
 */
export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<SendResult> {
  if (!ensureVapid()) {
    return { outcome: "failed", statusCode: null, shortError: "push_disabled" }
  }

  try {
    const res = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { timeout: PUSH_REQUEST_TIMEOUT_MS }
    )
    return {
      outcome: classifyPushStatus(res.statusCode),
      statusCode: res.statusCode,
      shortError: null,
    }
  } catch (err) {
    // web-push lança WebPushError com `statusCode` em respostas não-2xx.
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode: unknown }).statusCode)
        : null

    if (statusCode !== null && Number.isFinite(statusCode)) {
      return {
        outcome: classifyPushStatus(statusCode),
        statusCode,
        // Só o código. O corpo da resposta do push service pode ecoar o
        // endpoint, que não deve ser persistido.
        shortError: `http_${statusCode}`,
      }
    }

    // Falha de rede/DNS/timeout — transitória, não invalida a subscription.
    return { outcome: "failed", statusCode: null, shortError: "network_error" }
  }
}
