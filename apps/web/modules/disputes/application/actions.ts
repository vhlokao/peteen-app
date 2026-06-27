"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { prisma } from "@/lib/prisma/client"
import { requireAuth, requireAdmin } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import {
  createDispute,
  updateDisputeStatus,
} from "@/modules/moderation/infrastructure/repository"
import type { ActionResult } from "@/modules/tutor/domain/types"

import {
  DISPUTE_REASON_OPTIONS,
  type AdminDisputeListRow,
  type CreateDisputeFormInput,
  type DisputeStatus,
  type DisputeSummary,
} from "../domain/types"
import { recordDisputeAudit, toDisputeSummary } from "../infrastructure/audit"
import {
  findActiveDisputeByRequestId,
  findDisputeById,
  listDisputesForAdmin,
} from "../infrastructure/queries"

const CreateDisputeSchema = z.object({
  reason: z.enum(DISPUTE_REASON_OPTIONS, {
    error: () => "Selecione um motivo válido.",
  }),
  description: z
    .string()
    .max(1000, "Descrição pode ter no máximo 1000 caracteres.")
    .optional(),
})

const BLOCKED_REQUEST_STATUSES = new Set([
  "PENDING",
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "EXPIRED",
])

function revalidateDisputePaths(requestId: string) {
  revalidatePath("/admin/disputes")
  revalidatePath("/admin/activity")
  revalidatePath(`/tutor/requests/${requestId}`)
  revalidatePath(`/requests/${requestId}`)
  revalidatePath("/tutor/activity")
  revalidatePath("/professional/activity")
  revalidatePath("/admin/audit")
}

export async function getAdminDisputesListAction(filter?: {
  status?: string
}): Promise<ActionResult<AdminDisputeListRow[]>> {
  try {
    await requireAdmin()
    const data = await listDisputesForAdmin(filter)
    return { success: true, data }
  } catch (err) {
    console.error("[getAdminDisputesListAction]", err)
    return { success: false, error: "Erro ao buscar disputas." }
  }
}

export async function createDisputeForRequestAction(
  requestId: string,
  input: CreateDisputeFormInput
): Promise<ActionResult<DisputeSummary>> {
  try {
    const session = await requireAuth()

    const tutorProfile = await findTutorProfileByUserId(session.id)
    if (!tutorProfile) {
      return { success: false, error: "Acesso negado." }
    }

    const parsed = CreateDisputeSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, tutorId: true, status: true },
    })

    if (!request || request.tutorId !== tutorProfile.id) {
      return { success: false, error: "Solicitação não encontrada ou acesso negado." }
    }

    if (BLOCKED_REQUEST_STATUSES.has(request.status)) {
      return {
        success: false,
        error: "Esta solicitação não pode ser contestada no status atual.",
      }
    }

    const existing = await findActiveDisputeByRequestId(requestId)
    if (existing) {
      return {
        success: false,
        error: "Já existe uma disputa aberta para esta solicitação.",
      }
    }

    const created = await createDispute({
      requestId,
      openedBy: session.id,
      reason: parsed.data.reason,
      description: parsed.data.description?.trim() || undefined,
    })

    const summary = toDisputeSummary(created)
    await recordDisputeAudit(session.id, "dispute.created", summary)

    revalidateDisputePaths(requestId)
    return { success: true, data: summary }
  } catch (err) {
    console.error("[createDisputeForRequestAction]", err)
    return { success: false, error: "Erro interno ao abrir disputa." }
  }
}

export async function updateDisputeStatusAction(
  disputeId: string,
  status: DisputeStatus
): Promise<ActionResult<DisputeSummary>> {
  try {
    const admin = await requireAdmin()

    const existing = await findDisputeById(disputeId)
    if (!existing) {
      return { success: false, error: "Disputa não encontrada." }
    }

    if (existing.status === status) {
      return { success: false, error: "A disputa já está neste status." }
    }

    await updateDisputeStatus(disputeId, status, admin.id)

    const updated = await findDisputeById(disputeId)
    if (!updated) {
      return { success: false, error: "Erro ao atualizar disputa." }
    }

    await recordDisputeAudit(admin.id, "dispute.status_updated", updated, existing)

    revalidateDisputePaths(updated.requestId)
    return { success: true, data: updated }
  } catch (err) {
    console.error("[updateDisputeStatusAction]", err)
    return { success: false, error: "Erro interno ao atualizar disputa." }
  }
}
