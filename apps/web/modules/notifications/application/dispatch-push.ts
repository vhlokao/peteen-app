import "server-only"

/**
 * Módulo: notifications
 * Camada: application — dispatcher genérico de Web Push.
 *
 * FOUNDATION V0.2: o dispatcher está completo, mas NENHUM evento de negócio
 * está conectado a ele. Nova solicitação, aceite, cancelamento, conclusão, Care
 * Timeline, disputa e eventos temporais permanecem fora, por decisão de escopo.
 * A única entrada hoje é o smoke de verificação do canal.
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
import { sendPush } from "../infrastructure/push-sender"
import { avaliarElegibilidade } from "../domain/vapid-fingerprint"
import { getCurrentPushIdentity } from "../infrastructure/runtime-environment"

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
  // Um aparelho morto nunca pode impedir os demais de receber.
  const resultados = await Promise.allSettled(
    subscriptions.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, input.payload))
  )

  let accepted = 0
  let failed = 0
  let invalid = 0
  const mortas: string[] = []
  /** Sem identidade completa que o push service ACEITOU — ver abaixo. */
  const identidadesProvadas: string[] = []
  // Array em vez de `let ultimoErro`: o TypeScript não acompanha atribuições
  // feitas dentro de callback, então uma variável mutável aqui seria estreitada
  // para `never` no ponto de uso lá embaixo. Laço direto também evita o
  // problema e deixa o índice explícito.
  const erros: string[] = []

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
      erros.push(`sender_threw: ${motivo}`.slice(0, 120))
      continue
    }
    const res = r.value
    if (res.outcome === "accepted") {
      accepted++
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
    } else if (res.outcome === "invalid") {
      invalid++
      if (res.shortError) erros.push(res.shortError)
      mortas.push(subscriptions[i]!.id)
    } else {
      failed++
      if (res.shortError) erros.push(res.shortError)
    }
  }

  const ultimoErro = erros.length > 0 ? erros[erros.length - 1]! : null

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
  try {
    await prisma.pushDelivery.update({
      where: { id: deliveryId },
      data: {
        attemptedCount: subscriptions.length,
        acceptedCount: accepted,
        failedCount: failed,
        invalidCount: invalid,
        lastError: ultimoErro ? ultimoErro.slice(0, 120) : null,
      },
    })
  } catch (err) {
    console.error("[push] counters_failed", { deliveryId, erro: String(err).slice(0, 120) })
  }

  console.info("[push] result", {
    deliveryId,
    eventType: input.eventType,
    attempted: subscriptions.length,
    accepted,
    failed,
    invalid,
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
