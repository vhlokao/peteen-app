"use server"

/**
 * módulo: service-request
 * camada: application — DEV/TEST ONLY
 *
 * Server Actions de desenvolvimento para destravar testes manuais.
 *
 * PROTEÇÃO DUPLA obrigatória em toda action deste arquivo:
 *   1. NODE_ENV === "development"  — impossível executar em production
 *   2. requireAdmin()              — apenas admins autenticados
 *
 * Nenhuma action aqui gera TrustEvent, altera Trust Score ou RelationshipScore.
 * Todas as alterações de status bypassam a máquina de estados propositalmente
 * e usam devForceStatusUpdate() diretamente no banco.
 */

import type { ActionResult }   from "@/modules/tutor/domain/types"
import { requireAdmin }        from "@/modules/identity/application/get-session"
import {
  devFindActiveRequests,
  devForceStatusUpdate,
  type DevActiveRequest,
} from "../infrastructure/repository"

// ─── Guard de ambiente ───────────────────────────────────────────────────────

function assertDevelopment(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "[DEV-ONLY] Esta ação só pode ser executada em ambiente de desenvolvimento."
    )
  }
}

// ─── Listagem ────────────────────────────────────────────────────────────────

/**
 * Lista todas as solicitações ativas (PENDING/ACCEPTED/IN_PROGRESS).
 * Usado pela página /admin/dev-tools para visualizar bloqueios.
 */
export async function devListActiveRequestsAction(): Promise<
  ActionResult<DevActiveRequest[]>
> {
  try {
    assertDevelopment()
    await requireAdmin()

    const rows = await devFindActiveRequests()
    return { success: true, data: rows }
  } catch (err) {
    console.error("[devListActiveRequestsAction]", err)
    return { success: false, error: String(err) }
  }
}

// ─── Cancelamento individual ─────────────────────────────────────────────────

/**
 * Cancela uma solicitação ativa forçando status terminal sem TrustEvent.
 *
 * Regras:
 *   PENDING  → CANCELLED_BY_TUTOR
 *   ACCEPTED → CANCELLED_BY_TUTOR
 *   IN_PROGRESS → CANCELLED_BY_PROFESSIONAL  (bypass state machine — não existe esta transição normalmente)
 *
 * Solicitações já terminais (COMPLETED, DISPUTED, EXPIRED, CANCELLED_*) são rejeitadas.
 */
export async function devCancelServiceRequestAction(
  requestId: string
): Promise<ActionResult<void>> {
  try {
    assertDevelopment()
    await requireAdmin()

    const { prisma } = await import("@/lib/prisma/client")

    const request = await prisma.serviceRequest.findUnique({
      where:  { id: requestId },
      select: { id: true, status: true },
    })

    if (!request) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    const status = request.status

    if (
      status === "COMPLETED" ||
      status === "CANCELLED_BY_TUTOR" ||
      status === "CANCELLED_BY_PROFESSIONAL" ||
      status === "DISPUTED" ||
      status === "EXPIRED"
    ) {
      return {
        success: false,
        error: `Solicitação já está em estado terminal: ${status}.`,
      }
    }

    const newStatus =
      status === "IN_PROGRESS"
        ? "CANCELLED_BY_PROFESSIONAL"
        : "CANCELLED_BY_TUTOR"

    await devForceStatusUpdate(requestId, newStatus)

    console.warn(`[DEV] Request ${requestId} forçado para ${newStatus} (dev cancel)`)

    return { success: true, data: undefined }
  } catch (err) {
    console.error("[devCancelServiceRequestAction]", err)
    return { success: false, error: String(err) }
  }
}

// ─── Expirar individual ───────────────────────────────────────────────────────

/**
 * Expira uma solicitação PENDING ou ACCEPTED (sem TrustEvent).
 * Útil para limpar requests antigos sem gerar cancelamento formal.
 *
 * Apenas PENDING e ACCEPTED podem ser expirados.
 * IN_PROGRESS deve ser cancelado via devCancelServiceRequestAction.
 */
export async function devExpireServiceRequestAction(
  requestId: string
): Promise<ActionResult<void>> {
  try {
    assertDevelopment()
    await requireAdmin()

    const { prisma } = await import("@/lib/prisma/client")

    const request = await prisma.serviceRequest.findUnique({
      where:  { id: requestId },
      select: { id: true, status: true },
    })

    if (!request) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    if (request.status !== "PENDING" && request.status !== "ACCEPTED") {
      return {
        success: false,
        error: `Apenas PENDING e ACCEPTED podem ser expirados. Status atual: ${request.status}.`,
      }
    }

    await devForceStatusUpdate(requestId, "EXPIRED")

    console.warn(`[DEV] Request ${requestId} expirado (dev expire)`)

    return { success: true, data: undefined }
  } catch (err) {
    console.error("[devExpireServiceRequestAction]", err)
    return { success: false, error: String(err) }
  }
}

// ─── Limpar par tutor/profissional ───────────────────────────────────────────

/**
 * Cancela/expira TODAS as solicitações ativas entre um tutor e um profissional.
 * Usado para destravar o guardrail de duplicata em aberto durante testes.
 *
 * Estratégia:
 *   PENDING/ACCEPTED → EXPIRED
 *   IN_PROGRESS      → CANCELLED_BY_PROFESSIONAL (bypass state machine)
 *
 * Usa transação Prisma para garantir atomicidade.
 * Nenhuma TrustEvent gerada.
 */
export async function devClearActiveRequestsBetweenAction(
  tutorId: string,
  professionalId: string
): Promise<ActionResult<{ cleared: number }>> {
  try {
    assertDevelopment()
    await requireAdmin()

    if (!tutorId || !professionalId) {
      return { success: false, error: "tutorId e professionalId são obrigatórios." }
    }

    const { prisma } = await import("@/lib/prisma/client")

    const active = await prisma.serviceRequest.findMany({
      where: {
        tutorId,
        professionalId,
        status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] },
      },
      select: { id: true, status: true },
    })

    if (active.length === 0) {
      return { success: true, data: { cleared: 0 } }
    }

    await prisma.$transaction(
      active.map((r) =>
        prisma.serviceRequest.update({
          where: { id: r.id },
          data: {
            status:
              r.status === "IN_PROGRESS"
                ? "CANCELLED_BY_PROFESSIONAL"
                : "EXPIRED",
          },
        })
      )
    )

    console.warn(
      `[DEV] ${active.length} request(s) limpos entre tutor=${tutorId} e professional=${professionalId}`
    )

    return { success: true, data: { cleared: active.length } }
  } catch (err) {
    console.error("[devClearActiveRequestsBetweenAction]", err)
    return { success: false, error: String(err) }
  }
}
