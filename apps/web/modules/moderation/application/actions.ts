"use server"

/**
 * módulo: moderation
 * camada: application
 *
 * Server Actions de moderação, flags, disputas e auditoria.
 * Toda action verifica autenticação e registra auditoria quando relevante.
 */

import { revalidatePath } from "next/cache"

import { getAuthContext } from "@/modules/identity/application/get-session"
import {
  createFlag,
  resolveFlagRecord,
  createDispute,
  updateDisputeStatus,
  createAdminAudit,
  hideReview,
  restoreReview,
} from "../infrastructure/repository"
import type {
  CreateFlagInput,
  CreateDisputeInput,
  FlagStatus,
  DisputeStatus,
} from "../domain/types"

// ── Guard interno ─────────────────────────────────────────────────────────────

async function assertAdmin(): Promise<string> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated || !ctx.user.roles.includes("ADMIN")) {
    throw new Error("FORBIDDEN: ADMIN role required")
  }
  return ctx.user.id
}

// ── Flags ─────────────────────────────────────────────────────────────────────

export async function createFlagAction(
  input: CreateFlagInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()
    await createFlag({ ...input, source: input.source ?? "ADMIN" })
    await createAdminAudit({
      adminId,
      action:     "flag.create",
      entityType: input.targetType,
      entityId:   input.targetId,
      metadata:   { reason: input.reason, severity: input.severity },
    })
    revalidatePath("/admin/flags")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function resolveFlagAction(
  flagId: string,
  status: FlagStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()
    await resolveFlagRecord(flagId, status, adminId)
    await createAdminAudit({
      adminId,
      action:     "flag.resolve",
      entityType: "OperationalFlag",
      entityId:   flagId,
      metadata:   { newStatus: status },
    })
    revalidatePath("/admin/flags")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Disputas ──────────────────────────────────────────────────────────────────

export async function createDisputeAction(
  input: CreateDisputeInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getAuthContext()
    if (!ctx.authenticated) throw new Error("UNAUTHENTICATED")
    await createDispute({ ...input, openedBy: ctx.user.id })
    revalidatePath("/admin/disputes")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateDisputeAction(
  disputeId: string,
  status:    DisputeStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()
    await updateDisputeStatus(disputeId, status, adminId)
    await createAdminAudit({
      adminId,
      action:     "dispute.update",
      entityType: "Dispute",
      entityId:   disputeId,
      metadata:   { newStatus: status },
    })
    revalidatePath("/admin/disputes")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Review Moderation ─────────────────────────────────────────────────────────

export async function hideReviewAction(
  reviewId: string,
  reason:   string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()
    await hideReview(reviewId, reason)
    await createAdminAudit({
      adminId,
      action:     "review.hide",
      entityType: "Review",
      entityId:   reviewId,
      metadata:   { reason },
    })
    revalidatePath("/admin/reviews")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function restoreReviewAction(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()
    await restoreReview(reviewId)
    await createAdminAudit({
      adminId,
      action:     "review.restore",
      entityType: "Review",
      entityId:   reviewId,
    })
    revalidatePath("/admin/reviews")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Verificação de Perfil ─────────────────────────────────────────────────────

export async function setVerifiedProfileAction(
  professionalId: string,
  verified:        boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminId = await assertAdmin()

    await (await import("@/lib/prisma/client")).prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        isVerified: verified,
        verifiedAt: verified ? new Date() : null,
      },
    })

    await createAdminAudit({
      adminId,
      action:     verified ? "badge.verify_profile" : "badge.unverify_profile",
      entityType: "PROFESSIONAL",
      entityId:   professionalId,
      metadata:   { verified },
    })

    revalidatePath(`/admin/badges`)
    revalidatePath(`/admin/professionals`)
    revalidatePath(`/discover/${professionalId}`)
    // Revalida a lista do Discovery para que o ShieldCheck e o selo atualizem
    revalidatePath(`/discover`, "layout")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Sistema interno (sem guard admin — chamado por rate limiter) ───────────────

export async function createSystemFlagAction(
  input: Omit<CreateFlagInput, "source">
): Promise<void> {
  try {
    await createFlag({ ...input, source: "SYSTEM" })
  } catch {
    // Flag do sistema falha silenciosamente — não quebra o fluxo principal
  }
}
