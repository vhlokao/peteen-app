"use server"

/**
 * Módulo: care-timeline
 * Camada: application — inspeção administrativa (V0, somente leitura)
 *
 * Sem mutation. Sem Server Action de escrita. Guard: requireAdmin() aqui,
 * não confiando apenas no layout (AdminShell) — defesa em profundidade,
 * mesmo padrão de admin/partners/[id]/page.tsx.
 */

import { requireAdmin } from "@/modules/identity/application/get-session"
import type { ActionResult } from "@/modules/tutor/domain/types"
import type { AdminCareTimelineInspection } from "../domain/admin-types"
import { getAdminCareTimelineInspection } from "../infrastructure/admin-repository"

export async function getAdminCareTimelineInspectionAction(
  requestId: string
): Promise<ActionResult<AdminCareTimelineInspection>> {
  try {
    await requireAdmin()

    const data = await getAdminCareTimelineInspection(requestId)
    return { success: true, data }
  } catch (err) {
    // O erro em si (stack/mensagem técnica) é seguro de logar — nunca o
    // conteúdo da timeline, que não passa por aqui.
    console.error("[getAdminCareTimelineInspectionAction]", err)
    return { success: false, error: "Erro ao carregar o histórico do atendimento." }
  }
}
