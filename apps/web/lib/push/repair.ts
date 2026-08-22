/**
 * Reparo de push — a sequência que restabelece a subscription deste device.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO SAIU DE DENTRO DO COMPONENTE
 *
 * A sequência (registrar SW → assinar → registrar no servidor → renegociar uma
 * vez em conflito) vivia dentro de `PushOptIn`, acoplada aos `setState` dele.
 * Agora ela tem DOIS chamadores — o botão da Conta e a reconciliação
 * automática que roda em toda tela autenticada — e duplicá-la seria repetir o
 * erro que o projeto já corrigiu no logout: uma sequência cuja ORDEM importa,
 * copiada em dois lugares, diverge em silêncio no primeiro ajuste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE MÓDULO NUNCA PEDE PERMISSÃO. É A REGRA CENTRAL.
 *
 * `Notification.requestPermission()` não é chamado aqui e não pode passar a
 * ser: um `denied` é PERMANENTE no browser, e um reparo automático que
 * dispare o prompt nativo queimaria o canal para sempre, sem gesto do usuário
 * e sem que ele entendesse o que aconteceu. A primeira linha da função é a
 * guarda que garante isso — `granted` já concedido é pré-condição, não
 * consequência.
 *
 * Com a permissão já concedida, `pushManager.subscribe()` não abre prompt
 * nenhum e não exige gesto: o browser devolve a subscription existente ou cria
 * outra silenciosamente. É o que torna o reparo automático possível. Nos
 * navegadores que ainda assim exigirem gesto, o `subscribe()` falha com
 * `NotAllowedError`, que `assinar` classifica como `recusado` — e o chamador
 * cai no CTA explícito em vez de insistir.
 */

import {
  assinar,
  registrarServiceWorker,
  renegociarSubscription,
  type MotivoFalhaAssinatura,
} from "./client"

export type MotivoFalhaReparo =
  /** Permissão não é `granted`. Reparo silencioso é proibido — ver o cabeçalho. */
  | "sem-permissao"
  | "sem-service-worker"
  /** O browser recusou criar/recuperar a subscription. Ver `detalhe`. */
  | "falha-assinatura"
  | "rate-limit-devices"
  | "rate-limit-creates"
  | "push-desabilitado"
  | "nao-autenticado"
  | "interno"

export type ResultadoReparo =
  | { ok: true }
  | { ok: false; motivo: MotivoFalhaReparo; detalhe?: MotivoFalhaAssinatura }

/**
 * Reparo em voo, compartilhado por todos os chamadores desta página.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE SINGLE-FLIGHT
 *
 * Em `/conta` há DOIS chamadores montados ao mesmo tempo e independentes entre
 * si: o `PushOptIn` da própria tela e o `PushHealthReconciler` do AppShell.
 * Cada um tem a sua trava, e nenhuma enxerga a do outro — então na primeira
 * carga os dois podem entrar aqui juntos.
 *
 * O estrago seria pequeno (o servidor é idempotente e resolveria como refresh
 * ou P2002), mas o desperdício é real: duas negociações com o push service e
 * duas Server Actions para produzir exatamente o mesmo resultado. Compartilhar
 * a promessa faz o segundo chamador simplesmente esperar o primeiro.
 */
let reparoEmVoo: Promise<ResultadoReparo> | null = null

/**
 * Restabelece a subscription deste device no browser E no servidor.
 *
 * IDEMPOTENTE por construção, e é isso que permite chamá-la de uma
 * reconciliação automática sem medo: `subscribeToPushAction` faz `refresh`
 * quando o endpoint já existe para o mesmo dono (sem contar no rate limit de
 * criações) e `create` só quando de fato falta. Chamar duas vezes seguidas não
 * produz duas subscriptions.
 */
export function repararPush(vapidPublicKey: string): Promise<ResultadoReparo> {
  if (reparoEmVoo) return reparoEmVoo

  reparoEmVoo = executarReparo(vapidPublicKey).finally(() => {
    // Liberado no fim, com sucesso ou falha: o próximo pedido é uma tentativa
    // NOVA e legítima (a pessoa clicando em "Tentar novamente", por exemplo),
    // não uma repetição da que acabou.
    reparoEmVoo = null
  })

  return reparoEmVoo
}

async function executarReparo(vapidPublicKey: string): Promise<ResultadoReparo> {
  if (!vapidPublicKey) return { ok: false, motivo: "push-desabilitado" }

  // A guarda. Nunca remover: é o que separa "reparo" de "pedir permissão".
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return { ok: false, motivo: "sem-permissao" }
  }

  const reg = await registrarServiceWorker()
  if (!reg) return { ok: false, motivo: "sem-service-worker" }

  let assinatura = await assinar(reg, vapidPublicKey)
  if (!assinatura.ok) {
    return { ok: false, motivo: "falha-assinatura", detalhe: assinatura.motivo }
  }

  const { subscribeToPushAction } = await import(
    "@/modules/notifications/application/push-actions"
  )

  let resultado = await subscribeToPushAction(assinatura.subscription)

  // SUBSCRIPTION_CONFLICT → este browser ainda segura a subscription de OUTRO
  // usuário (logout anormal, aba fechada antes do unsubscribe). Renegocia um
  // endpoint novo e tenta EXATAMENTE uma vez — o servidor nunca transfere dono.
  if (!resultado.success && resultado.code === "SUBSCRIPTION_CONFLICT") {
    const nova = await renegociarSubscription(reg, vapidPublicKey)
    if (!nova.ok) return { ok: false, motivo: "falha-assinatura", detalhe: nova.motivo }
    assinatura = nova
    resultado = await subscribeToPushAction(nova.subscription)
  }

  if (resultado.success) return { ok: true }

  switch (resultado.code) {
    case "RATE_LIMIT_DEVICES":
      return { ok: false, motivo: "rate-limit-devices" }
    case "RATE_LIMIT_CREATES":
      return { ok: false, motivo: "rate-limit-creates" }
    case "PUSH_DISABLED":
      return { ok: false, motivo: "push-desabilitado" }
    case "UNAUTHENTICATED":
      return { ok: false, motivo: "nao-autenticado" }
    default:
      return { ok: false, motivo: "interno" }
  }
}
