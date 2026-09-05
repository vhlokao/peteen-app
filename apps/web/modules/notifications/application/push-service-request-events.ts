import "server-only"

/**
 * Módulo: notifications
 * Camada: application — ponte entre eventos de ServiceRequest e o dispatcher.
 *
 * Eventos conectados (R2B.3 fecha o contrato operacional do atendimento):
 *   request_created  → profissional
 *   request_accepted → tutor
 *   service_started  → tutor
 *   care_update      → tutor (no máximo 1 push por request por hora)
 *   service_completed→ tutor
 *   cancelamento     → a OUTRA parte
 *
 * Disputa e lembretes temporais permanecem deliberadamente fora.
 *
 * POR QUE ESTE ARQUIVO EXISTE, em vez de chamar `dispatchPush` direto nas
 * actions: concentra num só lugar a resolução de destinatário, a construção da
 * chave e a escolha do deep link por persona. A action de domínio passa a
 * conhecer apenas "avise que a request X foi criada" — não conhece payload,
 * rota, nem quem recebe.
 *
 * CONTRATO BEST-EFFORT (herdado da Foundation e reforçado aqui):
 *   Nenhuma função deste arquivo lança. Falha de push jamais pode impedir a
 *   criação de uma solicitação, impedir um aceite, causar rollback, ou tocar
 *   Trust / Relationship / Agenda / Antifraude. A operação de domínio já
 *   concluiu e foi persistida ANTES de qualquer coisa aqui rodar.
 *
 * DESTINATÁRIO SEMPRE SERVER-SIDE: resolvido a partir da PRÓPRIA
 * ServiceRequest via `findRequestWithOwnershipContext`, que devolve
 * `tutorUserId` e `professionalUserId` lidos do banco. Nenhuma dessas funções
 * aceita recipient vindo do client — o parâmetro é só o `requestId`.
 */

import { findRequestWithOwnershipContext } from "@/modules/service-request/infrastructure/repository"
import {
  buildEventKey,
  buildPushPayload,
  careUpdatePushBucket,
} from "../domain/push-events"
import {
  professionalNotificationHref,
  tutorNotificationHref,
} from "../infrastructure/links"
import { dispatchPush } from "./dispatch-push"

/**
 * Nova solicitação → avisa o PROFISSIONAL.
 *
 * eventKey: `service-request-created:<requestId>`
 *   Determinístico e único por criação. `requestId` é gerado uma vez pelo
 *   banco, então um double-submit que criasse duas requests produziria duas
 *   chaves distintas (correto — são duas solicitações), enquanto um retry do
 *   mesmo fluxo sobre a MESMA request colide na chave e é descartado pelo
 *   unique de PushDelivery. Não há segundo sistema de dedup.
 *
 * Deep link: `professionalNotificationHref.request()` — a rota do profissional
 * é `/requests/[id]`, DIFERENTE da do tutor (`/tutor/requests/[requestId]`).
 * Montar a URL à mão aqui mandaria o profissional para a árvore de rota errada;
 * por isso o helper de links.ts é a única fonte.
 */
