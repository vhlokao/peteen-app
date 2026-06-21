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

export async function createDispute(input: CreateDisputeInput): Promise<DisputeData> {
  const dispute = await prisma.dispute.create({
    data: {
      requestId:   input.requestId,
      openedBy:    input.openedBy,
      reason:      input.reason,
      description: input.description ?? null,
      status:      "OPEN",
    },
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
