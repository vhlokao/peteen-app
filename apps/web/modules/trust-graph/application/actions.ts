"use server"

/**
 * módulo: trust-graph
 * camada: application
 *
 * Server Actions para gerenciamento de TrustConnections.
 * Restrito a administradores.
 * Toda ação sensível gera AdminAuditLog.
 */

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/modules/identity/application/get-session"
import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"
import { updateProfessionalTrust } from "@/modules/trust-engine/application/update-professional-trust"
import {
  createTrustConnection,
  setConnectionActive,
  getAllConnectionsAdmin,
} from "../infrastructure/repository"
import type {
  CreateTrustConnectionInput,
  AdminTrustConnectionRow,
} from "../domain/types"

type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

// ── Guard interno ─────────────────────────────────────────────────────────────

async function assertAdmin(): Promise<string> {
  const user = await requireAdmin()
  return user.id
}

// ─────────────────────────────────────────────────────────────────────────────
// LEITURA
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminTrustConnectionsAction(filters?: {
  sourceType?: string
  connectionType?: string
  isActive?: boolean
}): Promise<AdminTrustConnectionRow[]> {
  await assertAdmin()
  return getAllConnectionsAdmin(filters as Parameters<typeof getAllConnectionsAdmin>[0])
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export async function createTrustConnectionAction(
  input: CreateTrustConnectionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminId = await assertAdmin()
    const connection = await createTrustConnection(input)

    await createAdminAudit({
      adminId,
      action:     "trust_graph.create",
      entityType: "TRUST_CONNECTION",
      entityId:   connection.id,
      metadata: {
        sourceId:        connection.sourceId,
        sourceName:      connection.sourceName,
        sourcePartnerId: input.sourcePartnerId ?? null,
        targetId:        connection.targetId,
        connectionType:  connection.connectionType,
        weight:          connection.weight,
      },
    })

    // Recalcula Trust Score do profissional alvo (falha silenciosa)
    await updateProfessionalTrust(input.targetId)

    revalidatePath("/admin/trust-graph")
    revalidatePath("/admin")
    return { ok: true, data: { id: connection.id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar conexão"
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Já existe uma conexão igual para este profissional." }
    }
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE ATIVO/INATIVO
// ─────────────────────────────────────────────────────────────────────────────

export async function setTrustConnectionActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdmin()
    const { targetId } = await setConnectionActive(id, isActive)

    await createAdminAudit({
      adminId,
      action:     isActive ? "trust_graph.enable" : "trust_graph.disable",
      entityType: "TRUST_CONNECTION",
      entityId:   id,
      metadata:   { isActive },
    })

    // Recalcula Trust Score do profissional alvo (falha silenciosa)
    await updateProfessionalTrust(targetId)

    revalidatePath("/admin/trust-graph")
    revalidatePath("/admin/trust")
    revalidatePath("/admin/recommendations")
    revalidatePath("/admin/badges")
    revalidatePath("/admin")
    revalidatePath("/discover", "layout")
    return { ok: true, data: undefined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar conexão"
    return { ok: false, error: msg }
  }
}
