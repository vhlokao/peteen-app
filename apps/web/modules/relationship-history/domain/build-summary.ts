/**
 * Módulo: relationship-history
 * Camada: domain — função pura
 *
 * Monta o RelationshipSummary exibido no card de CRM (visão do tutor sobre um
 * profissional e visão do profissional sobre um cliente).
 *
 * Regra central — de onde vem cada número:
 *
 *   completedServices  ← contador materializado do vínculo, com fallback para a
 *                        contagem derivada quando o vínculo ainda não existe.
 *   lastServiceAt      ← idem.
 *   relationshipLevel  ← contador materializado (NEW quando não há vínculo).
 *   totalRequests      ← SEMPRE derivado de ServiceRequest. Nunca do vínculo.
 *
 * Por que `totalRequests` é diferente dos outros:
 *   A coluna TutorProfessionalRelationship.totalRequests é legado. Só era
 *   incrementada na conclusão, então valia exatamente o mesmo que
 *   completedServices — e o card exibia o mesmo número sob dois rótulos
 *   ("Atendimentos concluídos" e "Total de solicitações"). Pior: em registros
 *   cuja contagem de conclusões foi corrigida depois, a coluna ficou MENOR que
 *   completedServices, produzindo "4 concluídos / 3 solicitações".
 *
 *   O valor derivado conta TODAS as solicitações do par, sem filtro de status
 *   (pendentes, aceitas, em andamento, concluídas, canceladas, disputadas e
 *   expiradas). É o volume operacional real, e o denominador natural de uma
 *   taxa de sucesso. Por isso ele sempre vence, mesmo quando existe vínculo.
 *
 * Zero dependências de banco — testável isoladamente.
 */

// Import relativo com extensão explícita: mantém o arquivo executável pelo
// runner nativo (`node --experimental-strip-types --test`), que não resolve o
// alias "@/". Mesmo padrão de relationship/domain/relationship-levels.ts.
import {
  ANALYTICS_THRESHOLDS,
  RELATIONSHIP_LEVEL_LABELS,
} from "../../relationship/domain/constants.ts"
import type { RelationshipLevel } from "@/modules/relationship/domain/types"
import type { RelationshipSummary } from "./types"

/** Campos do vínculo materializado que ainda são fonte de verdade. */
export type RelationshipSummarySource = {
  completedServices: number
  lastServiceAt: Date | null
  relationshipLevel: RelationshipLevel
}

/** Contagens derivadas de ServiceRequest para o par. */
export type RelationshipSummaryDerived = {
  completedServices: number
  /** Todas as solicitações do par, sem filtro de status. Fonte de verdade. */
  totalRequests: number
  lastServiceAt: Date | null
}

export function buildRelationshipSummary(
  relationship: RelationshipSummarySource | null,
  derived: RelationshipSummaryDerived
): RelationshipSummary {
  const completedServices =
    relationship?.completedServices ?? derived.completedServices
  // Sempre derivado — ver nota no topo.
  const totalRequests = derived.totalRequests
  const lastServiceAt = relationship?.lastServiceAt ?? derived.lastServiceAt
  const level = (relationship?.relationshipLevel ?? "NEW") as RelationshipLevel

  return {
    completedServices,
    totalRequests,
    lastServiceAt,
    relationshipLevel: level,
    relationshipLevelLabel: RELATIONSHIP_LEVEL_LABELS[level] ?? level,
    isRecurring: completedServices >= ANALYTICS_THRESHOLDS.RECURRING,
  }
}
