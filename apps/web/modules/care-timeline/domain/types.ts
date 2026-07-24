/**
 * Módulo: care-timeline
 * Camada: domain — tipos puros da Care Timeline V0
 *
 * V0: apenas texto. O profissional publica dentro de uma request IN_PROGRESS;
 * o tutor visualiza. Estes tipos não dependem de Prisma — o repositório mapeia
 * as linhas do banco para eles.
 */

import { z } from "zod"

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS — espelham o enum CareUpdateCategory do schema Prisma
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_UPDATE_CATEGORIES = [
  "CHECK_IN",
  "FEEDING",
  "WALK",
  "ACTIVITY",
  "REST",
  "NOTE",
  "CHECK_OUT",
] as const

export type CareUpdateCategory = (typeof CARE_UPDATE_CATEGORIES)[number]

export const CARE_CATEGORY_LABELS: Record<CareUpdateCategory, string> = {
  CHECK_IN: "Chegada",
  FEEDING: "Alimentação",
  WALK: "Passeio",
  ACTIVITY: "Atividade",
  REST: "Descanso",
  NOTE: "Observação",
  CHECK_OUT: "Saída",
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CareUpdate — projeção pública, exibida ao tutor e ao profissional.
 * NUNCA inclui deletedAt: itens soft-deleted são filtrados antes de virar
 * este tipo (só o Admin, via getCareTimelineAdmin, enxerga os removidos).
 */
export type CareUpdate = {
  id: string
  requestId: string
  petId: string | null
  professionalId: string
  authorId: string
  category: CareUpdateCategory
  content: string
  occurredAt: Date
  createdAt: Date
  editedAt: Date | null
}

/**
 * Janela de edição de uma atualização após publicada (decisão de produto V0).
 */
export const CARE_UPDATE_EDIT_WINDOW_MS = 15 * 60 * 1000

/**
 * Limite de tamanho do conteúdo (validado na Server Action).
 */
export const CARE_UPDATE_CONTENT_MIN = 10
export const CARE_UPDATE_CONTENT_MAX = 1000

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DE CRIAÇÃO
//
// occurredAt chega do client como string ISO (UTC) — z.coerce.date() converte.
// Validações dependentes de estado (não antes de startedAt, não no futuro)
// ficam na Server Action, que tem acesso à request.
// ─────────────────────────────────────────────────────────────────────────────

export const CreateCareUpdateSchema = z.object({
  requestId: z.string().min(1, "Solicitação é obrigatória"),
  category: z.enum(CARE_UPDATE_CATEGORIES, {
    error: () => "Selecione uma categoria válida",
  }),
  content: z
    .string()
    .trim()
    .min(CARE_UPDATE_CONTENT_MIN, `A atualização precisa de pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres`)
    .max(CARE_UPDATE_CONTENT_MAX, `A atualização pode ter no máximo ${CARE_UPDATE_CONTENT_MAX} caracteres`),
  occurredAt: z.coerce.date({ error: () => "Data/hora inválida" }),
})

/** Entrada crua vinda do client (occurredAt como ISO string). */
export type CreateCareUpdateInput = {
  requestId: string
  category: CareUpdateCategory
  content: string
  occurredAt: string
}
