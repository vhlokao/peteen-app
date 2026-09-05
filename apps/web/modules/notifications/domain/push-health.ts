/**
 * Módulo: notifications
 * Camada: domain — ESTADO CANÔNICO de push neste dispositivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ESTE ARQUIVO FECHA
 *
 * `avaliarAmbientePush` (lib/push/client.ts) decidia "ativo" olhando SÓ o
 * browser: existe `pushManager.getSubscription()`? Então ativo. Nunca
 * perguntava ao servidor se aquela subscription ainda existe e está válida.
 *
 * Consequência real, confirmada por auditoria: se a linha do servidor fosse
 * revogada por qualquer caminho (404/410, account_cleanup, ação
 * administrativa) enquanto o browser ainda segurasse o objeto local, a tela de
 * Minha Conta continuava exibindo "Notificações ativadas" com check verde —
 * para sempre, porque nada na UI percebia a divergência. O usuário confiava
 * num canal que o servidor já nem tentava usar (o dispatcher cai em
 * `attempted = 0`, que também não alarma ninguém).
 *
 * "Ativado" passa a exigir CONCORDÂNCIA entre os dois lados. Este arquivo é a
 * regra dessa concordância, isolada como função pura — a matriz inteira vira
 * `assert.equal` em push-health.test.ts, sem jsdom e sem QA manual.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STATE DECIDE LÓGICA, REASON DECIDE COPY
 *
 * São dois eixos de propósito. `state` é o conjunto fechado de 5 estados que a
 * UI e o auto-repair consomem; `reason` preserva a CAUSA, que é o que muda o
 * texto mostrado. Sem essa separação, "navegador incompatível" e "ambiente sem
 * VAPID" — que exigem o mesmo comportamento e mensagens opostas — obrigariam a
 * inflar o conjunto de estados com um caso que ninguém trata diferente.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Estados canônicos
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_HEALTH_STATES = [
  /** Browser E servidor concordam: push realmente funciona aqui. */
  "ACTIVE",
  /** Há permissão, mas a cadeia está quebrada em algum ponto reparável. */
  "NEEDS_REPAIR",
  /** Nunca foi ativado neste navegador. É onde o CTA faz sentido. */
  "DISABLED",
  /** `permission === "denied"`. NUNCA pedir de novo — é permanente no browser. */
  "DENIED",
  /** Não há push a oferecer aqui (navegador, modo de execução ou ambiente). */
  "UNSUPPORTED",
] as const

export type PushHealthState = (typeof PUSH_HEALTH_STATES)[number]

export type PushHealthReason =
  /** Os dois lados confirmaram. */
  | "saudavel"
  /**
   * Subscription local existe e o servidor NÃO foi consultado (offline, erro
   * de rede, action indisponível). Continua ACTIVE de propósito — ver
   * "FALHA DE CONSULTA NÃO É DIAGNÓSTICO" abaixo.
   */
  | "servidor_nao_consultado"
  /** Permissão concedida, mas o browser não tem subscription nenhuma. */
  | "sem_subscription_local"
  /** Browser tem subscription; o servidor não tem correspondente válida. */
  | "sem_subscription_no_servidor"
  | "permissao_negada"
  | "nunca_ativado"
  | "navegador_sem_suporte"
  /** iOS/iPadOS compatível, mas fora da Tela de Início. Há ação a sugerir. */
  | "ios_fora_da_tela_inicio"
  /** Sem NEXT_PUBLIC_VAPID_PUBLIC_KEY. Problema de operação, não do usuário. */
  | "ambiente_nao_configurado"
  /**
   * A pessoa desligou push NESTE aparelho de propósito. Distinto de
   * `nunca_ativado` (nunca houve decisão) e, principalmente, de
   * `sem_subscription_local` — que é o MESMO estado técnico, mas sem intenção
   * por trás. Ver lib/push/opt-out.ts.
   */
  | "desativado_pelo_usuario"

// ─────────────────────────────────────────────────────────────────────────────
// Observações — o que cada lado relata
// ─────────────────────────────────────────────────────────────────────────────

/** Fotografia do browser. Coletada por lib/push/client.ts. */
export type ObservacaoBrowser = {
  /** SW + PushManager + Notification presentes (e contexto seguro). */
  suportado: boolean
  /** Só faz sentido quando `suportado === false` — explica o porquê. */
  iosForaDaTelaInicio: boolean
  /** NEXT_PUBLIC_VAPID_PUBLIC_KEY presente. */
  configurado: boolean
  permissao: "default" | "granted" | "denied"
  /** `pushManager.getSubscription()` devolveu algo. */
  temSubscriptionLocal: boolean
  /**
   * A pessoa desligou push neste aparelho de propósito (lib/push/opt-out.ts).
   *
   * Existe porque o estado técnico de "desativei" e o de "perdi a subscription
   * no relogin" são IDÊNTICOS — permissão concedida, nenhuma subscription. Sem
   * este eixo, o reparo automático religaria o que a pessoa acabou de
   * desligar.
   */
  optOutLocal: boolean
}

