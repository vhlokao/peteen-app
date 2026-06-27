/**
 * Módulo: disputes
 * Camada: infrastructure — consultas de disputas
 */

import { prisma } from "@/lib/prisma/client"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import type { AdminDisputeListRow, DisputeSummary } from "../domain/types"
import { toDisputeSummary } from "./audit"

export async function findDisputeByRequestId(
  requestId: string
): Promise<DisputeSummary | null> {
  const row = await prisma.dispute.findFirst({
    where: { requestId },
    orderBy: { createdAt: "desc" },
  })
  return row ? toDisputeSummary(row) : null
}

export async function findActiveDisputeByRequestId(
  requestId: string
): Promise<DisputeSummary | null> {
  const row = await prisma.dispute.findFirst({
    where: {
      requestId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
  })
  return row ? toDisputeSummary(row) : null
}

export async function findDisputeById(id: string): Promise<DisputeSummary | null> {
  const row = await prisma.dispute.findUnique({ where: { id } })
  return row ? toDisputeSummary(row) : null
}

export async function findDisputeForProfessionalRequest(
  requestId: string,
  professionalId: string
): Promise<DisputeSummary | null> {
  const row = await prisma.dispute.findFirst({
    where: {
      requestId,
      request: { professionalId },
    },
    orderBy: { createdAt: "desc" },
  })
  return row ? toDisputeSummary(row) : null
}

export async function listDisputesForAdmin(filter?: {
  status?: string
}): Promise<AdminDisputeListRow[]> {
  const rows = await prisma.dispute.findMany({
    where: filter?.status ? { status: filter.status as never } : undefined,
    include: {
      request: {
        select: {
          serviceType: true,
          tutor: { select: { displayName: true } },
          professional: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  return rows.map((d) => ({
    ...toDisputeSummary(d),
    tutorName: d.request.tutor.displayName,
    professionalName: d.request.professional.displayName,
    serviceLabel:
      SERVICE_TYPE_LABELS[d.request.serviceType as ServiceType] ??
      d.request.serviceType,
  }))
}
