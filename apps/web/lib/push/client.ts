/**
 * Helpers de Web Push no browser.
 *
 * Compartilhado entre o opt-in e os botões de logout — o fluxo de logout
 * precisa do endpoint corrente e do `unsubscribe()`, mas não do opt-in inteiro.
 *
 * NENHUMA função aqui pede permissão sozinha. `Notification.requestPermission()`
 * só acontece em `requestPermission()`, chamada exclusivamente a partir de um
 * gesto explícito do usuário: um `denied` é permanente no browser e queima a
 * chance para sempre.
 */

export const SW_PATH = "/sw.js"

export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado()) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: "/" })
  } catch {
    return null
  }
}

/** Registro já existente, sem criar um novo. Usado no caminho de logout. */
async function registroExistente(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado()) return null
  try {
    return (await navigator.serviceWorker.getRegistration(SW_PATH)) ?? null
  } catch {
    return null
  }
}

/** Endpoint da subscription corrente, ou null. Nunca cria subscription. */
export async function obterEndpointAtual(): Promise<string | null> {
  const reg = await registroExistente()
  if (!reg) return null
  try {
    const sub = await reg.pushManager.getSubscription()
    return sub?.endpoint ?? null
  } catch {
    return null
  }
}

/**
 * Desinscreve no browser — devolve a subscription ao push service.
 *
 * Passo indispensável do logout: é o único mecanismo que realmente mata a
 * subscription na origem. Revogar só no nosso banco impede que NÓS enviemos,
 * mas o registro continua vivo no push service.
 */
export async function desinscreverLocalmente(): Promise<boolean> {
  const reg = await registroExistente()
  if (!reg) return false
  try {
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return false
    return await sub.unsubscribe()
  } catch {
    return false
  }
}

/** VAPID public key em base64url → Uint8Array, formato exigido pelo PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const saida = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) saida[i] = raw.charCodeAt(i)
  return saida
}

export type SubscriptionSerializada = {
  endpoint: string
  p256dh: string
  auth: string
}

function serializar(sub: PushSubscription): SubscriptionSerializada | null {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) return null
  return { endpoint: json.endpoint, p256dh, auth }
}

/**
 * Cria (ou recupera) a subscription do browser.
 *
 * `userVisibleOnly: true` é obrigatório: sem ele os browsers recusam a
 * subscription. Também é o compromisso de que todo push resulta em notificação
 * visível — nada de push silencioso de rastreamento.
 */
export async function assinar(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<SubscriptionSerializada | null> {
  try {
    const existente = await reg.pushManager.getSubscription()
    if (existente) return serializar(existente)

    const nova = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
    return serializar(nova)
  } catch {
    return null
  }
}

/**
 * Descarta a subscription atual e negocia uma NOVA com o push service.
 *
 * É a resposta do client a SUBSCRIPTION_CONFLICT — o caso em que este browser
 * ainda segura a subscription de outro usuário (logout anormal, aba fechada
 * antes do unsubscribe).
 *
 * Por que renegociar em vez de o servidor transferir o dono: a tripla
 * (endpoint, p256dh, auth) é um segredo PORTADOR, copiável de um log ou de um
 * XSS, e portanto não prova posse do device. Já conseguir um endpoint NOVO
 * exige execução real dentro deste browser, na nossa origem — é uma prova
 * muito mais forte, e não abre caminho para sequestro de subscription alheia.
 */
export async function renegociarSubscription(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<SubscriptionSerializada | null> {
  try {
    const atual = await reg.pushManager.getSubscription()
    if (atual) await atual.unsubscribe()
  } catch {
    // Prossegue: subscribe() abaixo ainda pode ter sucesso.
  }
  return assinar(reg, vapidPublicKey)
}
