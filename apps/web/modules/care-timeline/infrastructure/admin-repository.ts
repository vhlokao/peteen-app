/**
 * Módulo: care-timeline
 * Camada: infrastructure — leitura administrativa (somente leitura, V0)
 *
 * Regras:
 *   - Reutiliza getCareTimeline* nada aqui — usa getCareTimelineAdmin (inclui
 *     deletedAt) já existente em repository.ts, não duplica a query.
 *   - Busca AuditLogs relacionados em UMA query (entityId IN [...]), sem N+1.
 *   - Resolve e-mails de autor em UMA query batched (id IN [...]).
 *   - Nunca escreve. Nenhuma mutation neste arquivo.
 */

import { prisma } from "@/lib/prisma/client"
import { CARE_CATEGORY_LABELS, type CareUpdateCategory } from "../domain/types"
import type {
  AdminAuditEntry,
  AdminAuditField,
  AdminCareTimelineInspection,
  AdminCareUpdateRow,
  AdminCareUpdateStatus,
} from "../domain/admin-types"
import { getCareTimelineAdmin } from "./repository"

const ACTION_LABELS: Record<string, string> = {
  "care_update.published": "Atualização publicada",
  "care_update.edited": "Atualização editada",
  "care_update.deleted": "Atualização excluída",
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function readString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" ? value : undefined
}

function categoryLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  return CARE_CATEGORY_LABELS[value as CareUpdateCategory] ?? value
}

function formatIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleString("pt-BR")
}

/**
 * Extrai campos humanos de um AuditLog de CareUpdate. Nunca inventa dado: se
 * o campo esperado não existir no before/after (ex: AuditLog legado ou
 * corrompido), o campo simplesmente não aparece e `incomplete` fica true.
 */
function humanizeAuditLog(log: {
  id: string
  action: string
  before: unknown
  after: unknown
  createdAt: Date
  actorEmail: string | null
}): AdminAuditEntry {
  const before = log.before as Record<string, unknown> | null
  const after = log.after as Record<string, unknown> | null
  const fields: AdminAuditField[] = []
  let sawAnyExpectedField = false

  if (log.action === "care_update.published") {
    const cat = categoryLabel(readString(after, "category"))
    const occurredAt = formatIsoDate(readString(after, "occurredAt"))
    if (cat) {
      fields.push({ label: "Categoria", value: cat })
      sawAnyExpectedField = true
    }
    if (occurredAt) {
      fields.push({ label: "Publicado com data de", value: occurredAt })
      sawAnyExpectedField = true
    }
  } else if (log.action === "care_update.edited") {
    const prevContent = readString(before, "content")
    const newContent = readString(after, "content")
    const editedAt = formatIsoDate(readString(after, "editedAt"))
    if (prevContent !== undefined) {
      fields.push({ label: "Conteúdo anterior", value: prevContent })
      sawAnyExpectedField = true
    }
    if (newContent !== undefined) {
      fields.push({ label: "Conteúdo novo", value: newContent })
      sawAnyExpectedField = true
    }
    if (editedAt) {
      fields.push({ label: "Editado em", value: editedAt })
      sawAnyExpectedField = true
    }
  } else if (log.action === "care_update.deleted") {
    const content = readString(before, "content") ?? readString(after, "content")
    const cat = categoryLabel(readString(before, "category") ?? readString(after, "category"))
    const occurredAt = formatIsoDate(readString(before, "occurredAt") ?? readString(after, "occurredAt"))
    const deletedAt = formatIsoDate(readString(after, "deletedAt"))
    if (content !== undefined) {
      fields.push({ label: "Conteúdo no momento da exclusão", value: content })
      sawAnyExpectedField = true
    }
    if (cat) {
      fields.push({ label: "Categoria", value: cat })
      sawAnyExpectedField = true
    }
    if (occurredAt) {
      fields.push({ label: "Data do cuidado registrado", value: occurredAt })
      sawAnyExpectedField = true
    }
    if (deletedAt) {
      fields.push({ label: "Excluído em", value: deletedAt })
      sawAnyExpectedField = true
    }
  }

  return {
    id: log.id,
    action: log.action,
    actionLabel: formatActionLabel(log.action),
    actorEmail: log.actorEmail,
    createdAt: log.createdAt,
    fields,
    incomplete: !sawAnyExpectedField,
  }
}

function deriveStatus(deletedAt: Date | null, editedAt: Date | null): AdminCareUpdateStatus {
  if (deletedAt) return "DELETED"
  if (editedAt) return "EDITED"
  return "ACTIVE"
}

/**
 * Timeline administrativa completa de uma request — ativos, editados e
 * excluídos, cada um com sua trilha de auditoria humanizada.
 */
export async function getAdminCareTimelineInspection(
  requestId: string
): Promise<AdminCareTimelineInspection> {
  const items = await getCareTimelineAdmin(requestId)

  if (items.length === 0) {
    return { requestId, items: [] }
  }

  const careUpdateIds = items.map((i) => i.id)
  const authorIds = [...new Set(items.map((i) => i.authorId))]

  const [logs, authors] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entity: "CareUpdate", entityId: { in: careUpdateIds } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, email: true },
    }),
  ])

  const authorEmailById = new Map(authors.map((a) => [a.id, a.email]))
  const logsByCareUpdateId = new Map<string, typeof logs>()
  for (const log of logs) {
    const list = logsByCareUpdateId.get(log.entityId) ?? []
    list.push(log)
    logsByCareUpdateId.set(log.entityId, list)
  }

  const rows: AdminCareUpdateRow[] = items.map((item) => {
    const relatedLogs = logsByCareUpdateId.get(item.id) ?? []
    return {
      id: item.id,
      status: deriveStatus(item.deletedAt, item.editedAt),
      category: item.category,
      content: item.content,
      authorEmail: authorEmailById.get(item.authorId) ?? null,
      occurredAt: item.occurredAt,
      createdAt: item.createdAt,
      editedAt: item.editedAt,
      deletedAt: item.deletedAt,
      auditEntries: relatedLogs.map((log) =>
        humanizeAuditLog({
          id: log.id,
          action: log.action,
          before: log.before,
          after: log.after,
          createdAt: log.createdAt,
          actorEmail: log.user?.email ?? null,
        })
      ),
    }
  })

  return { requestId, items: rows }
}
