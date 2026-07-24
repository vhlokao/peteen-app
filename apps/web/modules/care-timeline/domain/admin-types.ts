/**
 * Módulo: care-timeline
 * Camada: domain — tipos da inspeção administrativa (V0, somente leitura)
 *
 * Estes tipos NUNCA são usados pelo DTO público (CareUpdate em domain/types.ts)
 * — a inspeção admin é uma projeção separada, com deletedAt e trilha de
 * auditoria, exclusiva da tela /admin/requests/[requestId].
 */

import type { CareUpdateCategory } from "./types"

export type AdminCareUpdateStatus = "ACTIVE" | "EDITED" | "DELETED"

/**
 * Um campo humanizado de um evento de auditoria (ex: "Conteúdo anterior" →
 * texto). Evita despejar JSON bruto na tela — cada AuditLog relevante vira
 * uma lista curta de pares label/valor.
 */
export type AdminAuditField = {
  label: string
  value: string
}

export type AdminAuditEntry = {
  id: string
  action: string
  actionLabel: string
  actorEmail: string | null
  createdAt: Date
  fields: AdminAuditField[]
  /** true quando before/after não tinham o formato esperado — fallback sem invenção de dado */
  incomplete: boolean
}

export type AdminCareUpdateRow = {
  id: string
  status: AdminCareUpdateStatus
  category: CareUpdateCategory
  content: string
  authorEmail: string | null
  occurredAt: Date
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
  auditEntries: AdminAuditEntry[]
}

export type AdminCareTimelineInspection = {
  requestId: string
  items: AdminCareUpdateRow[]
}
