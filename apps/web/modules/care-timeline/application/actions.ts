"use server"

/**
 * Módulo: care-timeline
 * Camada: application (Server Actions)
 *
 * Care Timeline V0 — o profissional publica atualizações de cuidado dentro de
 * uma request IN_PROGRESS; o tutor visualiza. Toda mutação passa pelo padrão
 * de 3 camadas: auth → ownership → guards de estado/disputa/janela.
 *
 * Guards de negócio (decisões aprovadas):
 *   - Publicar/editar/excluir só com request IN_PROGRESS
 *   - Bloqueado se houver disputa aberta (congelamento — evidência preservada)
 *   - Edição só pelo autor, dentro de 15 min da publicação
 *   - Exclusão é soft (deletedAt) — Admin ainda enxerga
 */

import { revalidatePath } from "next/cache"

import { requireAuth } from "@/modules/identity/application/get-session"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findRequestWithOwnershipContext } from "@/modules/service-request/infrastructure/repository"
import { findActiveDisputeByRequestId } from "@/modules/disputes/infrastructure/queries"
import type { ActionResult } from "@/modules/tutor/domain/types"
import {
  CreateCareUpdateSchema,
  CARE_UPDATE_CONTENT_MIN,
  CARE_UPDATE_CONTENT_MAX,
  CARE_UPDATE_EDIT_WINDOW_MS,
  type CareUpdate,
  type CreateCareUpdateInput,
} from "../domain/types"
import { resolveEffectiveOccurredAt } from "../domain/occurred-at"
import {
  createCareUpdateAtomic,
  editCareUpdate,
  softDeleteCareUpdate,
  findCareUpdateById,
  getCareTimeline,
  recordCareUpdateAudit,
} from "../infrastructure/repository"

const DISPUTE_FROZEN_MESSAGE =
  "Esta solicitação está em disputa. A timeline de cuidado ficou congelada e não pode ser alterada."

const CONCURRENT_CHANGE_MESSAGE =
  "O estado da solicitação mudou. Recarregue a página e tente novamente."

