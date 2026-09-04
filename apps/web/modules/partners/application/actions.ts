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
import { isValidOptionalPartnerPhone } from "../domain/phone-format"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const INVALID_PHONE_ERROR =
  "Telefone inválido — use um número BR com DDD (10 ou 11 dígitos)."

/**
 * GATE-8-PARTNER-INPUT-MASKS-FIX-003: `PartnerForm.tsx` (Admin) usa a mesma
 * máscara das outras superfícies de Partner para EXIBIR o campo, mas — ao
 * contrário do onboarding público e da edição autenticada — não passa por
 * nenhum schema Zod antes de chegar aqui. Sem esta checagem, um valor que a
 * máscara deixa visível-mas-inválido (telefone com mais dígitos do que um
 * número BR comporta, ver `formatBrazilianPhone`) seguia direto para
 * `repository.ts`, que só faz `.trim()` — nenhuma validação, chamando a
 * action fora do formulário (ou um formulário nunca reforça client-side)
 * também salvaria o valor inválido do mesmo jeito.
 *
 * `isValidOptionalPartnerPhone` é a MESMA regra (padrão de caractere +
 * contagem de dígitos) que os schemas Zod de onboarding/portal já aplicam —
 * ver modules/partners/domain/phone-format.ts.
 */
function validatePartnerPhoneOrError(phone: string | undefined): string | null {
  return isValidOptionalPartnerPhone(phone) ? null : INVALID_PHONE_ERROR
}

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

    const phoneError = validatePartnerPhoneOrError(input.phone)
    if (phoneError) return { ok: false, error: phoneError }

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

    const phoneError = validatePartnerPhoneOrError(input.phone)
    if (phoneError) return { ok: false, error: phoneError }

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
