"use server"

/**
 * módulo: verification
 * camada: application — Server Actions (Etapa 6.2)
 */

import { revalidatePath } from "next/cache"

import { requireAdmin, requireRole } from "@/modules/identity/application/get-session"
import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"
import {
  getVerificationMetrics,
  getVerificationRequests,
  getVerificationRequestById,
  createVerificationRequestRecord,
  applyPartnerVerificationPending,
  applyPartnerVerificationApproved,
  applyPartnerVerificationRejected,
  applyProfessionalVerificationApproved,
  approveVerificationRequestRecord,
  rejectVerificationRequestRecord,
  getPartnerSlug,
  findPendingVerificationRequest,
  isProfessionalVerified,
  closeAllPendingVerificationRequestsForEntity,
  hasApprovedVerificationRequest,
  isEntityVerificationSuspended,
  isEntityVerificationActive,
  applyProfessionalVerificationSuspended,
  applyProfessionalVerificationReactivated,
  applyPartnerVerificationSuspended,
  applyPartnerVerificationReactivated,
} from "../infrastructure/repository"
import { prepareVerificationQueue } from "./prepare-queue"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import { prisma } from "@/lib/prisma/client"
import type {
  VerificationAdminRow,
  VerificationMetrics,
  VerificationListFilters,
  VerificationEntityType,
} from "../domain/types"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "already_verified" | "already_pending" }

async function assertAdminId(): Promise<string> {
  const user = await requireAdmin()
  return user.id
}

async function buildEntityAuditMetadata(
  entityType: VerificationEntityType,
  entityId: string,
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {
    entityType,
    entityId,
    ...extra,
  }

  if (entityType === "PROFESSIONAL") {
    const pro = await prisma.professionalProfile.findUnique({
      where: { id: entityId },
      select: { displayName: true, user: { select: { email: true } } },
    })
    if (pro) {
      metadata.displayName = pro.displayName
      metadata.email = pro.user.email
      metadata.entityLabel = `${pro.displayName} — ${pro.user.email ?? "sem email"}`
    }
  } else {
    const partner = await prisma.partner.findUnique({
      where: { id: entityId },
      select: { businessName: true, city: true },
    })
    if (partner) {
      metadata.businessName = partner.businessName
      metadata.city = partner.city
      metadata.entityLabel = `${partner.businessName} — parceiro (${partner.city})`
    }
  }

  return metadata
}

async function revalidateVerificationPaths(
  entityType: VerificationEntityType,
  entityId: string
): Promise<void> {
  revalidatePath("/admin/verifications")
  revalidatePath("/admin/partners")
  revalidatePath("/admin/badges")
  revalidatePath("/admin/audit")
  revalidatePath("/professional/metricas")

  if (entityType === "PARTNER") {
    const slug = await getPartnerSlug(entityId)
    if (slug) revalidatePath(`/partners/${slug}`)
  } else {
    revalidatePath("/admin/professionals")
    revalidatePath(`/discover/${entityId}`)
    revalidatePath("/admin/trust")
    revalidatePath(`/admin/trust-debug/${entityId}`)
  }
}

export async function getAdminVerificationMetricsAction(): Promise<VerificationMetrics> {
  await assertAdminId()
  await prepareVerificationQueue()
  return getVerificationMetrics()
}

export async function getAdminVerificationsAction(
  filters?: VerificationListFilters
): Promise<VerificationAdminRow[]> {
  await assertAdminId()
  await prepareVerificationQueue()
  return getVerificationRequests(filters)
}

export async function requestVerificationAction(input: {
  entityType: VerificationEntityType
  entityId: string
  notes?: string
}): Promise<ActionResult<{ requestId: string }>> {
  try {
    const request = await createVerificationRequestRecord(input)

    if (input.entityType === "PARTNER") {
      await applyPartnerVerificationPending(input.entityId)
    }

    const systemAdminId = await findSystemAdminId()
    if (systemAdminId) {
      await createAdminAudit({
        adminId:    systemAdminId,
        action:     "verification.requested",
        entityType: input.entityType,
        entityId:   input.entityId,
        metadata:   {
          requestId: request.id,
          notes:     input.notes ?? null,
          source:    "verification_engine",
        },
      }).catch(() => {})
    }

    revalidatePath("/admin/verifications")
    revalidatePath("/admin/badges")
    revalidatePath("/professional/metricas")
    return { ok: true, data: { requestId: request.id } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao solicitar verificação",
    }
  }
}

