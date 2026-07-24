/**
 * Módulo: care-timeline
 * Camada: infrastructure — I/O com o banco via Prisma
 *
 * Regras de integridade:
 *   - getCareTimeline retorna apenas não-deletados (visão tutor/profissional)
 *   - getCareTimelineAdmin inclui deletados (visão admin em disputa/suporte)
 *   - Soft delete: nunca removemos linha — apenas marcamos deletedAt
 *   - Auditoria é fire-and-forget e nunca quebra o fluxo principal
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import {
  CARE_UPDATE_EDIT_WINDOW_MS,
  type CareUpdate,
  type CareUpdateCategory,
} from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

type CareUpdateRow = {
  id: string
  requestId: string
  petId: string | null
  professionalId: string
  authorId: string
  category: string
  content: string
  occurredAt: Date
  createdAt: Date
  editedAt: Date | null
}

/** Linha do banco → projeção pública (sem deletedAt). */
function toPublic(row: CareUpdateRow): CareUpdate {
  return {
    id: row.id,
    requestId: row.requestId,
    petId: row.petId,
    professionalId: row.professionalId,
    authorId: row.authorId,
    category: row.category as CareUpdateCategory,
    content: row.content,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
  }
}

const PUBLIC_SELECT = {
  id: true,
  requestId: true,
  petId: true,
  professionalId: true,
  authorId: true,
  category: true,
  content: true,
  occurredAt: true,
  createdAt: true,
  editedAt: true,
} satisfies Prisma.CareUpdateSelect

/**
 * Guard atômico do estado "editável/excluível" da request-mãe (Fase 3.1).
 * Vai no WHERE da própria mutação — se a request sair de IN_PROGRESS ou uma
 * disputa abrir entre a validação inicial da action e a escrita, o updateMany
 * não casa nenhuma linha (count 0) e a mutação é abortada sem efeito.
 */
const REQUEST_MUTABLE_GUARD = {
  status: "IN_PROGRESS",
  disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
} satisfies Prisma.ServiceRequestWhereInput

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordenação determinística e estável — dois registros podem ter o mesmo
 * occurredAt, então desempata por createdAt e, por fim, id. Aplicada a
 * tutor, profissional e admin.
 */
