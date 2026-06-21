"use server"

/**
 * módulo: relationship
 * camada: application (Server Actions)
 *
 * Ações públicas do módulo de relacionamento.
 *
 * getRelationshipAnalyticsAction     — métricas públicas do profissional (sem auth)
 * getMyRelationshipWithProfessional  — vínculo pessoal do tutor autenticado
 */

import { getAuthContext } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import {
  findRelationship,
  getRelationshipAnalytics,
} from "../infrastructure/repository"
import type {
  TutorProfessionalRelationshipData,
  RelationshipAnalytics,
  RelationshipActionResult,
} from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// getRelationshipAnalyticsAction
//
// Métricas públicas de recorrência de um profissional.
// Não requer autenticação — exibidas no perfil público.
// ─────────────────────────────────────────────────────────────────────────────

export async function getRelationshipAnalyticsAction(
  professionalId: string
): Promise<RelationshipActionResult<RelationshipAnalytics>> {
  try {
    const analytics = await getRelationshipAnalytics(professionalId)
    return { success: true, data: analytics }
  } catch (err) {
    console.error("[getRelationshipAnalyticsAction]", err)
    return { success: false, error: "Erro ao buscar analytics de relacionamento." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMyRelationshipWithProfessional
//
// Retorna o relacionamento do tutor autenticado com um profissional específico.
// Retorna null se não houver relacionamento ou o usuário não for um tutor.
//
// Uso:
//   - Perfil público → "Você já contratou X vezes"
//   - Detalhe do request → histórico do vínculo
// ─────────────────────────────────────────────────────────────────────────────

export async function getMyRelationshipWithProfessional(
  professionalId: string
): Promise<TutorProfessionalRelationshipData | null> {
  try {
    const ctx = await getAuthContext()
    if (!ctx.authenticated) return null
    if (ctx.user.primaryRole !== "TUTOR") return null

    const tutorProfile = await findTutorProfileByUserId(ctx.user.id)
    if (!tutorProfile) return null

    return findRelationship(tutorProfile.id, professionalId)
  } catch {
    return null
  }
}
