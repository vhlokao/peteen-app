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
 * Snapshot para o probe de LISTA (REQUEST AUTO-SYNC RELIABILITY) — só as
 * assinaturas das requests NÃO terminais do ator. Um id que sai da lista
 * (virou terminal) ou entra (nova PENDING) já muda o token; não há razão
 * para buscar tutor/professional/pet aqui.
 */
export async function getTutorRequestListSyncSnapshot(
  tutorId: string
): Promise<RequestListSyncSnapshotInput> {
  const items = await findActiveServiceRequestSignaturesByTutorId(tutorId)
  return { items }
}

export async function getProfessionalRequestListSyncSnapshot(
  professionalId: string
): Promise<RequestListSyncSnapshotInput> {
  const items = await findActiveServiceRequestSignaturesByProfessionalId(professionalId)
  return { items }
}
