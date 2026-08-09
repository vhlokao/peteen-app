import "server-only"

/**
 * Módulo: notifications
 * Camada: application — ponte entre eventos de ServiceRequest e o dispatcher.
 *
 * Integração P0: os DOIS únicos eventos de negócio conectados ao push.
 * Cancelamento, conclusão, Care Timeline, disputa e lembretes temporais
 * permanecem deliberadamente fora.
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
import { buildEventKey, buildPushPayload } from "../domain/push-events"
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
        professionalNotificationHref.request(requestId)
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
        tutorNotificationHref.request(requestId)
      ),
    })
  } catch (err) {
    console.error("[push] notify_request_accepted_failed", {
      requestId,
      erro: String(err).slice(0, 120),
    })
  }
}