export async function requestProfessionalVerificationAction(
  professionalId: string,
  notes?: string
): Promise<ActionResult<{ requestId: string }>> {
  if (await isProfessionalVerified(professionalId)) {
    return {
      ok:    false,
      error: "Este perfil já está verificado.",
      code:  "already_verified",
    }
  }

  if (await hasApprovedVerificationRequest("PROFESSIONAL", professionalId)) {
    return {
      ok:    false,
      error: "Verificação suspensa ou encerrada — solicite reativação ao admin.",
      code:  "already_verified",
    }
  }

  const existing = await findPendingVerificationRequest("PROFESSIONAL", professionalId)
  if (existing) {
    return { ok: true, data: { requestId: existing.id } }
  }

  return requestVerificationAction({
    entityType: "PROFESSIONAL",
    entityId: professionalId,
    notes,
  })
}

export async function approveVerificationAction(
  requestId: string
): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdminId()
    const existing = await getVerificationRequestById(requestId)
    if (!existing) return { ok: false, error: "Solicitação não encontrada." }
    if (existing.status !== "PENDING") {
      return { ok: false, error: "Esta solicitação já foi analisada." }
    }

    const updated = await approveVerificationRequestRecord(requestId, adminId)

    if (updated.entityType === "PARTNER") {
      await applyPartnerVerificationApproved(updated.entityId)
    } else {
      await applyProfessionalVerificationApproved(updated.entityId)
      await updateProfessionalTrust(updated.entityId)
    }

    await closeAllPendingVerificationRequestsForEntity(
      updated.entityType,
      updated.entityId,
      adminId,
      "APPROVED"
    )

    const auditMetadata: Record<string, unknown> = { requestId: updated.id }

    if (updated.entityType === "PROFESSIONAL") {
      const pro = await prisma.professionalProfile.findUnique({
        where: { id: updated.entityId },
        select: { displayName: true, user: { select: { email: true } } },
      })
      if (pro) {
        auditMetadata.displayName = pro.displayName
        auditMetadata.email = pro.user.email
      }
    } else {
      const partner = await prisma.partner.findUnique({
        where: { id: updated.entityId },
        select: { businessName: true, city: true },
      })
      if (partner) {
        auditMetadata.businessName = partner.businessName
        auditMetadata.city = partner.city
      }
    }

    await createAdminAudit({
      adminId,
      action:     "verification.approved",
      entityType: updated.entityType,
      entityId:   updated.entityId,
      metadata:   auditMetadata,
    })

    revalidatePath("/admin/verifications")
    revalidatePath("/admin/partners")
    revalidatePath("/admin/badges")
    revalidatePath("/admin/professionals")
    revalidatePath("/professional/metricas")

    if (updated.entityType === "PARTNER") {
      const slug = await getPartnerSlug(updated.entityId)
      if (slug) revalidatePath(`/partners/${slug}`)
    } else {
      revalidatePath(`/discover/${updated.entityId}`)
    }
    revalidatePath("/admin/trust")
    revalidatePath(`/admin/trust-debug/${updated.entityId}`)

    return { ok: true, data: undefined }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao aprovar verificação",
    }
  }
}

export async function rejectVerificationAction(
  requestId: string,
  rejectionReason: string
): Promise<ActionResult<void>> {
  try {
    if (!rejectionReason.trim()) {
      return { ok: false, error: "Informe o motivo da rejeição." }
    }

    const adminId = await assertAdminId()
    const existing = await getVerificationRequestById(requestId)
    if (!existing) return { ok: false, error: "Solicitação não encontrada." }
    if (existing.status !== "PENDING") {
      return { ok: false, error: "Esta solicitação já foi analisada." }
    }

    const updated = await rejectVerificationRequestRecord(
      requestId,
      adminId,
      rejectionReason
    )

    if (updated.entityType === "PARTNER") {
      await applyPartnerVerificationRejected(updated.entityId)
    }
    // Profissional: rejeição só encerra a solicitação — não altera isVerified existente.

    await createAdminAudit({
      adminId,
      action:     "verification.rejected",
      entityType: updated.entityType,
      entityId:   updated.entityId,
      metadata:   {
        requestId:       updated.id,
        rejectionReason: updated.rejectionReason,
      },
    })

    revalidatePath("/admin/verifications")
    revalidatePath("/admin/partners")
    revalidatePath("/admin/badges")
    revalidatePath("/professional/metricas")

    return { ok: true, data: undefined }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao rejeitar verificação",
    }
  }
}

