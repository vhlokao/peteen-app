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

// ─────────────────────────────────────────────────────────────────────────────
// Estado OBSERVADO do ambiente
//
// Extraído de PushOptIn em R2B.5 porque passou a ter dois leitores: o opt-in da
// Conta e o convite contextual da Request. Duplicar a avaliação faria as duas
// telas discordarem sobre "push está ativo?" no dia em que uma das condições
// mudasse — e é exatamente essa pergunta que decide se o convite aparece.
//
// Só OBSERVA. Nada aqui pede permissão, cria subscription ou toca o servidor.
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoDoAmbientePush =
  /** O BROWSER não tem as APIs (ou contexto inseguro). Nada a oferecer. */
  | "sem-suporte"
  /** iOS/iPadOS compatível, mas fora da Tela de Início — a API só existe em
   *  standalone. Distinto de "sem-suporte": há uma ação real a sugerir. */
  | "ios-fora-da-tela-inicio"
  /** Ambiente sem NEXT_PUBLIC_VAPID_PUBLIC_KEY. Problema de configuração. */
  | "nao-configurado"
  /** permission === "denied". NUNCA pedir de novo. */
  | "negado"
  /** Subscription viva: push realmente funcionando neste dispositivo. */
  | "ativo"
  /** permission === "granted" mas SEM subscription — falta um passo explícito. */
  | "permitido-sem-subscription"
  /** permission === "default": nunca perguntamos. É onde o CTA faz sentido. */
  | "desativado"

/**
 * Fotografia do ambiente de push neste dispositivo, agora.
 *
 * `permission === "granted"` sozinho NÃO significa push ativo — por isso o
 * endpoint é consultado antes de concluir "ativo". Tratar a permissão como
 * suficiente foi a causa do estado que "voltava ao início" depois de o usuário
 * liberar a permissão manualmente.
 */
export async function avaliarAmbientePush(
  vapidPublicKey: string
): Promise<EstadoDoAmbientePush> {
  if (!pushSuportado()) {
    return iosForaDaTelaDeInicio() ? "ios-fora-da-tela-inicio" : "sem-suporte"
  }
  if (!vapidPublicKey) return "nao-configurado"

  if (Notification.permission === "denied") return "negado"

  const endpoint = await obterEndpointAtual()
  if (endpoint) return "ativo"

  if (Notification.permission === "granted") return "permitido-sem-subscription"
  return "desativado"
}

export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/**
 * iOS/iPadOS fora do modo instalado (Tela de Início) é a causa mais comum de
 * `pushSuportado()` retornar false — não "navegador incompatível". A partir do
 * iOS 16.4 o WebKit suporta Web Push, mas só expõe `PushManager` quando o site
 * roda como PWA instalada (`display-mode: standalone`); no Safari normal a API
 * simplesmente não existe no `window`, indistinguível à primeira vista de um
 * navegador de verdade sem suporte. Sem essa distinção, o usuário de iPhone
 * recebia a mensagem "este navegador não suporta", que é falsa: o navegador
 * suporta, só não neste modo de execução.
 *
 * Detecção por engine (WebKit em iOS), não por "Safari" — Chrome/Firefox no
 * iOS também rodam sobre WebKit e têm a mesma restrição.
 */
export function iosForaDaTelaDeInicio(): boolean {
  if (typeof window === "undefined") return false

  const ua = window.navigator.userAgent
  // iPadOS 13+ se anuncia como "Macintosh", mas expõe múltiplos touch points
  // (um Mac de verdade não tem touch) — é o sinal padrão para diferenciar.
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)

  if (!isIOSDevice) return false

  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true

  return !standalone
}

/**
 * Registra o SW e SÓ retorna quando ele está ATIVO.
 *
 * `register()` resolve assim que o registro é aceito — o worker pode ainda
 * estar em `installing`. Chamar `pushManager.subscribe()` nesse instante lança
 * `InvalidStateError` ("no active Service Worker"), que era engolido por um
 * catch cego e virava "não foi possível ativar" sem explicação: o usuário
 * clicava, o botão voltava ao estado inicial e nada acontecia.
 *
 * `navigator.serviceWorker.ready` é a espera correta — resolve com a
 * registration cujo worker está ativo e controlando a página.
 */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSuportado()) return null
  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" })
    // Espera o worker ficar ativo. Sem isso, subscribe() falha de forma opaca.
    return await navigator.serviceWorker.ready
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
export type MotivoFalhaAssinatura =
  /** Não havia Service Worker ativo no momento do subscribe. */
  | "sem-worker-ativo"
  /** applicationServerKey malformada. */
  | "chave-invalida"
  /**
   * Já existe uma subscription neste browser criada com OUTRA chave VAPID.
   * Acontece sempre que o par VAPID do ambiente é trocado — o browser guarda a
   * subscription antiga e recusa criar outra com chave diferente. Só sai desse
   * estado com `unsubscribe()` da subscription antiga.
   */
  | "chave-divergente"
  /** O push service (FCM etc.) recusou ou está inalcançável. */
  | "push-serviço-indisponivel"
  /** Permissão negada no momento da chamada. */
  | "recusado"
  | "desconhecido"

