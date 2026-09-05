import "server-only"

/**
 * Módulo: notifications
 * Camada: application — dispatcher genérico de Web Push.
 *
 * EVENTOS CONECTADOS HOJE (auditado em GATE-13). O cabeçalho anterior dizia
 * que NENHUM evento de negócio estava ligado e que a única entrada era o smoke
 * — verdade em V0.2, falso desde a integração P0/R2B.3. Um comentário que
 * descreve o oposto do código é pior que nenhum: manda quem investiga uma
 * falha real procurar no lugar errado.
 *
 *   PROFISSIONAL  request_created, request_cancelled_by_tutor
 *   TUTOR         request_accepted, service_started, care_update,
 *                 service_completed, request_cancelled_by_professional
 *
 * Todos entram por `modules/notifications/application/push-service-request-events.ts`,
 * cada um chamado de um único lugar e sempre dentro de `after()`. Disputa e
 * eventos temporais continuam fora, por decisão de escopo.
 *
 * CONTRATOS INEGOCIÁVEIS:
 *
 *   1. `recipientUserId` é SEMPRE resolvido no servidor a partir da entidade.
 *      Nunca chega de client. Não existe nenhuma action pública que despache
 *      para um destinatário arbitrário.
 *
 *   2. `PushDelivery.create()` acontece ANTES de qualquer envio. Se enviássemos
 *      primeiro, um crash entre o envio e o registro duplicaria no retry.
 *      Registrar antes dá AT-MOST-ONCE, que é o viés correto: perder um push é
 *      aceitável (a central in-app é a fonte da verdade), duplicar é spam.
 *
 *   3. P2002 no unique (eventKey, recipientUserId, channel) significa "já
 *      despachado" — retorna em silêncio, sem segundo envio. Sem advisory lock
 *      e sem read-before-create: é um INSERT atômico único, não um
 *      read-then-write como o caso da agenda.
 *
 *   4. NUNCA derruba operação de domínio. Toda a função é best-effort, no mesmo
 *      espírito de `recordRequestAudit`.
 *
 *   5. Payload nunca é persistido: PushDelivery não tem colunas para
 *      title/body/url por decisão de schema.
 */

import { prisma } from "@/lib/prisma/client"
import type { PushDispatchInput, PushDispatchResult } from "../domain/push-types"
import { describeMissingVapidConfig, getVapidConfig } from "../infrastructure/push-config"
import {
  adotarIdentidadeAposEnvioAceito,
  findActiveSubscriptionsForSend,
  revokeGoneSubscription,
} from "../infrastructure/push-repository"
import { sendPush, type SendResult } from "../infrastructure/push-sender"
import {
  acumularFalha,
  decidirRetry,
  diagnosticoVazio,
  ehSubscriptionMorta,
  formatDeliveryDiagnostic,
  temFalha,
  type DeliveryDiagnostic,
} from "../domain/push-failure"
import { avaliarElegibilidade } from "../domain/vapid-fingerprint"
import { getCurrentPushIdentity } from "../infrastructure/runtime-environment"

/** Espera não-bloqueante entre retentativas. */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type EnvioFinal = SendResult & {
  /** Reenvios feitos DEPOIS do primeiro envio. 0 quando não houve retry. */
  retries: number
}

/**
 * Envia para UMA subscription, com retry limitado para falha TRANSITÓRIA.
 *
 * A política inteira (quais classes, quantas vezes, com que espera, até que
 * prazo) vive em `decidirRetry`, no domínio — aqui só há o laço. Isso é o que
 * permite exercer a política sem rede e sem relógio real nos testes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE REENVIAR NÃO DUPLICA NOTIFICAÇÃO NA PRÁTICA
 *
 * O caso incômodo do retry é o timeout: o push service pode ter ACEITADO e a
 * resposta ter se perdido, e aí o reenvio entrega a mesma mensagem duas vezes.
 * Isso não vira duas notificações porque todo payload deste módulo carrega
 * `tag` (ver COPY_POR_KIND) e o SO COLAPSA notificações de mesma tag — a
 * segunda substitui a primeira na bandeja em vez de empilhar. O risco residual
 * é um re-alerta (som/vibração), não uma notificação duplicada. Trocar isso por
 * perder o aviso inteiro seria o negócio errado.
 *
 * O contador de idempotência do EVENTO (`PushDelivery`) não é tocado aqui:
 * o claim já aconteceu antes, uma única vez, e retry é dentro do mesmo claim.
 */
