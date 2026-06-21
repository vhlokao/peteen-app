/**
 * módulo: relationship
 * camada: application
 *
 * updateRelationship — orquestra a atualização do vínculo tutor↔profissional.
 *
 * Chamado após:
 *   - completeServiceRequestAction → SERVICE_COMPLETED
 *   - createReviewAction           → REVIEW_GIVEN
 *
 * Falha silenciosa — NUNCA bloqueia o fluxo principal.
 * O vínculo de relacionamento é importante, mas não crítico para o caminho feliz.
 *
 * Deve ser chamado ANTES de updateProfessionalTrust, pois o Trust Engine
 * agora consome os dados de TutorProfessionalRelationship para o bônus de recorrência.
 */

import type { RelationshipEvent } from "../domain/types"
import { upsertRelationship } from "../infrastructure/repository"

export async function updateRelationship(
  tutorId:        string,
  professionalId: string,
  event:          RelationshipEvent
): Promise<void> {
  try {
    await upsertRelationship(tutorId, professionalId, event)
  } catch (err) {
    // Silencioso — um erro aqui não deve falhar o atendimento nem a review
    console.error("[updateRelationship]", {
      tutorId,
      professionalId,
      eventType: event.type,
      err,
    })
  }
}
