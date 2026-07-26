/**
 * Módulo: service-request
 * Camada: infrastructure — auditoria via AuditLog
 *
 * Mesmo padrão de modules/disputes/infrastructure/audit.ts: fire-and-forget,
 * nunca propaga erro — auditoria nunca deve quebrar o fluxo principal.
 */

import { prisma } from "@/lib/prisma/client"

export async function recordRequestAudit(
  userId: string,
  action: string,
  requestId: string,
  before: { status: string },
  after: { status: string }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "ServiceRequest",
        entityId: requestId,
        before,
        after,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}

/**
 * Horário real do aceite (PENDING → ACCEPTED), a partir do AuditLog.
 *
 * Por quê não usar ServiceRequest.updatedAt: esse campo é sobrescrito por
 * QUALQUER transição posterior (início, conclusão, etc.), então deixa de
 * representar o momento do aceite assim que a request avança de estado.
 * AuditLog.createdAt não tem `@updatedAt` — é gravado uma vez, no instante
 * do evento, e nunca mais muda.
 *
 * A state machine hoje só permite um evento "request.accepted" por
 * ServiceRequest — PENDING é o único estado do qual se chega a ACCEPTED, e
 * não existe transição de volta a PENDING (ver VALID_TRANSITIONS em
 * domain/types.ts). Mesmo assim, a query usa `orderBy` explícito (createdAt
 * asc, id asc como desempate) em vez de depender dessa garantia
 * silenciosamente: fixtures manuais, dados históricos inconsistentes ou uma
 * duplicidade futura não podem tornar o resultado ambíguo.
 *
 * Retorna null quando não há esse AuditLog — request histórica anterior à
 * introdução da auditoria de lifecycle, ou nunca aceita. Não é uma falha:
 * o chamador deve cair para o fallback (updatedAt + "(aprox.)"), nunca
 * inventar um horário.
 */
export async function findRequestAcceptedAt(requestId: string): Promise<Date | null> {
  const log = await prisma.auditLog.findFirst({
    where: {
      entity: "ServiceRequest",
      entityId: requestId,
      action: "request.accepted",
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true },
  })
  return log?.createdAt ?? null
}
