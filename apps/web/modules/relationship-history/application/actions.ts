/**
 * Módulo: relationship-history
 * Camada: application — ações de leitura com ownership
 */

import { notFound } from "next/navigation"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import {
  getProfessionalClientHistory,
  getTutorProfessionalHistory,
} from "../infrastructure/queries"
import type {
  ProfessionalClientHistory,
  TutorProfessionalHistory,
} from "../domain/types"
import { requireTutorContext } from "./require-tutor"

export async function getProfessionalClientHistoryAction(
  tutorId: string
): Promise<ProfessionalClientHistory> {
  const { profile } = await requireProfessionalContext()
  const history = await getProfessionalClientHistory(profile.id, tutorId)
  if (!history) notFound()
  return history
}

export async function getTutorProfessionalHistoryAction(
  professionalId: string
): Promise<TutorProfessionalHistory> {
  const { profile } = await requireTutorContext()
  const history = await getTutorProfessionalHistory(profile.id, professionalId)
  if (!history) notFound()
  return history
}
