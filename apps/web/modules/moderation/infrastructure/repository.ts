/**
 * módulo: moderation
 * camada: infrastructure
 *
 * Persistência de Flags Operacionais, Disputas e AdminAuditLog.
 *
 * Regras:
 *   - Flags e AuditLogs são append-only — nunca deletar
 *   - Disputas só mudam de status — histórico preservado
 *   - Sem lógica de negócio — apenas I/O
 */

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma/client"
import { applyRelationshipEvent } from "@/modules/relationship/infrastructure/repository"
import type {
  OperationalFlagData,
  DisputeData,
  AdminAuditLogData,
  CreateFlagInput,
  CreateDisputeInput,
  CreateAdminAuditInput,
  FlagStatus,
  DisputeStatus,
} from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL FLAGS
// ─────────────────────────────────────────────────────────────────────────────

export async function createFlag(input: CreateFlagInput): Promise<OperationalFlagData> {
  const flag = await prisma.operationalFlag.create({
    data: {
      targetType: input.targetType,
      targetId:   input.targetId,
      reason:     input.reason,
      severity:   input.severity ?? "LOW",
      source:     input.source   ?? "SYSTEM",
      status:     "OPEN",
    },
  })
  return flag as OperationalFlagData
}

export async function resolveFlagRecord(
  flagId:     string,
  status:     FlagStatus,
  resolvedBy: string
): Promise<void> {
  await prisma.operationalFlag.update({
    where: { id: flagId },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedBy,
    },
  })
}

export async function countTodayFlags(targetId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.operationalFlag.count({
    where: {
      targetId,
      createdAt: { gte: today },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma disputa e mantém `TutorProfessionalRelationship.disputedServices`
 * consistente, na MESMA transação.
 *
 * ── Por que a lógica vive AQUI e não na action ─────────────────────────────
 * Existem DOIS caminhos de criação de disputa: `createDisputeForRequestAction`
 * (fluxo do tutor, com guard de disputa ativa) e `createDisputeAction`
 * (moderação, sem guard nenhum). Colocar o contador só numa das actions
 * deixaria a outra furando o invariante. Esta função é o único ponto por onde
 * as duas passam.
 *
 * ── Contrato do contador ──────────────────────────────────────────────────
 * `disputedServices` = número de ServiceRequest DISTINTAS do par que têm ao
 * menos uma disputa — não o número de linhas em `Dispute`. Por isso o
 * incremento acontece apenas na transição 0 → 1ª disputa daquela request.
 *
 * Isso importa porque uma request PODE acumular várias disputas: não há unique
 * em `Dispute.requestId` (só `@@index`), e o guard do fluxo do tutor bloqueia
 * apenas disputas ATIVAS (`OPEN`/`UNDER_REVIEW`) — uma disputa `RESOLVED` ou
 * `REJECTED` não impede abrir outra. Contar linhas inflaria o número de
 * serviços disputados.
 *
 * ── Por que o advisory lock ───────────────────────────────────────────────
 * A checagem "já existia disputa para esta request?" seguida da criação é um
 * check-then-write. Sem serialização, duas criações simultâneas para a mesma
 * request leriam 0 e ambas incrementariam. O lock é por PAR
 * (tutor+profissional), transaction-scoped — liberado no commit e no rollback,
 * seguro sob o pgBouncer em transaction pooling. Mesmo padrão já aprovado em
 * `lockProfessionalAgenda`.
 *
 * Disputas de requests diferentes do mesmo par serializam entre si, mas cada
 * uma vê corretamente `0` para a sua própria request e incrementa — o
 * resultado final é o número certo de requests distintas disputadas.
 */
export async function createDispute(input: CreateDisputeInput): Promise<DisputeData> {
  const dispute = await prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUniqueOrThrow({
      where:  { id: input.requestId },
      select: { tutorId: true, professionalId: true },
    })

    // Serializa a criação de disputas deste par. Chave parametrizada, nunca
    // concatenada em SQL bruto.
    const chaveDoPar = `${request.tutorId}:${request.professionalId}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chaveDoPar}, 0))`

    // Esta request já tinha disputa antes desta? Só a PRIMEIRA conta.
    const disputasAnteriores = await tx.dispute.count({
      where: { requestId: input.requestId },
    })

    const created = await tx.dispute.create({
      data: {
        requestId:   input.requestId,
        openedBy:    input.openedBy,
        reason:      input.reason,
        description: input.description ?? null,
        status:      "OPEN",
      },
    })

    if (disputasAnteriores === 0) {
      // `applyRelationshipEvent` incrementa `disputedServices` e recalcula
      // score/level a partir do estado já incrementado. Se falhar, a disputa
      // inteira é revertida — nada de best-effort pós-commit.
      await applyRelationshipEvent(tx, request.tutorId, request.professionalId, {
        type: "DISPUTE",
      })
    }

    return created
  })

  return dispute as DisputeData
}

export async function updateDisputeStatus(
  disputeId:  string,
  status:     DisputeStatus,
  resolvedBy: string
): Promise<void> {
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      resolvedAt: ["RESOLVED", "REJECTED"].includes(status) ? new Date() : null,
      resolvedBy: ["RESOLVED", "REJECTED"].includes(status) ? resolvedBy : null,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

export async function createAdminAudit(
  input: CreateAdminAuditInput
): Promise<AdminAuditLogData> {
  const log = await prisma.adminAuditLog.create({
    data: {
      adminId:    input.adminId,
      action:     input.action,
      entityType: input.entityType,
      entityId:   input.entityId,
      metadata:   input.metadata !== undefined
        ? (input.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  })
  return {
    ...log,
    metadata: (log.metadata as Record<string, unknown>) ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────────

export async function countTodayServiceRequests(tutorId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.serviceRequest.count({
    where: {
      tutorId,
      createdAt: { gte: today },
    },
  })
}

export async function countTodayReviews(tutorId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.review.count({
    where: {
      tutorId,
      createdAt: { gte: today },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW MODERATION
// ─────────────────────────────────────────────────────────────────────────────

export async function hideReview(
  reviewId:   string,
  reason:     string
): Promise<void> {
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVisible:     false,
      hiddenByAdmin: true,
      hiddenAt:      new Date(),
      hiddenReason:  reason,
    },
  })
}

export async function restoreReview(reviewId: string): Promise<void> {
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      isVisible:     true,
      hiddenByAdmin: false,
      hiddenAt:      null,
      hiddenReason:  null,
    },
  })
}
