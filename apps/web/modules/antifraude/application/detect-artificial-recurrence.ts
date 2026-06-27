/**
 * módulo: antifraude
 * camada: application
 *
 * Detector passivo de recorrência artificial.
 *
 * Não bloqueia o fluxo do usuário.
 * Deve ser chamado com `.catch(() => null)` — falhas são silenciosas.
 *
 * Regra MVP:
 *   Se um par tutor-profissional tiver mais de THRESHOLD conclusões
 *   nos últimos WINDOW_DAYS dias, cria um FraudSignal de ARTIFICIAL_RECURRENCE.
 *
 * Deduplicação:
 *   Não cria sinal duplicado se já existe um OPEN ou INVESTIGATING
 *   para o mesmo profissional nos últimos DEDUP_WINDOW_HOURS.
 */

import { prisma } from "@/lib/prisma/client"
import { ANTIFRAUD_GUARDRAILS } from "../domain/constants"

export async function detectArtificialRecurrence(
  tutorId: string,
  professionalId: string,
  professionalUserId: string
): Promise<void> {
  const windowStart = new Date(
    Date.now() -
      ANTIFRAUD_GUARDRAILS.ARTIFICIAL_RECURRENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )

  const completionsInWindow = await prisma.serviceRequest.count({
    where: {
      tutorId,
      professionalId,
      status: "COMPLETED",
      completedAt: { gte: windowStart },
    },
  })

  if (completionsInWindow <= ANTIFRAUD_GUARDRAILS.ARTIFICIAL_RECURRENCE_COMPLETION_THRESHOLD) {
    return
  }

  // Deduplicação: evita flood de sinais idênticos para o mesmo profissional
  const dedupWindow = new Date(
    Date.now() -
      ANTIFRAUD_GUARDRAILS.FRAUD_SIGNAL_DEDUP_WINDOW_HOURS * 60 * 60 * 1000
  )

  const existingSignal = await prisma.fraudSignal.findFirst({
    where: {
      targetUserId: professionalUserId,
      signalType:   "ARTIFICIAL_RECURRENCE",
      status:       { in: ["OPEN", "INVESTIGATING"] },
      createdAt:    { gte: dedupWindow },
    },
    select: { id: true },
  })

  if (existingSignal) {
    return
  }

  // Busca dados adicionais para enriquecer o evidence
  const relationship = await prisma.tutorProfessionalRelationship.findUnique({
    where: { tutorId_professionalId: { tutorId, professionalId } },
    select: { firstServiceAt: true, lastServiceAt: true, completedServices: true },
  })

  await prisma.fraudSignal.create({
    data: {
      targetUserId: professionalUserId,
      signalType:   "ARTIFICIAL_RECURRENCE",
      severity:     "MEDIUM",
      description:  `Par tutor-profissional com ${completionsInWindow} conclusões nos últimos ${ANTIFRAUD_GUARDRAILS.ARTIFICIAL_RECURRENCE_WINDOW_DAYS} dias.`,
      evidence: {
        reason:                    "ARTIFICIAL_RECURRENCE_VELOCITY",
        completedServicesInWindow: completionsInWindow,
        windowDays:                ANTIFRAUD_GUARDRAILS.ARTIFICIAL_RECURRENCE_WINDOW_DAYS,
        threshold:                 ANTIFRAUD_GUARDRAILS.ARTIFICIAL_RECURRENCE_COMPLETION_THRESHOLD,
        tutorProfileId:            tutorId,
        professionalProfileId:     professionalId,
        firstCompletedAt:          relationship?.firstServiceAt?.toISOString() ?? null,
        lastCompletedAt:           relationship?.lastServiceAt?.toISOString() ?? null,
        totalCompletedAllTime:     relationship?.completedServices ?? null,
      },
    },
  })
}
