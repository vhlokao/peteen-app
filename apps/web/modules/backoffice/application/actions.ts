"use server"

/**
 * módulo: backoffice
 * camada: application
 *
 * Server Actions do Backoffice Admin.
 *
 * Segurança:
 *   - Toda action verifica requireAdmin() antes de qualquer operação
 *   - Nenhuma query sensível exposta ao client
 *   - Retorna ActionResult<T> para tratamento consistente de erros
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import { recalculateAllTrustScores } from "@/modules/trust-engine/application/recalculate-all-trust-scores"
import type { RecalculateReport } from "@/modules/trust-engine/application/recalculate-all-trust-scores"

import {
  getDashboardMetrics,
  getAdminUsers,
  getAdminTutors,
  getAdminProfessionals,
  getAdminRequests,
  getAdminReviews,
  getAdminTrustData,
  getAdminRelationships,
  getAdminFlags,
  getAdminDisputes,
  getAdminAuditLogs,
  getAdminRiskData,
} from "../infrastructure/repository"
import type {
  AdminDashboardMetrics,
  AdminUserRow,
  AdminTutorRow,
  AdminProfessionalRow,
  AdminRequestRow,
  AdminReviewRow,
  AdminTrustRow,
  AdminRelationshipRow,
  AdminFlagRow,
  AdminDisputeRow,
  AdminAuditRow,
  AdminRiskRow,
  AdminUsersFilter,
  AdminRequestsFilter,
  AdminRelationshipsFilter,
  AdminFlagsFilter,
  AdminDisputesFilter,
  AdminAuditFilter,
} from "../domain/types"

// ── Guard interno ─────────────────────────────────────────────────────────────

async function assertAdmin(): Promise<void> {
  const ctx = await getAuthContext()
  if (!ctx.authenticated || !ctx.user.roles.includes("ADMIN")) {
    redirect("/dashboard")
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getAdminDashboardAction(): Promise<AdminDashboardMetrics> {
  await assertAdmin()
  return getDashboardMetrics()
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getAdminUsersAction(
  filter: AdminUsersFilter = {}
): Promise<AdminUserRow[]> {
  await assertAdmin()
  return getAdminUsers(filter)
}

// ── Tutors ────────────────────────────────────────────────────────────────────

export async function getAdminTutorsAction(): Promise<AdminTutorRow[]> {
  await assertAdmin()
  return getAdminTutors()
}

// ── Professionals ─────────────────────────────────────────────────────────────

export async function getAdminProfessionalsAction(): Promise<AdminProfessionalRow[]> {
  await assertAdmin()
  return getAdminProfessionals()
}

// ── Requests ──────────────────────────────────────────────────────────────────

export async function getAdminRequestsAction(
  filter: AdminRequestsFilter = {}
): Promise<AdminRequestRow[]> {
  await assertAdmin()
  return getAdminRequests(filter)
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function getAdminReviewsAction(): Promise<AdminReviewRow[]> {
  await assertAdmin()
  return getAdminReviews()
}

// ── Trust ─────────────────────────────────────────────────────────────────────

export async function getAdminTrustDataAction(): Promise<AdminTrustRow[]> {
  await assertAdmin()
  return getAdminTrustData()
}

// ── Relationships ─────────────────────────────────────────────────────────────

export async function getAdminRelationshipsAction(
  filter: AdminRelationshipsFilter = {}
): Promise<AdminRelationshipRow[]> {
  await assertAdmin()
  return getAdminRelationships(filter)
}

// ── Trust Engine Actions ──────────────────────────────────────────────────────

export async function recalculateSingleTrustAction(
  professionalId: string
): Promise<{ success: boolean; error?: string }> {
  await assertAdmin()
  try {
    await updateProfessionalTrust(professionalId)
    revalidatePath("/admin/trust")
    revalidatePath("/admin/professionals")
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    }
  }
}

export async function recalculateAllTrustAction(): Promise<
  { success: boolean; report?: RecalculateReport; error?: string }
> {
  await assertAdmin()
  try {
    const report = await recalculateAllTrustScores()
    revalidatePath("/admin/trust")
    revalidatePath("/admin/professionals")
    return { success: true, report }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    }
  }
}

// ── Flags — Etapa 5.5 ────────────────────────────────────────────────────────

export async function getAdminFlagsAction(
  filter: AdminFlagsFilter = {}
): Promise<{ success: boolean; data?: AdminFlagRow[]; error?: string }> {
  try {
    await assertAdmin()
    const data = await getAdminFlags(filter)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Disputes — Etapa 5.5 ─────────────────────────────────────────────────────

export async function getAdminDisputesAction(
  filter: AdminDisputesFilter = {}
): Promise<{ success: boolean; data?: AdminDisputeRow[]; error?: string }> {
  try {
    await assertAdmin()
    const data = await getAdminDisputes(filter)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Audit Log — Etapa 5.5 ────────────────────────────────────────────────────

export async function getAdminAuditAction(
  filter: AdminAuditFilter = {}
): Promise<{ success: boolean; data?: AdminAuditRow[]; error?: string }> {
  try {
    await assertAdmin()
    const data = await getAdminAuditLogs(filter)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Risk Score — Etapa 5.5 ───────────────────────────────────────────────────

export async function getAdminRiskAction(): Promise<{
  success: boolean
  data?:   AdminRiskRow[]
  error?:  string
}> {
  try {
    await assertAdmin()
    const data = await getAdminRiskData()
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Recommendation Engine — Etapa 5.7 ────────────────────────────────────────

export async function getAdminRecommendationsAction(): Promise<
  import("@/modules/recommendation/domain/types").RecommendedProfessional[]
> {
  await assertAdmin()
  const { getAdminRecommendationScores } = await import(
    "@/modules/recommendation/application/get-recommendations"
  )
  return getAdminRecommendationScores()
}

// ── Trust Graph — Etapa 5.8 ──────────────────────────────────────────────────

export async function getAdminProfessionalsForTrustGraphAction(): Promise<
  Array<{ id: string; displayName: string; city: string }>
> {
  await assertAdmin()
  const { prisma } = await import("@/lib/prisma/client")
  return prisma.professionalProfile.findMany({
    where:   { deletedAt: null },
    select:  { id: true, displayName: true, city: true },
    orderBy: { displayName: "asc" },
  })
}
