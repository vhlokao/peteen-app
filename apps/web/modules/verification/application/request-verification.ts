import "server-only"

/**
 * Criação de VerificationRequest — funções INTERNAS, nunca Server Actions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * As duas funções abaixo viviam em `actions.ts`, que começa com `"use server"`.
 * Nesse arquivo TODO export vira uma Server Action — um endpoint RPC que
 * qualquer cliente pode invocar. E as duas recebem o alvo (`entityId` /
 * `professionalId`) como PARÂMETRO, sem checar sessão nem posse.
 *
 * O efeito prático era IDOR: um chamador arbitrário podia criar
 * VerificationRequest para qualquer profissional ou parceiro e, no caminho de
 * PARTNER, empurrar a entidade para PENDING_VERIFICATION — poluindo a fila do
 * admin com estado que o dono da entidade nunca pediu.
 *
 * Mover para um módulo `server-only` sem `"use server"` remove os dois
 * endpoints da superfície pública sem mudar o comportamento de quem os chama
 * legitimamente. A autorização passa a ser responsabilidade de quem chama —
 * e é isso que o contrato abaixo exige.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRATO — LEIA ANTES DE CHAMAR
 *
 * Estas funções CONFIAM no id que recebem. Elas não autenticam, não conferem
 * posse e não têm como fazê-lo: não sabem quem é o autor da requisição.
 *
 * Quem chama precisa ter derivado o alvo de uma fonte confiável do SERVIDOR —
 * a sessão, no caso do profissional. Passar adiante um id vindo do cliente
 * reabre exatamente o buraco que mover estas funções fechou.
 */

import { revalidatePath } from "next/cache"

import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"
import {
  applyPartnerVerificationPending,
  createVerificationRequestRecord,
  findPendingVerificationRequest,
  hasApprovedVerificationRequest,
  isProfessionalVerified,
} from "../infrastructure/repository"
import type { VerificationEntityType } from "../domain/types"

/** Mesma forma usada por `actions.ts` — o tipo é local àquele arquivo. */
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: "already_verified" | "already_pending" }

/**
 * Admin mais antigo, usado só como autor nominal do registro de auditoria.
 * Veio junto de `actions.ts` porque a única chamada era a que migrou para cá —
 * deixá-lo para trás manteria uma função sem uso do outro lado.
 */
async function findSystemAdminId(): Promise<string | null> {
  const { prisma } = await import("@/lib/prisma/client")
  const admin = await prisma.adminProfile.findFirst({
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  })
  return admin?.userId ?? null
}

/**
 * Cria a VerificationRequest da entidade informada.
 *
 * PRÉ-CONDIÇÃO: `entityId` já foi resolvido pelo chamador a partir de contexto
 * confiável do servidor. Ver o contrato no cabeçalho.
 */
export async function requestVerification(input: {
  entityType: VerificationEntityType
  entityId: string
  notes?: string
}): Promise<ActionResult<{ requestId: string }>> {
  try {
    const request = await createVerificationRequestRecord(input)

    if (input.entityType === "PARTNER") {
      await applyPartnerVerificationPending(input.entityId)
    }

    // DÍVIDA REGISTRADA: `AdminAuditLog` só modela `adminId`, então uma
    // solicitação iniciada pelo próprio dono da entidade é gravada sob o admin
    // do sistema. O `source` abaixo é o que impede a leitura falsa de que um
    // administrador tomou a decisão — a linha registra que o MOTOR de
    // verificação criou a requisição, não que alguém a aprovou. Representar o
    // ator real exigiria schema, deliberadamente fora desta correção.
    const systemAdminId = await findSystemAdminId()
    if (systemAdminId) {
      await createAdminAudit({
        adminId: systemAdminId,
        action: "verification.requested",
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: {
          requestId: request.id,
          notes: input.notes ?? null,
          source: "verification_engine",
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

/**
 * Solicita verificação de um profissional, com as guardas de estado.
 *
 * PRÉ-CONDIÇÃO: `professionalId` derivado da sessão pelo chamador — hoje só
 * `requestMyProfessionalVerificationAction`, que resolve o perfil por
 * `userId` depois de `requireRole("PROFESSIONAL")`.
 *
 * IDEMPOTENTE: uma solicitação pendente já existente é REUTILIZADA em vez de
 * gerar outra. É o que impede um clique repetido de encher a fila do admin
 * com pedidos duplicados da mesma entidade.
 */
export async function requestProfessionalVerification(
  professionalId: string,
  notes?: string
): Promise<ActionResult<{ requestId: string }>> {
  if (await isProfessionalVerified(professionalId)) {
    return {
      ok: false,
      error: "Este perfil já está verificado.",
      code: "already_verified",
    }
  }

  if (await hasApprovedVerificationRequest("PROFESSIONAL", professionalId)) {
    return {
      ok: false,
      error: "Verificação suspensa ou encerrada — solicite reativação ao admin.",
      code: "already_verified",
    }
  }

  const existing = await findPendingVerificationRequest("PROFESSIONAL", professionalId)
  if (existing) {
    return { ok: true, data: { requestId: existing.id } }
  }

  return requestVerification({
    entityType: "PROFESSIONAL",
    entityId: professionalId,
    notes,
  })
}