const CARE_TIMELINE_ORDER = [
  { occurredAt: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.CareUpdateOrderByWithRelationInput[]

/**
 * Timeline de uma request — só atualizações vivas (deletedAt IS NULL), ordem
 * cronológica estável do cuidado. Visão tutor/profissional.
 */
export async function getCareTimeline(requestId: string): Promise<CareUpdate[]> {
  const rows = await prisma.careUpdate.findMany({
    where: { requestId, deletedAt: null },
    orderBy: CARE_TIMELINE_ORDER,
    select: PUBLIC_SELECT,
  })
  return rows.map(toPublic)
}

/**
 * Timeline completa para o Admin — inclui atualizações removidas (soft delete),
 * para adjudicação de disputa. `deletedAt` acompanha cada item.
 */
export async function getCareTimelineAdmin(
  requestId: string
): Promise<(CareUpdate & { deletedAt: Date | null })[]> {
  const rows = await prisma.careUpdate.findMany({
    where: { requestId },
    orderBy: CARE_TIMELINE_ORDER,
    select: { ...PUBLIC_SELECT, deletedAt: true },
  })
  return rows.map((row) => ({ ...toPublic(row), deletedAt: row.deletedAt }))
}

/**
 * Busca uma atualização por id — usado nos guards de edição/exclusão e para
 * montar o snapshot de auditoria (conteúdo/categoria/occurredAt antes da
 * mutação). Retorna os campos necessários para autorização, janela de tempo
 * e preservação de evidência.
 */
export async function findCareUpdateById(id: string): Promise<{
  id: string
  requestId: string
  authorId: string
  createdAt: Date
  deletedAt: Date | null
  content: string
  category: CareUpdateCategory
  occurredAt: Date
} | null> {
  const row = await prisma.careUpdate.findUnique({
    where: { id },
    select: {
      id: true,
      requestId: true,
      authorId: true,
      createdAt: true,
      deletedAt: true,
      content: true,
      category: true,
      occurredAt: true,
    },
  })
  if (!row) return null
  return { ...row, category: row.category as CareUpdateCategory }
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Criação atômica (padrão Fase 3.1 adaptado à inserção de linha-filha).
 *
 * Numa transação interativa:
 *   1. `SELECT ... FOR UPDATE` trava a linha da request-mãe — qualquer
 *      transição de status concorrente (accept/complete/cancel também
 *      atualizam essa linha) bloqueia até este commit, serializando a corrida.
 *   2. Re-verifica, JÁ sob o lock: status IN_PROGRESS, occurredAt >= startedAt,
 *      e ausência de disputa OPEN/UNDER_REVIEW.
 *   3. Só então insere — com petId e professionalId DERIVADOS da request
 *      travada (nunca do client).
 *
 * Retorna null se qualquer condição falhar no instante da escrita (estado
 * mudou entre a validação da action e aqui) — nenhuma linha é criada.
 */
export async function createCareUpdateAtomic(data: {
  requestId: string
  authorId: string
  category: CareUpdateCategory
  content: string
  occurredAt: Date
}): Promise<CareUpdate | null> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        status: string
        professionalId: string
        petId: string | null
        startedAt: Date | null
      }>
    >`SELECT "status", "professionalId", "petId", "startedAt"
      FROM "service_requests" WHERE "id" = ${data.requestId} FOR UPDATE`

    const req = locked[0]
    if (!req) return null
    if (req.status !== "IN_PROGRESS") return null
    if (req.startedAt && data.occurredAt.getTime() < req.startedAt.getTime()) return null

    const activeDisputes = await tx.dispute.count({
      where: { requestId: data.requestId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    })
    if (activeDisputes > 0) return null

    const row = await tx.careUpdate.create({
      data: {
        requestId: data.requestId,
        petId: req.petId, // derivado da request travada
        professionalId: req.professionalId, // derivado da request travada
        authorId: data.authorId,
        category: data.category,
        content: data.content,
        occurredAt: data.occurredAt,
      },
      select: PUBLIC_SELECT,
    })
    return toPublic(row)
  })
}

/**
 * Edita o conteúdo de uma atualização, mas SÓ se — no instante da escrita —
 * a request ainda estiver IN_PROGRESS, sem disputa aberta, E a janela de
 * edição (15 min desde createdAt) ainda estiver aberta. Tudo no WHERE do
 * próprio update (guard atômico): a pré-validação da action dá mensagens
 * específicas, mas quem decide é o banco.
 * Retorna null quando o guard não casa (estado mudou entre a validação e aqui).
 */
export async function editCareUpdate(
  id: string,
  content: string,
  editedAt: Date
): Promise<CareUpdate | null> {
  // Janela: só edita se createdAt >= agora - 15min (cutoff do servidor).
  const editWindowCutoff = new Date(Date.now() - CARE_UPDATE_EDIT_WINDOW_MS)

  const { count } = await prisma.careUpdate.updateMany({
    where: {
      id,
      deletedAt: null,
      createdAt: { gte: editWindowCutoff },
      request: REQUEST_MUTABLE_GUARD,
    },
    data: { content, editedAt },
  })
  if (count === 0) return null

  const row = await prisma.careUpdate.findUnique({ where: { id }, select: PUBLIC_SELECT })
  return row ? toPublic(row) : null
}

/**
 * Soft delete com o mesmo guard atômico. Retorna false quando o estado da
 * request mudou entre a validação e a escrita (nenhuma linha afetada).
 */
export async function softDeleteCareUpdate(id: string, deletedAt: Date): Promise<boolean> {
  const { count } = await prisma.careUpdate.updateMany({
    where: { id, deletedAt: null, request: REQUEST_MUTABLE_GUARD },
    data: { deletedAt },
  })
  return count > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORIA — mesmo padrão de disputes/service-request (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordCareUpdateAudit(
  userId: string,
  action: string,
  careUpdateId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "CareUpdate",
        entityId: careUpdateId,
        before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: after as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