export async function suspendVerificationAction(input: {
  entityType: VerificationEntityType
  entityId: string
  reason?: string
}): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdminId()
    const { entityType, entityId, reason } = input

    if (!(await hasApprovedVerificationRequest(entityType, entityId))) {
      return {
        ok: false,
        error: "Nenhuma verificação aprovada encontrada para esta entidade.",
      }
    }

    if (await isEntityVerificationSuspended(entityType, entityId)) {
      return { ok: true, data: undefined }
    }

    if (!(await isEntityVerificationActive(entityType, entityId))) {
      return { ok: true, data: undefined }
    }

    const previousStatus = "VERIFIED"
    const newStatus = "SUSPENDED"

    if (entityType === "PROFESSIONAL") {
      await applyProfessionalVerificationSuspended(entityId)
      await updateProfessionalTrust(entityId)
    } else {
      await applyPartnerVerificationSuspended(entityId)
    }

    const metadata = await buildEntityAuditMetadata(entityType, entityId, {
      previousStatus,
      newStatus,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    })

    await createAdminAudit({
      adminId,
      action:     "verification.suspended",
      entityType,
      entityId,
      metadata,
    })

    await revalidateVerificationPaths(entityType, entityId)
    return { ok: true, data: undefined }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao suspender verificação",
    }
  }
}

export async function reactivateVerificationAction(input: {
  entityType: VerificationEntityType
  entityId: string
  reason?: string
}): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdminId()
    const { entityType, entityId, reason } = input

    if (!(await hasApprovedVerificationRequest(entityType, entityId))) {
      return {
        ok: false,
        error: "Nenhuma verificação aprovada encontrada para esta entidade.",
      }
    }

    if (await isEntityVerificationActive(entityType, entityId)) {
      return { ok: true, data: undefined }
    }

    if (!(await isEntityVerificationSuspended(entityType, entityId))) {
      return {
        ok: false,
        error: "Entidade não está suspensa — não é possível reativar.",
      }
    }

    const previousStatus = "SUSPENDED"
    const newStatus = "VERIFIED"

    if (entityType === "PROFESSIONAL") {
      await applyProfessionalVerificationReactivated(entityId)
      await updateProfessionalTrust(entityId)
    } else {
      await applyPartnerVerificationReactivated(entityId)
    }

    const metadata = await buildEntityAuditMetadata(entityType, entityId, {
      previousStatus,
      newStatus,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    })

    await createAdminAudit({
      adminId,
      action:     "verification.reactivated",
      entityType,
      entityId,
      metadata,
    })

    await revalidateVerificationPaths(entityType, entityId)
    return { ok: true, data: undefined }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao reativar verificação",
    }
  }
}

async function findSystemAdminId(): Promise<string | null> {
  const { prisma } = await import("@/lib/prisma/client")
  const admin = await prisma.adminProfile.findFirst({
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  })
  return admin?.userId ?? null
}

export async function requestMyProfessionalVerificationAction(): Promise<
  ActionResult<{ requestId: string }>
> {
  try {
    const user = await requireRole("PROFESSIONAL")
    const { prisma } = await import("@/lib/prisma/client")
    const pro = await prisma.professionalProfile.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, isVerified: true, verifiedIdentity: true },
    })
    if (!pro) return { ok: false, error: "Perfil profissional não encontrado." }
    if (pro.isVerified) {
      return {
        ok:    false,
        error: "Seu perfil já está verificado.",
        code:  "already_verified",
      }
    }
    if (await hasApprovedVerificationRequest("PROFESSIONAL", pro.id)) {
      return {
        ok:    false,
        error: "Sua verificação está suspensa. Entre em contato com o suporte.",
        code:  "already_verified",
      }
    }
    return requestProfessionalVerificationAction(pro.id)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao solicitar verificação",
    }
  }
}
