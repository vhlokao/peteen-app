/**
 * Módulo: service-request
 * Camada: infrastructure — leitura mínima para o probe de auto-sync (R2B.2
 * hardening).
 *
 * Deliberadamente magra: NÃO reaproveita findServiceRequestWithParticipants
 * (retorna nomes, telefone, endereço — dados que o probe não precisa e não
 * deveria expor a cada 20s). Cada campo aqui existe só porque afeta algo
 * visível na tela de detalhe: status da própria request, disputa
 * relacionada, review relacionada, última atualização do Diário.
 */

import { prisma } from "@/lib/prisma/client"
import { buildCareActivitySignal } from "../domain/active-request-sync"
import type {
  RequestSyncSnapshotInput,
  RequestListSyncSnapshotInput,
} from "../domain/active-request-sync"
import type { RequestStatus } from "../domain/types"
import {
  findActiveServiceRequestSignaturesByTutorId,
  findActiveServiceRequestSignaturesByProfessionalId,
} from "./repository"

export async function getRequestSyncSnapshot(
  requestId: string
): Promise<RequestSyncSnapshotInput | null> {
  const [request, dispute, review, latestCareUpdate, careUpdateCount] = await Promise.all([
    prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { status: true, updatedAt: true },
    }),
    prisma.dispute.findFirst({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, resolvedAt: true },
    }),
    prisma.review.findUnique({
      where: { requestId },
      select: { id: true, updatedAt: true },
    }),
    prisma.careUpdate.findFirst({
      where: { requestId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, editedAt: true },
    }),
    // Só as visíveis: um soft delete precisa MUDAR esta contagem, senão o
    // Diário aberto continuaria exibindo uma entrada já removida.
    prisma.careUpdate.count({ where: { requestId, deletedAt: null } }),
  ])

  if (!request) return null

  return {
    status: request.status as RequestStatus,
    requestUpdatedAt: request.updatedAt,
    dispute,
    review,
    latestCareUpdate,
    careUpdateCount,
  }
}

/**
 * Snapshot do TUTOR para o probe de LISTA (REQUEST AUTO-SYNC RELIABILITY) —
 * assinaturas das requests NÃO terminais + atividade do Diário. Um id que sai
 * da lista (virou terminal) ou entra (nova PENDING) já muda o token; não há
 * razão para buscar tutor/professional/pet aqui.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE O TUTOR LÊ O DIÁRIO E O PROFISSIONAL NÃO
 *
 * O evento que a Home do tutor perdia é "o profissional publicou algo": chega
 * de fora, sem interação dele, e é exatamente o que ele está esperando durante
 * um atendimento. Do lado profissional o mesmo evento é a própria ação que ele
 * acabou de completar — a tela dele já reflete por navegação/revalidação, e
 * observar o Diário ali só produziria refresh de algo que ele mesmo causou.
 *
 * Por isso a extensão fica NESTA função, não na compartilhada. O snapshot do
 * profissional continua idêntico, e o `buildRequestListSyncToken` devolve para
 * ele exatamente o token de antes (ver `careSignal` opcional no domínio).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CUSTO: UMA QUERY A MAIS, AGRUPADA — NUNCA N+1
 *
 * `groupBy` resolve todas as requests ativas do tutor de uma vez. A alternativa
 * ingênua (uma contagem por request, dentro de um laço) seria N+1 num ciclo que
 * roda a cada 10s por aba aberta. Quando não há request ativa, a segunda query
 * nem sai: sem ids, não há o que agrupar.
 *
 * O `select` traz só `_count` e `_max.createdAt`. Nenhuma mídia, nenhum
 * `content`, nenhum autor — o token precisa saber SE mudou, nunca o quê.
 */
export async function getTutorRequestListSyncSnapshot(
  tutorId: string
): Promise<RequestListSyncSnapshotInput> {
  const items = await findActiveServiceRequestSignaturesByTutorId(tutorId)
  if (items.length === 0) return { items }

  const atividade = await prisma.careUpdate.groupBy({
    by: ["requestId"],
    where: {
      requestId: { in: items.map((i) => i.id) },
      // Soft-deletadas fora: um item apagado precisa DERRUBAR a contagem,
      // senão a Home continuaria "atualizada" por uma entrada que já não
      // existe para o tutor.
      deletedAt: null,
    },
    _count: { _all: true },
    _max: { createdAt: true },
  })

  const porRequest = new Map(
    atividade.map((a) => [
      a.requestId,
      buildCareActivitySignal({
        count: a._count._all,
        latestCreatedAt: a._max.createdAt,
      }),
    ])
  )

  return {
    items: items.map((item) => ({
      ...item,
      careSignal: porRequest.get(item.id) ?? null,
    })),
  }
}

export async function getProfessionalRequestListSyncSnapshot(
  professionalId: string
): Promise<RequestListSyncSnapshotInput> {
  const items = await findActiveServiceRequestSignaturesByProfessionalId(professionalId)
  return { items }
}