async function enviarComRetry(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushDispatchInput["payload"]
): Promise<EnvioFinal> {
  const inicio = Date.now()
  let tentativas = 0
  let ultimo: SendResult

  for (;;) {
    ultimo = await sendPush(subscription, payload)
    tentativas++

    if (ultimo.outcome === "accepted") break

    const decisao = decidirRetry({
      // `failureClass` só é null em sucesso, que já saiu do laço acima.
      classe: ultimo.failureClass ?? "transient",
      tentativasFeitas: tentativas,
      decorridoMs: Date.now() - inicio,
    })
    if (!decisao.retry) break

    await esperar(decisao.esperarMs)
  }

  return { ...ultimo, retries: tentativas - 1 }
}

const VAZIO: PushDispatchResult = {
  alreadyDispatched: false,
  pushEnabled: false,
  attempted: 0,
  accepted: 0,
  failed: 0,
  invalid: 0,
}

/** Evita repetir o aviso de configuração ausente a cada evento. */
let avisouConfigAusente = false

export async function dispatchPush(input: PushDispatchInput): Promise<PushDispatchResult> {
  // ── 0. Push desabilitado → no-op seguro ───────────────────────────────────
  // Nem sequer cria PushDelivery: registrar uma tentativa que nunca poderia
  // acontecer poluiria a telemetria e, pior, queimaria o eventKey — quando a
  // configuração chegasse, o P2002 impediria o despacho legítimo.
  // A config é lida (não só checada) porque o isolamento de ambiente precisa da
  // chave PÚBLICA para derivar o fingerprint deste sender.
  const vapid = getVapidConfig()
  if (!vapid) {
    if (!avisouConfigAusente) {
      console.warn("[push] disabled", { faltando: describeMissingVapidConfig() })
      avisouConfigAusente = true
    }
    return { ...VAZIO }
  }

  // ── 1. Claim de idempotência ANTES de qualquer envio ──────────────────────
  let deliveryId: string
  try {
    const delivery = await prisma.pushDelivery.create({
      data: {
        eventKey: input.eventKey,
        eventType: input.eventType,
        entityId: input.entityId,
        recipientUserId: input.recipientUserId,
        // channel usa o default "push" do schema.
      },
      select: { id: true },
    })
    deliveryId = delivery.id
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      // Evento já despachado. Retorna em silêncio — nenhum segundo envio.
      return { ...VAZIO, pushEnabled: true, alreadyDispatched: true }
    }
    console.error("[push] claim_failed", {
      eventType: input.eventType,
      erro: String(err).slice(0, 120),
    })
    return { ...VAZIO, pushEnabled: true }
  }

  // ── 2. Subscriptions ativas do destinatário ───────────────────────────────
  let ativas: Awaited<ReturnType<typeof findActiveSubscriptionsForSend>>
  try {
    ativas = await findActiveSubscriptionsForSend(input.recipientUserId)
  } catch (err) {
    console.error("[push] load_subscriptions_failed", {
      deliveryId,
      erro: String(err).slice(0, 120),
    })
    return { ...VAZIO, pushEnabled: true }
  }

  // ── 2.1 Isolamento de ambiente — filtro ANTES de qualquer envio ───────────
  // Produção, preview e dev compartilham o MESMO banco. Sem este filtro o
  // dispatcher local enxergava devices de produção, tomava 403 do FCM e — pior
  // que falhar — poderia notificar um usuário real a partir de uma máquina de
  // desenvolvimento.
  //
  // A identidade tem DOIS eixos e os dois são verificados. O fingerprint sozinho
  // não bastaria: se preview herdar a mesma VAPID de produção (marcar a variável
  // para os três ambientes é o default de menor resistência na Vercel), as
  // chaves batem e um deploy de branch alcançaria devices reais. Ver
  // `avaliarElegibilidade` para a regra completa, inclusive identidade parcial.
  const identidade = getCurrentPushIdentity(vapid.publicKey)
  const environment = identidade.runtimeEnvironment

  const elegiveis: typeof ativas = []
  /** Ids sem identidade completa que produção vai tentar — candidatos à adoção. */
  const emProvaDeIdentidade = new Set<string>()
  let skippedEnvironmentMismatch = 0
  let skippedFingerprintMismatch = 0
  let skippedLegacyOutsideProduction = 0

  for (const s of ativas) {
    const veredito = avaliarElegibilidade({
      subscriptionFingerprint: s.vapidKeyFingerprint,
      subscriptionEnvironment: s.runtimeEnvironment,
      senderFingerprint: identidade.vapidKeyFingerprint,
      senderEnvironment: identidade.runtimeEnvironment,
    })
    if (!veredito.eligible) {
      if (veredito.motivo === "environment_divergente") skippedEnvironmentMismatch++
      else if (veredito.motivo === "fingerprint_divergente") skippedFingerprintMismatch++
      else skippedLegacyOutsideProduction++
      continue
    }
    if (veredito.motivo === "legacy_producao") emProvaDeIdentidade.add(s.id)
    elegiveis.push(s)
  }

  // Log com CONTAGENS, nunca com endpoint, p256dh, auth ou chave. Separa os três
  // motivos de skip porque eles pedem reações diferentes: ambiente divergente é
  // ESPERADO (dev olhando o banco compartilhado); fingerprint divergente com o
  // mesmo ambiente é ALARME de configuração; legado fora de produção é a fila
  // que encolhe sozinha conforme as linhas se provam.
  console.info("[push] eligibility", {
    deliveryId,
    eventType: input.eventType,
    environment,
    ativas: ativas.length,
    eligible: elegiveis.length,
    skippedEnvironmentMismatch,
    skippedFingerprintMismatch,
    skippedLegacyOutsideProduction,
    emProvaDeIdentidade: emProvaDeIdentidade.size,
  })

  // ── ZERO ELEGÍVEIS — CONTRATO OFICIAL, decisão fechada ───────────────────
  // Cobre os dois casos que terminam sem envio: o usuário não tem device, ou
  // os devices que tem pertencem a outro ambiente. Nos dois, `attempted = 0` —
  // NUNCA `failed`. Incompatibilidade de ambiente não é falha de sender nem de
  // aparelho, e contá-la como falha inflaria a métrica que deveria denunciar
  // problemas reais de entrega.
  //
  // O claim PERMANECE e o evento é considerado CONSUMIDO para push. Se o
  // usuário assinar um minuto depois, o mesmo eventKey devolve
  // alreadyDispatched e NÃO há replay — push é aviso do MOMENTO; reenviar um
  // evento antigo porque um device apareceu depois entregaria notificação
  // desatualizada. A central in-app é a fonte da verdade e já mostra tudo.
  //
  // RISCO ACEITO NO V0, registrado explicitamente: como o claim acontece ANTES
  // do envio (garantindo at-most-once), um crash entre o claim e o send perde
  // aquele push — e o estado resultante é indistinguível deste aqui (mesma
  // linha, mesmos contadores em zero). Preferimos perder um push a duplicar,
  // porque o histórico real nunca depende deste canal. Sem fila, sem outbox,
  // sem retry no V0.
  if (elegiveis.length === 0) {
    return { ...VAZIO, pushEnabled: true }
  }

  const subscriptions = elegiveis

  console.info("[push] attempted", {
    deliveryId,
    eventType: input.eventType,
    subscriptionCount: subscriptions.length,
  })

  // ── 3. Envio — allSettled isola devices ───────────────────────────────────
  // Um aparelho morto nunca pode impedir os demais de receber. Cada device tem
  // a PRÓPRIA sequência de retry: o prazo de `decidirRetry` é por device e as
  // sequências correm em paralelo, então o retry não multiplica a latência
  // total pelo número de aparelhos.
  const resultados = await Promise.allSettled(
    subscriptions.map((s) =>
      enviarComRetry({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, input.payload)
    )
  )

  let accepted = 0
  let failed = 0
  let invalid = 0
  const mortas: string[] = []
  /** Sem identidade completa que o push service ACEITOU — ver abaixo. */
  const identidadesProvadas: string[] = []

  /**
   * Telemetria classificada da entrega inteira.
   *
   * SEMÂNTICA, fixada aqui porque é o que o leitor precisa saber para não ler
   * errado: `t`/`c`/`p` contam DEVICES pelo desfecho FINAL (um device que
   * falhou transitoriamente duas vezes e depois foi aceito não conta em `t`);
   * `r` conta o total de reenvios da entrega, incluindo os que terminaram em
   * sucesso. Assim `t+c+p` responde "quantos aparelhos ficaram sem" e `r`
   * responde "quanto trabalho extra isso custou", que são perguntas diferentes.
   */
  let diagnostico: DeliveryDiagnostic = diagnosticoVazio()

  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i]!
    if (r.status === "rejected") {
      // sendPush não deve lançar por contrato — mas quando lança, descartar o
      // motivo torna a falha indiagnosticável. Foi exatamente o que aconteceu
      // num E2E real: `lastError` gravou só "sender_threw" e a causa (VAPID de
      // produção malformada) ficou invisível. Preserva a mensagem original,
      // truncada para caber na coluna e sem PII.
      failed++
      const motivo =
        typeof r.reason === "object" && r.reason !== null && "message" in r.reason
          ? String((r.reason as { message: unknown }).message)
          : String(r.reason)
      console.error("[push] sender lançou", { motivo: motivo.slice(0, 120) })
      // Classe `configuration`: um sender que LANÇA é defeito nosso, não do
      // canal — e não deve ser confundido com instabilidade do push service.
      diagnostico = acumularFalha(diagnostico, {
        classe: "configuration",
        codigo: "sender_threw",
        retries: 0,
      })
      continue
    }

    const res = r.value

    if (res.outcome === "accepted") {
      accepted++
      // Retentativa que terminou em sucesso continua sendo trabalho extra que
      // aconteceu — some em `r` sem contar como device perdido.
      diagnostico = { ...diagnostico, retries: diagnostico.retries + res.retries }

      // Prova de pertencimento de uma linha sem identidade completa: o push
      // service aceitou a mensagem assinada com ESTE par VAPID, a única
      // evidência real de que o par corresponde ao usado na criação. Só agora a
      // identidade é gravada — nunca por backfill, que seria afirmar sem
      // verificar. Um 403 (mismatch de VAPID) cai em `failed` e não chega aqui,
      // então nunca adota.
      const provada = subscriptions[i]!
      if (emProvaDeIdentidade.has(provada.id)) {
        identidadesProvadas.push(provada.id)
      }
      continue
    }

    diagnostico = acumularFalha(diagnostico, {
      classe: res.failureClass ?? "transient",
      codigo: res.shortError,
      retries: res.retries,
    })

    if (res.outcome === "invalid") {
      invalid++
    } else {
      failed++
    }

    // REVOGAÇÃO SÓ POR MORTE COMPROVADA. Chamada explícita a
    // `ehSubscriptionMorta` em vez de reaproveitar `outcome === "invalid"`:
    // as duas coincidem hoje, mas esta é a linha que decide destruir o acesso
    // de um aparelho, e ela precisa apontar para a autoridade única do domínio.
    // Uma falha de CONFIGURAÇÃO (401/403) jamais chega aqui — ver o comentário
    // de `ehSubscriptionMorta`.
    if (ehSubscriptionMorta(res.statusCode)) {
      mortas.push(subscriptions[i]!.id)
    }
  }

  // Entrega totalmente limpa (nenhuma falha, nenhum reenvio) não grava
  // diagnóstico: `null` continua significando "nada a relatar", e é isso que
  // permite ao leitor distinguir uma linha saudável de uma que precisou de
  // trabalho extra para chegar ao mesmo lugar.
  const ultimoErro =
    temFalha(diagnostico) || diagnostico.retries > 0
      ? formatDeliveryDiagnostic(diagnostico)
      : null

  // ── 3.1 Adoção de identidade PROVADA ─────────────────────────────────────
  // Transforma sucesso real do push service em identidade persistida — os dois
  // eixos juntos, no mesmo update. Uma linha adotada aqui deixa de depender da
  // regra de legado e passa a ser filtrada como qualquer outra.
  //
  // Só produção chega aqui: `legacy_producao` é o único motivo que alimenta
  // `emProvaDeIdentidade`, e ele exige `senderEnvironment === "production"`.
  //
  // Best-effort e isolado: falhar em gravar não pode desfazer um push já ACEITO
  // nem derrubar o dispatch. Na pior hipótese a linha continua incompleta e é
  // reavaliada no próximo envio.
  for (const id of identidadesProvadas) {
    try {
      const adotadas = await adotarIdentidadeAposEnvioAceito({ subscriptionId: id, identidade })
      if (adotadas > 0) {
        console.info("[push] identidade_adotada", { subscriptionId: id, environment })
      }
    } catch (err) {
      console.error("[push] identidade_adocao_falhou", {
        subscriptionId: id,
        erro: String(err).slice(0, 120),
      })
    }
  }

  // ── 4. Revoga as comprovadamente mortas (404/410) ─────────────────────────
  // Esta é a ÚNICA origem legítima de reason='gone'. Nunca acionada por logout:
  // Web Push e Supabase Auth são sistemas independentes e nenhum signOut, nem
  // global, invalida uma subscription no push service.
  for (const id of mortas) {
    try {
      await revokeGoneSubscription(id)
      console.info("[push] revoked", { subscriptionId: id, reason: "gone" })
    } catch (err) {
      console.error("[push] revoke_gone_failed", {
        subscriptionId: id,
        erro: String(err).slice(0, 120),
      })
    }
  }

  // ── 5. Contadores ─────────────────────────────────────────────────────────
  // `attemptedCount` = subscriptions efetivamente tentadas.
  // `acceptedCount`  = aceito pelo PUSH SERVICE. Nunca "delivered".
  // `lastError`      = diagnóstico ESTRUTURADO (ver push-failure.ts). É o que
  //                    torna transitório, configuração e permanente
  //                    distinguíveis sem coluna nova — `formatDeliveryDiagnostic`
  //                    já respeita o VARCHAR(120), então não há slice aqui.
  try {
    await prisma.pushDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptedCount: subscriptions.length,
        acceptedCount: accepted,
        failedCount: failed,
        invalidCount: invalid,
        lastError: ultimoErro,
      },
    })
  } catch (err) {
    console.error("[push] counters_failed", { deliveryId, erro: String(err).slice(0, 120) })
  }

  // Log com as classes separadas: é o que permite distinguir, sem abrir o
  // banco, "o canal oscilou" (transient) de "estamos mal configurados"
  // (configuration) — os dois casos que antes se pareciam.
  console.info("[push] result", {
    deliveryId,
    eventType: input.eventType,
    attempted: subscriptions.length,
    accepted,
    failed,
    invalid,
    transient: diagnostico.transient,
    configuration: diagnostico.configuration,
    permanent: diagnostico.permanent,
    retries: diagnostico.retries,
  })

  return {
    alreadyDispatched: false,
    pushEnabled: true,
    attempted: subscriptions.length,
    accepted,
    failed,
    invalid,
  }
}
