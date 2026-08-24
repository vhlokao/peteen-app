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
  CARE_UPDATE_MAX_MEDIA,
  type CareUpdateCategory,
  type CareUpdateWithInternalMedia,
  type CareMediaInternal,
  type ValidatedCareMedia,
} from "../domain/types"
import { sortCareUpdatesNewestFirst } from "../domain/timeline-order"
import {
  uniqueViolationTarget,
  matchesUniqueConstraint,
} from "../domain/prisma-unique-violation"

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────────────────────────────────────────

type CareMediaRow = {
  id: string
  // Era `string`, e foi essa frouxidão que obrigou o `as "PHOTO"` mais abaixo
  // — um cast que virou mentira quando VIDEO entrou no enum. O union real
  // dispensa o cast e faz o compilador cobrar qualquer tipo novo.
  type: "PHOTO" | "VIDEO"
  storagePath: string
  mimeType: string
  displayWidth: number | null
  displayHeight: number | null
}

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
  media?: CareMediaRow[]
}

/**
 * Ordem estável da mídia dentro de uma atualização. Sem isto, a grade de fotos
 * poderia trocar de posição entre dois carregamentos da mesma tela.
 */
const CARE_MEDIA_ORDER = [
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.CareMediaOrderByWithRelationInput[]

const MEDIA_SELECT = {
  id: true,
  type: true,
  storagePath: true,
  mimeType: true,
  // Dimensões de exibição viajam junto com a mídia para que o card fechado
  // conheça a orientação sem tocar no arquivo.
  displayWidth: true,
  displayHeight: true,
} satisfies Prisma.CareMediaSelect

function toInternalMedia(rows: CareMediaRow[] | undefined): CareMediaInternal[] {
  return (rows ?? []).map((m) => ({
    id: m.id,
    // O cast para "PHOTO" era resquício de quando o enum só tinha esse valor:
    // afirmava ao compilador algo que deixou de ser verdade quando VIDEO
    // entrou. `m.type` já é o union correto — deixar o cast mascararia
    // justamente o tipo que decide bucket e player.
    type: m.type,
    storagePath: m.storagePath,
    mimeType: m.mimeType,
    displayWidth: m.displayWidth,
    displayHeight: m.displayHeight,
  }))
}

/**
 * Linha do banco → projeção interna (sem deletedAt, COM storagePath).
 * `storagePath` só existe até a camada de aplicação trocá-lo por URL assinada.
 */
function toPublic(row: CareUpdateRow): CareUpdateWithInternalMedia {
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
    media: toInternalMedia(row.media),
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
  media: { select: MEDIA_SELECT, orderBy: CARE_MEDIA_ORDER },
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

/** Ordem cronológica ascendente — só para getCareTimelineAdmin, ver ali. */
const ADMIN_CARE_TIMELINE_ORDER = [
  { occurredAt: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.CareUpdateOrderByWithRelationInput[]

/**
 * Timeline de uma request — só atualizações vivas (deletedAt IS NULL), mais
 * RECENTE primeiro (por `occurredAt`; ver domain/timeline-order.ts para a
 * regra e o porquê da ordem ser aplicada em memória, não via `orderBy` do
 * Prisma). Visão tutor/profissional.
 */
export async function getCareTimeline(
  requestId: string
): Promise<CareUpdateWithInternalMedia[]> {
  const rows = await prisma.careUpdate.findMany({
    where: { requestId, deletedAt: null },
    select: PUBLIC_SELECT,
  })
  return sortCareUpdatesNewestFirst(rows.map(toPublic))
}

/**
 * Timeline completa para o Admin — inclui atualizações removidas (soft delete),
 * para adjudicação de disputa. `deletedAt` acompanha cada item.
 */
export async function getCareTimelineAdmin(
  requestId: string
): Promise<(CareUpdateWithInternalMedia & { deletedAt: Date | null })[]> {
  const rows = await prisma.careUpdate.findMany({
    where: { requestId },
    // Fora de escopo desta missão (leitura tutor/profissional): a visão de
    // admin permanece cronológica ASCENDENTE, como sempre foi — reconstrução
    // de evidência lê-se do início para o fim. Ordem própria, não reaproveita
    // sortCareUpdatesNewestFirst de propósito.
    orderBy: ADMIN_CARE_TIMELINE_ORDER,
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

/**
 * Carrega UMA mídia com TODO o contexto necessário para autorizar sua leitura,
 * numa única query.
 *
 * Os cinco elos que a autorização precisa provar saem daqui juntos — mídia,
 * atualização-mãe, visibilidade dela, request de origem e os dois donos.
 * Buscar em consultas separadas abriria espaço para alguém verificar quatro
 * elos e esquecer o quinto; aqui ou vêm todos, ou não vem nada.
 */
export async function findCareMediaWithContext(careMediaId: string): Promise<{
  id: string
  storagePath: string
  mimeType: string
  type: string
  careUpdateId: string
  careUpdateDeletedAt: Date | null
  requestId: string
  tutorUserId: string
  professionalUserId: string
} | null> {
  const row = await prisma.careMedia.findUnique({
    where: { id: careMediaId },
    select: {
      id: true,
      storagePath: true,
      mimeType: true,
      type: true,
      careUpdate: {
        select: {
          id: true,
          requestId: true,
          deletedAt: true,
          request: {
            select: {
              tutor: { select: { userId: true } },
              professional: { select: { userId: true } },
            },
          },
        },
      },
    },
  })

  if (!row) return null

  return {
    id: row.id,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    type: row.type,
    careUpdateId: row.careUpdate.id,
    careUpdateDeletedAt: row.careUpdate.deletedAt,
    requestId: row.careUpdate.requestId,
    tutorUserId: row.careUpdate.request.tutor.userId,
    professionalUserId: row.careUpdate.request.professional.userId,
  }
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
export type CreateCareUpdateOutcome =
  /** Criada agora. */
  | { kind: "created"; update: CareUpdateWithInternalMedia }
  /** Já existia com esta idempotencyKey — nenhuma linha nova foi criada. */
  | { kind: "replayed"; update: CareUpdateWithInternalMedia }
  /** Estado mudou entre a validação da action e a escrita. Nada foi criado. */
  | { kind: "state_changed" }
  /** Algum path já pertence a outra atualização. Nada foi criado. */
  | { kind: "media_conflict" }

/**
 * Publicação ATÔMICA de atualização + mídia.
 *
 * Storage I/O acontece INTEIRAMENTE ANTES desta função. A transação recebe
 * apenas mídia já baixada, validada por magic bytes e medida — nenhuma chamada
 * de rede acontece com o lock da request na mão. Uma ida ao Supabase dentro da
 * transação seguraria o lock pelo tempo de uma requisição HTTP, transformando
 * lentidão de rede em contenção de banco para todo mundo naquele atendimento.
 *
 * Dentro do lock (`SELECT ... FOR UPDATE` na request-mãe):
 *   1. re-verifica status IN_PROGRESS, occurredAt >= startedAt e ausência de
 *      disputa — o estado pode ter mudado desde a validação da action;
 *   2. aplica a COTA de 3 (o array é a única fonte de contagem, então a cota é
 *      atômica por construção: não há como duas chamadas somarem 6);
 *   3. cria CareUpdate e as CareMedia na MESMA transação.
 *
 * IDEMPOTÊNCIA: o unique (requestId, idempotencyKey) é o árbitro. Se a mesma
 * intenção chegar duas vezes — duplo clique, retry, duas abas, resposta perdida
 * após o commit —, a segunda tentativa viola o unique, a transação inteira é
 * revertida e devolvemos a atualização que já existe, marcada como `replayed`.
 * Nenhuma segunda linha é criada. É o banco decidindo, não a UI.
 */
export async function createCareUpdateAtomic(data: {
  requestId: string
  authorId: string
  category: CareUpdateCategory
  content: string
  occurredAt: Date
  idempotencyKey: string
  media: ValidatedCareMedia[]
}): Promise<CreateCareUpdateOutcome> {
  try {
    const update = await prisma.$transaction(async (tx) => {
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

      // Cota, sob o lock. Redundante com a validação da action de propósito:
      // esta é a que o banco enxerga no instante da escrita.
      if (data.media.length > CARE_UPDATE_MAX_MEDIA) return null

      const row = await tx.careUpdate.create({
        data: {
          requestId: data.requestId,
          petId: req.petId, // derivado da request travada
          professionalId: req.professionalId, // derivado da request travada
          authorId: data.authorId,
          category: data.category,
          content: data.content,
          occurredAt: data.occurredAt,
          idempotencyKey: data.idempotencyKey,
          media: data.media.length
            ? {
                create: data.media.map((m) => ({
                  // Vem do veredito dos MAGIC BYTES (ValidatedCareMedia.type),
                  // não mais fixo em PHOTO. Era literal enquanto vídeo não
                  // existia; mantê-lo assim gravaria todo vídeo como foto e
                  // faria a leitura procurá-lo no bucket errado.
                  type: m.type,
                  storagePath: m.storagePath,
                  mimeType: m.mimeType,
                  sizeBytes: m.sizeBytes,
                  // Já normalizados no domínio: null quando ausentes ou
                  // implausíveis. Nunca bloqueiam a publicação.
                  displayWidth: m.displayWidth,
                  displayHeight: m.displayHeight,
                })),
              }
            : undefined,
        },
        select: PUBLIC_SELECT,
      })
      return toPublic(row)
    })

    if (!update) return { kind: "state_changed" }
    return { kind: "created", update }
  } catch (err) {
    const alvo = uniqueViolationTarget(err)
    if (!alvo) throw err

    // Mesma intenção já publicada: devolve a original, sem criar nada.
    if (matchesUniqueConstraint(alvo, "idempotencyKey")) {
      const existente = await prisma.careUpdate.findFirst({
        where: { requestId: data.requestId, idempotencyKey: data.idempotencyKey },
        select: PUBLIC_SELECT,
      })
      if (existente) return { kind: "replayed", update: toPublic(existente) }
      // Unique disparou mas a linha sumiu (soft delete não remove; cenário
      // improvável). Trata como mudança de estado em vez de inventar sucesso.
      return { kind: "state_changed" }
    }

    // Um dos paths já está anexado a outra atualização.
    if (matchesUniqueConstraint(alvo, "storagePath")) return { kind: "media_conflict" }

    throw err
  }
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
): Promise<CareUpdateWithInternalMedia | null> {
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