/**
 * O que o servidor respondeu sobre ESTE endpoint.
 *
 * `consultado: false` é um estado de primeira classe, não um `false`
 * disfarçado: "não perguntei" e "perguntei e não existe" levam a decisões
 * opostas, e colapsá-los num booleano produziria alarme falso a cada oscilação
 * de rede.
 */
export type ObservacaoServidor =
  | { consultado: false }
  | { consultado: true; ativaNesteDispositivo: boolean }

export type SaudePush = {
  state: PushHealthState
  reason: PushHealthReason
  /**
   * Auto-repair silencioso é seguro e deve ser tentado agora?
   *
   * Só verdadeiro quando `permission === "granted"` — nenhum caminho deste
   * módulo autoriza uma re-tentativa que possa abrir prompt nativo.
   */
  autoReparavel: boolean
  /**
   * O reparo precisa criar uma subscription NOVA no browser
   * (`pushManager.subscribe()`), em vez de apenas re-registrar a existente no
   * servidor. Separado porque só este caminho pode esbarrar em exigência de
   * gesto do usuário em algum navegador — e aí vira CTA.
   */
  precisaSubscribeLocal: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// A regra
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado canônico a partir das duas observações.
 *
 * ORDEM DAS GUARDAS — cada uma existe por um motivo:
 *
 *  1. Suporte e configuração vêm primeiro: sem eles, `Notification.permission`
 *     nem sequer é uma pergunta com resposta útil.
 *  2. `denied` antes de qualquer coisa sobre subscription: um browser negado
 *     pode ainda ter subscription local sobrando de antes da negação, e tratá-la
 *     como sinal de saúde mostraria "ativado" para quem bloqueou push.
 *  3. `default` idem: sem permissão não há entrega, mesmo que sobrasse algum
 *     resquício local.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FALHA DE CONSULTA NÃO É DIAGNÓSTICO
 *
 * Quando o servidor não pôde ser consultado, o resultado é ACTIVE, não
 * NEEDS_REPAIR. Um usuário no metrô, com a aba voltando do sono ou com a
 * Server Action falhando por um instante, veria "suas notificações precisam ser
 * reativadas" sem que nada tivesse acontecido — e aprenderia a ignorar o aviso,
 * que é exatamente o que destrói a utilidade do estado NEEDS_REPAIR quando ele
 * for verdadeiro. O erro seguro aqui é manter o último estado conhecido bom; a
 * próxima reconciliação corrige de graça.
 */
export function avaliarSaudePush(
  browser: ObservacaoBrowser,
  servidor: ObservacaoServidor
): SaudePush {
  const inerte = { autoReparavel: false, precisaSubscribeLocal: false }

  // ── 1. Não há push a oferecer aqui ───────────────────────────────────────
  if (!browser.suportado) {
    return {
      state: "UNSUPPORTED",
      reason: browser.iosForaDaTelaInicio ? "ios_fora_da_tela_inicio" : "navegador_sem_suporte",
      ...inerte,
    }
  }
  if (!browser.configurado) {
    // UNSUPPORTED do ponto de vista de comportamento (nada a fazer nesta tela),
    // mas com razão própria: a copy não pode culpar o navegador por uma
    // variável de ambiente que falta do NOSSO lado.
    return { state: "UNSUPPORTED", reason: "ambiente_nao_configurado", ...inerte }
  }

  // ── 2. Permissão decide antes de qualquer sinal de subscription ──────────
  if (browser.permissao === "denied") {
    return { state: "DENIED", reason: "permissao_negada", ...inerte }
  }
  if (browser.permissao === "default") {
    return { state: "DISABLED", reason: "nunca_ativado", ...inerte }
  }

  // ── 3. permission === "granted" — a partir daqui reparar é seguro ────────
  // `subscribe()` com permissão já concedida não abre prompt nativo, então
  // nenhum caminho abaixo arrisca queimar a permissão do usuário.
  const base = avaliarComPermissao(browser, servidor)

  // ── 4. Intenção do usuário vence o reparo — mas nunca vence a realidade ──
  // Só suprime NEEDS_REPAIR. Se as duas pontas dizem que push está funcionando,
  // o estado é ACTIVE mesmo com a marca presente: uma desativação que não
  // chegou a concluir deixaria a marca mentindo, e a tela deve descrever o que
  // É, não o que alguém quis que fosse. Quem limpa a marca nesse caso é o
  // componente, que tem efeitos colaterais permitidos.
  if (base.state === "NEEDS_REPAIR" && browser.optOutLocal) {
    return { state: "DISABLED", reason: "desativado_pelo_usuario", ...inerte }
  }

  return base
}

function avaliarComPermissao(
  browser: ObservacaoBrowser,
  servidor: ObservacaoServidor
): SaudePush {
  const inerte = { autoReparavel: false, precisaSubscribeLocal: false }

  if (!browser.temSubscriptionLocal) {
    return {
      state: "NEEDS_REPAIR",
      reason: "sem_subscription_local",
      autoReparavel: true,
      precisaSubscribeLocal: true,
    }
  }

  if (!servidor.consultado) {
    return { state: "ACTIVE", reason: "servidor_nao_consultado", ...inerte }
  }

  if (!servidor.ativaNesteDispositivo) {
    return {
      state: "NEEDS_REPAIR",
      reason: "sem_subscription_no_servidor",
      autoReparavel: true,
      // A subscription local existe e é reaproveitável: basta re-registrá-la no
      // servidor. Nada precisa ser criado no browser.
      precisaSubscribeLocal: false,
    }
  }

  return { state: "ACTIVE", reason: "saudavel", ...inerte }
}

// ─────────────────────────────────────────────────────────────────────────────
// CADÊNCIA da reconciliação automática
//
// A reconciliação roda em toda tela autenticada, então precisa de um freio:
// sem ele, cada troca de aba e cada volta de foco dispararia uma Server Action,
// e o resultado seria polling disfarçado — exatamente o que a missão proíbe.
//
// 15 minutos é escolhido pelo que a reconciliação PRECISA pegar: uma
// subscription revogada não é uma emergência de segundos, é um estado que
// precisa ser corrigido antes do próximo evento de negócio. Como o gatilho mais
// importante (a primeira carga depois do login) não passa pelo freio — não há
// carimbo anterior na sessão nova — o intervalo só governa os retornos de foco.
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_RECONCILIATION_MIN_INTERVAL_MS = 15 * 60 * 1000

/**
 * Já passou tempo suficiente desde a última reconciliação?
 *
 * `ultimaEmMs === null` significa "nunca reconciliou nesta sessão" e sempre
 * libera: é o caso do primeiro carregamento após um login, o momento mais
 * importante de todos (o logout anterior revogou a subscription, e é aqui que
 * ela volta).
 *
 * Um carimbo no FUTURO (relógio do sistema alterado, storage adulterado)
 * também libera, em vez de travar a reconciliação para sempre.
 */
export function deveReconciliarAgora(ultimaEmMs: number | null, agoraMs: number): boolean {
  if (ultimaEmMs === null || !Number.isFinite(ultimaEmMs)) return true
  if (ultimaEmMs > agoraMs) return true
  return agoraMs - ultimaEmMs >= PUSH_RECONCILIATION_MIN_INTERVAL_MS
}

// ─────────────────────────────────────────────────────────────────────────────
// COPY — uma frase por estado, nunca por razão
//
// A copy é do ESTADO porque é isso que a pessoa precisa entender ("funciona" /
// "não funciona" / "está bloqueado"). As duas razões que exigem texto próprio
// dentro de UNSUPPORTED são tratadas explicitamente — e são as únicas.
// ─────────────────────────────────────────────────────────────────────────────

export type PushHealthCopy = {
  titulo: string
  /** Complemento opcional. `null` quando o título já basta. */
  detalhe: string | null
}

export function resolvePushHealthCopy(saude: SaudePush): PushHealthCopy {
  switch (saude.state) {
    case "ACTIVE":
      return { titulo: "Notificações ativadas", detalhe: null }

    case "NEEDS_REPAIR":
      return {
        titulo: "Notificações precisam ser reativadas",
        detalhe:
          "A conexão deste aparelho com as notificações se perdeu. Estamos restabelecendo.",
      }

    case "DENIED":
      return {
        titulo: "Notificações bloqueadas no navegador",
        detalhe:
          "Libere as notificações para este site nas configurações do navegador. A página se atualiza sozinha quando você voltar.",
      }

    case "UNSUPPORTED":
      if (saude.reason === "ios_fora_da_tela_inicio") {
        return {
          titulo: "Adicione o Peteen à Tela de Início",
          detalhe: "No iPhone, as notificações só funcionam com o app instalado.",
        }
      }
      if (saude.reason === "ambiente_nao_configurado") {
        return {
          titulo: "Notificações indisponíveis no momento",
          detalhe: null,
        }
      }
      // "notificações push" saiu em GATE-10: "push" é o nome do protocolo, não
      // do que a pessoa recebe, e aqui ela está justamente diante da tela que
      // deveria explicar a limitação sem jargão.
      return {
        titulo: "Este navegador não oferece notificações",
        detalhe: "Tente por outro navegador ou pelo celular.",
      }

    case "DISABLED":
      return {
        titulo: "Notificações desativadas",
        detalhe: "Receba avisos importantes sobre seus atendimentos.",
      }
  }
}

/**
 * Trava de contrato para o teste: NENHUM estado além de ACTIVE pode produzir
 * uma copy que afirme que as notificações estão funcionando.
 *
 * Existe porque a regressão que esta missão corrige foi exatamente essa — dizer
 * "ativado" num estado incoerente. Um teste sobre a string é grosseiro, mas
 * pega a reintrodução do problema por qualquer caminho, inclusive por alguém
 * reaproveitando a copy de ACTIVE em outro ramo do switch.
 *
 * O `\b` inicial NÃO é decorativo: sem ele, "desativadas" e "reativadas"
 * casariam com o padrão e o teste acusaria como afirmação de saúde justamente
 * as duas copies que dizem o contrário.
 */
export function copyAfirmaQueEstaAtivo(copy: PushHealthCopy): boolean {
  return /\bativad[ao]s?\b/i.test(copy.titulo)
}
