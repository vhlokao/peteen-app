/**
 * módulo: relationship
 * camada: application
 *
 * updateRelationship — orquestra a atualização do vínculo tutor↔profissional.
 *
 * Chamado por:
 *   - createReviewAction → REVIEW_GIVEN
 *
 * NÃO é mais o caminho da conclusão de atendimento. Desde a introdução de
 * `completeServiceRequestAtomic`, o evento SERVICE_COMPLETED é aplicado
 * DENTRO da mesma transação da mudança de status, via
 * `applyRelationshipEvent(tx, ...)` — justamente para eliminar a janela em
 * que a request virava COMPLETED e o contador não subia.
 *
 * Falha silenciosa — NUNCA bloqueia o fluxo principal. Isso é aceitável para
 * REVIEW_GIVEN (a review em si já está gravada e é a fonte de verdade), e
 * qualquer resíduo é detectado e corrigido pela reconciliação
 * (scripts/reconcile-relationships.mjs).
 *
 * Nota sobre o Trust Engine: ele NÃO lê mais TutorProfessionalRelationship
 * para o bônus de recorrência. `completedServices` é histórico operacional
 * materializado (CRM, analytics, tiers de ranking); o Trust deriva as
 * conclusões ELEGÍVEIS diretamente de `ServiceRequest.completedAt` — ver
 * trust-engine/application/calculate-trust-score.ts. Portanto não existe mais
 * ordem obrigatória entre esta função e updateProfessionalTrust.
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