export type ResultadoAssinatura =
  | { ok: true; subscription: SubscriptionSerializada }
  | { ok: false; motivo: MotivoFalhaAssinatura }

/**
 * Classifica a falha do `subscribe()` pelo nome do erro do browser, em vez de
 * engolir tudo como "não deu". Cada causa exige uma ação diferente do usuário,
 * e mostrar a mesma frase para todas foi o que tornou o problema indiagnosticável.
 */
function classificarErroAssinatura(err: unknown): ResultadoAssinatura {
  const nome = typeof err === "object" && err !== null && "name" in err ? String(err.name) : ""
  const msg =
    typeof err === "object" && err !== null && "message" in err ? String(err.message) : ""

  // Preserva o erro ORIGINAL no console. Um catch que classifica sem registrar
  // o motivo cru torna a falha indiagnosticável — foi exatamente o que
  // aconteceu aqui: "não foi possível registrar" sem nenhuma pista da causa.
  // Não contém PII: só nome e mensagem do erro do browser.
  console.error("[push] falha ao assinar", { name: nome, message: msg })

  if (nome === "InvalidStateError") return { ok: false, motivo: "sem-worker-ativo" }
  // Chave VAPID malformada / de outro par que o browser já registrou.
  if (nome === "InvalidAccessError" || nome === "InvalidCharacterError") {
    return { ok: false, motivo: "chave-invalida" }
  }
  if (nome === "NotAllowedError") return { ok: false, motivo: "recusado" }

  // AbortError é o que o Chromium usa quando o PRÓPRIO push service recusa o
  // registro — inclusive quando já existe uma subscription com applicationServerKey
  // diferente, e quando o serviço não é alcançável pela rede.
  if (nome === "AbortError") {
    return /different applicationServerKey|already exists/i.test(msg)
      ? { ok: false, motivo: "chave-divergente" }
      : { ok: false, motivo: "push-serviço-indisponivel" }
  }
  return { ok: false, motivo: "desconhecido" }
}

/**
 * A subscription existente foi criada com ESTA mesma chave VAPID?
 *
 * O browser guarda a `applicationServerKey` usada no registro. Se o ambiente
 * trocar o par VAPID (rotação, ou simplesmente um par novo em DEV), a
 * subscription antiga continua no browser e o `subscribe()` com a chave nova é
 * recusado — sem que nada no servidor indique o motivo. Comparar antes evita
 * cair nesse erro.
 */
function mesmaChaveVapid(sub: PushSubscription, vapidPublicKey: string): boolean {
  const usada = sub.options?.applicationServerKey
  if (!usada) return false
  const atual = urlBase64ToUint8Array(vapidPublicKey)
  const bytes = new Uint8Array(usada)
  if (bytes.length !== atual.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== atual[i]) return false
  }
  return true
}

export async function assinar(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<ResultadoAssinatura> {
  try {
    const existente = await reg.pushManager.getSubscription()

    if (existente) {
      // Reaproveita só se foi criada com a MESMA chave. Uma subscription de um
      // par VAPID anterior é lixo: o servidor atual não consegue assinar
      // mensagens para ela, e mantê-la bloqueia a criação de uma válida.
      if (mesmaChaveVapid(existente, vapidPublicKey)) {
        const s = serializar(existente)
        return s ? { ok: true, subscription: s } : { ok: false, motivo: "desconhecido" }
      }
      console.warn("[push] subscription existente usa outra chave VAPID — descartando")
      await existente.unsubscribe().catch(() => {})
    }

    const nova = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
    const s = serializar(nova)
    return s ? { ok: true, subscription: s } : { ok: false, motivo: "desconhecido" }
  } catch (err) {
    const classificado = classificarErroAssinatura(err)

    // Recuperação de última instância: o browser recusou por já existir uma
    // subscription com outra chave, mas `getSubscription()` não a devolveu
    // (estado inconsistente conhecido). Descarta e tenta UMA vez.
    if (classificado.ok === false && classificado.motivo === "chave-divergente") {
      try {
        const presa = await reg.pushManager.getSubscription()
        if (presa) await presa.unsubscribe()
        const nova = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        })
        const s = serializar(nova)
        return s ? { ok: true, subscription: s } : { ok: false, motivo: "desconhecido" }
      } catch (err2) {
        return classificarErroAssinatura(err2)
      }
    }
    return classificado
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
): Promise<ResultadoAssinatura> {
  try {
    const atual = await reg.pushManager.getSubscription()
    if (atual) await atual.unsubscribe()
  } catch {
    // Prossegue: subscribe() abaixo ainda pode ter sucesso.
  }
  return assinar(reg, vapidPublicKey)
}
