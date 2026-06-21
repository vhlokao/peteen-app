"use server"

/**
 * módulo: partners
 * camada: application — Server Actions
 */

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/modules/identity/application/get-session"
import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"
import {
  createPartner,
  updatePartner,
  setPartnerActive,
  getAllPartnersAdmin,
  getAllPartners,
  getPartnerById,
  getPartnerPublicProfile,
  getPartnerDashboardMetrics,
} from "../infrastructure/repository"
import type { CreatePartnerInput, UpdatePartnerInput, PartnerAdminRow, PartnerPublicProfile, PartnerDashboardMetrics } from "../domain/types"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminPartnersAction(filters?: {
  onboardingStatus?: import("../domain/types").PartnerOnboardingStatus
  onboardingFilter?: "incomplete" | "completed"
}): Promise<PartnerAdminRow[]> {
  await requireAdmin()
  return getAllPartnersAdmin(filters)
}

export async function getPartnerDashboardMetricsAction(): Promise<PartnerDashboardMetrics> {
  await requireAdmin()
  return getPartnerDashboardMetrics()
}

export async function createPartnerAction(
  input: CreatePartnerInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin()
    const partner = await createPartner(input)

    await createAdminAudit({
      adminId:    user.id,
      action:     "partner.create",
      entityType: "PARTNER",
      entityId:   partner.id,
      metadata:   { businessName: partner.businessName, slug: partner.slug, category: partner.category },
    })

    revalidatePath("/admin/partners")
    revalidatePath("/admin")
    return { ok: true, data: { id: partner.id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar parceiro"
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Já existe um parceiro com este slug." }
    }
    return { ok: false, error: msg }
  }
}

export async function updatePartnerAction(
  id: string,
  input: UpdatePartnerInput
): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin()
    const partner = await updatePartner(id, input)

    await createAdminAudit({
      adminId:    user.id,
      action:     "partner.update",
      entityType: "PARTNER",
      entityId:   id,
      metadata:   { businessName: partner.businessName, slug: partner.slug },
    })

    revalidatePath("/admin/partners")
    revalidatePath(`/partners/${partner.slug}`)
    revalidatePath("/discover", "layout")
    return { ok: true, data: undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar parceiro"
    return { ok: false, error: msg }
  }
}

export async function setPartnerActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const user = await requireAdmin()
    await setPartnerActive(id, isActive)
    const partner = await getPartnerById(id)

    await createAdminAudit({
      adminId:    user.id,
      action:     isActive ? "partner.activate" : "partner.deactivate",
      entityType: "PARTNER",
      entityId:   id,
      metadata:   { isActive, businessName: partner?.businessName },
    })

    revalidatePath("/admin/partners")
    revalidatePath("/admin")
    if (partner) revalidatePath(`/partners/${partner.slug}`)
    revalidatePath("/discover", "layout")
    return { ok: true, data: undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar status"
    return { ok: false, error: msg }
  }
}

// ── Público ───────────────────────────────────────────────────────────────────

export async function getPartnerPublicProfileAction(
  slug: string
): Promise<PartnerPublicProfile | null> {
  return getPartnerPublicProfile(slug)
}

/** Lista parceiros ativos — usado no formulário de Trust Graph */
export async function getActivePartnersForSelectAction(): Promise<
  Array<{ id: string; businessName: string; city: string; slug: string }>
> {
  await requireAdmin()
  const partners = await getAllPartners({ isActive: true })
  return partners.map((p) => ({
    id:           p.id,
    businessName: p.businessName,
    city:         p.city,
    slug:         p.slug,
  }))
}