function revalidateCarePaths(requestId: string) {
  revalidatePath(`/requests/${requestId}`)
  revalidatePath(`/tutor/requests/${requestId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICAR — apenas profissional dono, request IN_PROGRESS, sem disputa
// ─────────────────────────────────────────────────────────────────────────────

export async function publishCareUpdateAction(
  input: CreateCareUpdateInput
): Promise<ActionResult<CareUpdate>> {
  try {
    const { session } = await requireProfessionalContext()

    const parsed = CreateCareUpdateSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      }
    }

    const ctx = await findRequestWithOwnershipContext(parsed.data.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Ownership: só o profissional dono da request publica
    if (ctx.professionalUserId !== session.id) {
      return { success: false, error: "Apenas o profissional responsável pode publicar aqui." }
    }

    // Guard: request precisa estar em andamento
    if (ctx.request.status !== "IN_PROGRESS") {
      return {
        success: false,
        error: "Só é possível publicar atualizações durante um atendimento em andamento.",
      }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(parsed.data.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    // Validação temporal — regra canônica única (domain/occurred-at.ts).
    // O input do formulário tem precisão de minuto; publicar no mesmo minuto do
    // início é legítimo e o valor efetivo é elevado para startedAt.
    const resolved = resolveEffectiveOccurredAt({
      inputOccurredAt: parsed.data.occurredAt,
      startedAt: ctx.request.startedAt,
      now: new Date(),
    })
    if (!resolved.ok) {
      return {
        success: false,
        error:
          resolved.reason === "FUTURE"
            ? "A data/hora da atualização não pode ser no futuro."
            : "A data/hora da atualização não pode ser anterior ao início do atendimento.",
      }
    }
    // A partir daqui só existe UM occurredAt: o efetivo — persistido, auditado
    // e devolvido ao client.
    const occurredAt = resolved.occurredAt

    // Criação atômica: re-verifica status/disputa/startedAt sob lock da request
    // no instante da escrita. petId e professionalId são derivados da request
    // travada — nunca do client. null = estado mudou durante a operação.
    const created = await createCareUpdateAtomic({
      requestId: parsed.data.requestId,
      authorId: session.id,
      category: parsed.data.category,
      content: parsed.data.content,
      occurredAt,
    })
    if (!created) {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }

    await recordCareUpdateAudit(session.id, "care_update.published", created.id, null, {
      requestId: created.requestId,
      category: created.category,
      occurredAt: created.occurredAt.toISOString(),
      authorId: session.id,
      careUpdateId: created.id,
    })

    revalidateCarePaths(parsed.data.requestId)

    return { success: true, data: created }
  } catch (err) {
    console.error("[publishCareUpdateAction]", err)
    return { success: false, error: "Erro interno ao publicar atualização." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LER — tutor OU profissional participante
// ─────────────────────────────────────────────────────────────────────────────

export async function getCareTimelineAction(
  requestId: string
): Promise<ActionResult<CareUpdate[]>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Ownership: só participantes (tutor ou profissional) da request
    if (ctx.tutorUserId !== session.id && ctx.professionalUserId !== session.id) {
      return { success: false, error: "Você não tem acesso a esta timeline." }
    }

    const data = await getCareTimeline(requestId)
    return { success: true, data }
  } catch (err) {
    console.error("[getCareTimelineAction]", err)
    return { success: false, error: "Erro interno ao carregar a timeline." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR — autor, IN_PROGRESS, sem disputa, dentro de 15 min
// ─────────────────────────────────────────────────────────────────────────────

export async function editCareUpdateAction(
  id: string,
  content: string
): Promise<ActionResult<CareUpdate>> {
  try {
    const session = await requireAuth()

    const existing = await findCareUpdateById(id)
    if (!existing || existing.deletedAt) {
      return { success: false, error: "Atualização não encontrada." }
    }

    // Ownership: só o autor edita
    if (existing.authorId !== session.id) {
      return { success: false, error: "Apenas o autor pode editar esta atualização." }
    }

    // Janela de edição: 15 min a partir da publicação
    if (Date.now() > existing.createdAt.getTime() + CARE_UPDATE_EDIT_WINDOW_MS) {
      return {
        success: false,
        error: "A janela de edição desta atualização já expirou.",
      }
    }

    const ctx = await findRequestWithOwnershipContext(existing.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Guard: request precisa estar em andamento
    if (ctx.request.status !== "IN_PROGRESS") {
      return { success: false, error: "Só é possível editar durante um atendimento em andamento." }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(existing.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    const trimmed = content.trim()
    if (trimmed.length < CARE_UPDATE_CONTENT_MIN) {
      return { success: false, error: `A atualização precisa de pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres.` }
    }
    if (trimmed.length > CARE_UPDATE_CONTENT_MAX) {
      return { success: false, error: `A atualização pode ter no máximo ${CARE_UPDATE_CONTENT_MAX} caracteres.` }
    }

    // Guard atômico: a request precisa continuar IN_PROGRESS, sem disputa e
    // dentro da janela de 15 min no instante da escrita — se mudou desde a
    // validação acima, updated é null.
    const previousContent = existing.content
    const editedAt = new Date()
    const updated = await editCareUpdate(id, trimmed, editedAt)
    if (!updated) {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }

    // Auditoria administrativa (não exposta ao tutor, não em console):
    // preserva conteúdo anterior e novo para reconstrução pelo admin.
    await recordCareUpdateAudit(
      session.id,
      "care_update.edited",
      id,
      { content: previousContent },
      {
        content: trimmed,
        editedAt: editedAt.toISOString(),
        authorId: session.id,
        requestId: existing.requestId,
        careUpdateId: id,
      }
    )

    revalidateCarePaths(existing.requestId)

    return { success: true, data: updated }
  } catch (err) {
    console.error("[editCareUpdateAction]", err)
    return { success: false, error: "Erro interno ao editar atualização." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUIR (soft) — autor, IN_PROGRESS, sem disputa
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCareUpdateAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth()

    const existing = await findCareUpdateById(id)
    if (!existing || existing.deletedAt) {
      return { success: false, error: "Atualização não encontrada." }
    }

    // Ownership: só o autor exclui
    if (existing.authorId !== session.id) {
      return { success: false, error: "Apenas o autor pode excluir esta atualização." }
    }

    const ctx = await findRequestWithOwnershipContext(existing.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Guard: request precisa estar em andamento.
    // Regra aprovada (assimétrica e explícita): edição expira em 15 min, mas a
    // EXCLUSÃO é permitida durante todo o IN_PROGRESS — sem janela de tempo.
    if (ctx.request.status !== "IN_PROGRESS") {
      return { success: false, error: "Só é possível excluir durante um atendimento em andamento." }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(existing.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    // Snapshot ANTES de excluir — preserva evidência para reconstrução pelo admin.
    const deletedAt = new Date()
    const snapshot = {
      content: existing.content,
      category: existing.category,
      occurredAt: existing.occurredAt.toISOString(),
      authorId: existing.authorId,
      requestId: existing.requestId,
      careUpdateId: id,
    }

    // Guard atômico: aborta se a request saiu de IN_PROGRESS ou entrou em
    // disputa entre a validação acima e a escrita.
    const deleted = await softDeleteCareUpdate(id, deletedAt)
    if (!deleted) {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }

    await recordCareUpdateAudit(session.id, "care_update.deleted", id, snapshot, {
      ...snapshot,
      deletedAt: deletedAt.toISOString(),
    })

    revalidateCarePaths(existing.requestId)

    return { success: true, data: undefined }
  } catch (err) {
    console.error("[deleteCareUpdateAction]", err)
    return { success: false, error: "Erro interno ao excluir atualização." }
  }
}