export async function notifyRequestCreated(requestId: string): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    await dispatchPush({
      eventKey: buildEventKey("service-request-created", requestId),
      eventType: "request_created",
      entityId: requestId,
      // Destinatário lido do banco, nunca do client.
      recipientUserId: ctx.professionalUserId,
      payload: buildPushPayload(
        "request_created",
        professionalNotificationHref.request(requestId),
        requestId
      ),
    })
  } catch (err) {
    // Engolido por contrato: a solicitação já foi criada e é o que importa.
    // Log sem PII — só id técnico e erro truncado.
    console.error("[push] notify_request_created_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}

/**
 * Solicitação aceita → avisa o TUTOR.
 *
 * eventKey: `service-request-accepted:<requestId>`
 *   Único por aceite. A máquina de estados garante que PENDING→ACCEPTED
 *   acontece no máximo uma vez: `VALID_TRANSITIONS` não tem nenhuma aresta que
 *   retorne a ACCEPTED, e PENDING não é alcançável a partir de nenhum estado.
 *   Logo a chave nunca colide legitimamente consigo mesma.
 *
 * Só é chamada DEPOIS de `transitionStatus` ter persistido ACCEPTED. Como essa
 * transição é atômica e guardada (o update só escreve se o status ainda for
 * PENDING), um aceite concorrente que perca a corrida lança
 * ConcurrentStatusChangeError antes de chegar aqui — e não gera push. Só o
 * aceite vencedor notifica.
 */
export async function notifyRequestAccepted(requestId: string): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    await dispatchPush({
      eventKey: buildEventKey("service-request-accepted", requestId),
      eventType: "request_accepted",
      entityId: requestId,
      recipientUserId: ctx.tutorUserId,
      payload: buildPushPayload(
        "request_accepted",
        tutorNotificationHref.request(requestId),
        requestId
      ),
    })
  } catch (err) {
    console.error("[push] notify_request_accepted_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}

/**
 * Atendimento iniciado → avisa o TUTOR.
 *
 * eventKey: `service-started:<requestId>`
 *   Único por request. `VALID_TRANSITIONS` só chega a IN_PROGRESS a partir de
 *   ACCEPTED e nunca retorna — logo a chave nunca colide legitimamente
 *   consigo mesma. Um retry da action sobre a mesma request cai no P2002 do
 *   unique de PushDelivery e é descartado sem segundo envio.
 */
export async function notifyServiceStarted(requestId: string): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    await dispatchPush({
      eventKey: buildEventKey("service-started", requestId),
      eventType: "service_started",
      entityId: requestId,
      recipientUserId: ctx.tutorUserId,
      payload: buildPushPayload(
        "service_started",
        tutorNotificationHref.request(requestId),
        requestId
      ),
    })
  } catch (err) {
    console.error("[push] notify_service_started_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}

/**
 * Nova atualização do Diário → avisa o TUTOR, no máximo 1× por hora.
 *
 * eventKey: `care-update:<requestId>:<bucket>`
 *   A janela vive DENTRO da chave — ver careUpdatePushBucket. O primeiro
 *   update de uma janela cria a linha; os seguintes colidem no unique e o
 *   dispatcher retorna `alreadyDispatched` sem enviar nada. Nenhuma tabela
 *   de rate limit nova, nenhum cron, nenhum estado no browser.
 *
 * NÃO recebe o careUpdateId de propósito: a chave é por REQUEST + JANELA, não
 * por atualização. Cinco updates na mesma hora compartilham a mesma chave —
 * que é exatamente o comportamento desejado.
 *
 * `now` é injetável só para teste; em produção sempre o relógio do servidor.
 */
export async function notifyCareUpdatePublished(
  requestId: string,
  now: Date = new Date()
): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    await dispatchPush({
      eventKey: buildEventKey("care-update", requestId, String(careUpdatePushBucket(now))),
      eventType: "care_update",
      entityId: requestId,
      recipientUserId: ctx.tutorUserId,
      // Deep link direto no Diário — a Request só mostra o resumo (R0).
      payload: buildPushPayload(
        "care_update",
        tutorNotificationHref.diary(requestId),
        requestId
      ),
    })
  } catch (err) {
    console.error("[push] notify_care_update_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}

/**
 * Atendimento concluído → avisa o TUTOR.
 *
 * eventKey: `service-completed:<requestId>`. COMPLETED é terminal: nenhuma
 * transição sai dele, então a chave é única por request.
 *
 * A copy convida a avaliar, mas NÃO decide se há avaliação pendente — essa
 * regra é da Request (R2B.1), que já mostra "Avaliar atendimento" quando
 * cabe. Duplicar aqui criaria duas fontes de verdade para a mesma pergunta.
 */
export async function notifyServiceCompleted(requestId: string): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    await dispatchPush({
      eventKey: buildEventKey("service-completed", requestId),
      eventType: "service_completed",
      entityId: requestId,
      recipientUserId: ctx.tutorUserId,
      payload: buildPushPayload(
        "service_completed",
        tutorNotificationHref.request(requestId),
        requestId
      ),
    })
  } catch (err) {
    console.error("[push] notify_service_completed_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}

/**
 * Cancelamento → avisa a OUTRA parte.
 *
 * Quem cancelou determina TRÊS coisas ao mesmo tempo, e por isso é o único
 * parâmetro além do id: o destinatário (sempre quem NÃO cancelou), a rota
 * (cada persona tem a sua árvore) e a copy (kind próprio, sem interpolação).
 *
 * `cancelledBy` vem do status de destino calculado pela action — fato do
 * servidor, nunca do client.
 *
 * eventKey: `request-cancelled:<requestId>:<ator>`. O ator entra na chave
 * porque os dois cancelamentos são eventos logicamente distintos; a state
 * machine impede que ambos ocorram na mesma request, mas a chave não depende
 * dessa garantia para estar correta.
 */
export async function notifyRequestCancelled(
  requestId: string,
  cancelledBy: "tutor" | "professional"
): Promise<void> {
  try {
    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) return

    const paraProfissional = cancelledBy === "tutor"

    await dispatchPush({
      eventKey: buildEventKey("request-cancelled", requestId, cancelledBy),
      eventType: "request_cancelled",
      entityId: requestId,
      recipientUserId: paraProfissional ? ctx.professionalUserId : ctx.tutorUserId,
      payload: paraProfissional
        ? buildPushPayload(
            "request_cancelled_by_tutor",
            professionalNotificationHref.request(requestId),
            requestId
          )
        : buildPushPayload(
            "request_cancelled_by_professional",
            tutorNotificationHref.request(requestId),
            requestId
          ),
    })
  } catch (err) {
    console.error("[push] notify_request_cancelled_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}
