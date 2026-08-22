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
import { classifyPushFailure, type PushFailureClass } from "../domain/push-failure"
import { getVapidConfig } from "./push-config"

export type SendResult = {
  outcome: PushSendOutcome
  /** Código HTTP do push service, quando houve resposta. */
  statusCode: number | null
  /** Motivo curto para PushDelivery.lastError. NUNCA corpo de resposta. */
  shortError: string | null
  /**
   * Classe da falha — o que decide se vale retry e se isto é problema NOSSO
   * (configuração) ou do canal (transitório). `null` quando o envio foi aceito.
   *
   * Vive aqui, e não no dispatcher, porque só este arquivo enxerga o status
   * HTTP cru: o dispatcher recebe o veredito já classificado e nunca precisa
   * reinterpretar códigos.
   */
  failureClass: PushFailureClass | null
}

/**
 * Configura o VAPID uma única vez por processo. Retorna false quando push está
 * desabilitado — o chamador trata como no-op, nunca como erro.
 */
let vapidAplicado = false
/** Guarda o motivo da última falha de configuração, para o chamador reportar. */
let vapidErroConfig: string | null = null

/**
 * Aplica o VAPID uma vez por processo.
 *
 * `setVapidDetails` VALIDA e LANÇA quando a configuração é malformada: subject
 * que não é mailto:/https, chave com quebra de linha ou aspas, chave truncada,
 * valor colado junto do nome da variável. Antes, esta chamada ficava FORA do
 * try/catch de `sendPush` — a única linha desprotegida da função —, então uma
 * env var mal copiada derrubava o envio com uma exceção que o dispatcher só
 * conseguia registrar como "sender_threw", sem dizer o motivo.
 *
 * Falha de CONFIGURAÇÃO não pode se parecer com falha de rede: aqui ela é
 * capturada, classificada e reportada com o motivo real.
 */
function ensureVapid(): boolean {
  const cfg = getVapidConfig()
  if (!cfg) {
    vapidErroConfig = "config_ausente"
    return false
  }
  if (!vapidAplicado) {
    try {
      webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
      vapidAplicado = true
      vapidErroConfig = null
    } catch (err) {
      // Mensagem da lib é descritiva e NÃO contém a chave — só diz o que está
      // errado no formato. Seguro para log e para PushDelivery.lastError.
      vapidErroConfig =
        typeof err === "object" && err !== null && "message" in err
          ? `vapid_invalido: ${String(err.message).slice(0, 90)}`
          : "vapid_invalido"
      console.error("[push] configuração VAPID inválida", { motivo: vapidErroConfig })
      return false
    }
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
    // Distingue "push desligado de propósito" (sem env) de "env presente mas
    // inválida" — a segunda é um erro de operação que precisa ser visível.
    //
    // Classe `configuration` explícita, NÃO derivada de status (não há status
    // nenhum aqui): nunca houve requisição. Repetir isto seria repetir a mesma
    // env var errada, e é exatamente o tipo de falha que o retry não pode
    // tentar curar.
    return {
      outcome: "failed",
      statusCode: null,
      shortError: vapidErroConfig ?? "push_disabled",
      failureClass: "configuration",
    }
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
    const outcome = classifyPushStatus(res.statusCode)
    return {
      outcome,
      statusCode: res.statusCode,
      shortError: null,
      failureClass: outcome === "accepted" ? null : classifyPushFailure(res.statusCode),
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
        failureClass: classifyPushFailure(statusCode),
      }
    }

    // Falha de rede/DNS/timeout — transitória, não invalida a subscription.
    return {
      outcome: "failed",
      statusCode: null,
      shortError: "network_error",
      failureClass: "transient",
    }
  }
}
