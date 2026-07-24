/**
 * Módulo: care-timeline — Care Timeline V0
 *
 * O profissional publica atualizações de cuidado durante um atendimento
 * IN_PROGRESS; o tutor visualiza. Apenas texto, sem mídia, sem impacto em
 * Trust/Ranking. Ver plano arquitetural aprovado (Fase 4).
 */

export {
  publishCareUpdateAction,
  getCareTimelineAction,
  editCareUpdateAction,
  deleteCareUpdateAction,
} from "./application/actions"

export { CareTimeline } from "./components/CareTimeline"
export { CareUpdateForm } from "./components/CareUpdateForm"

export {
  CARE_CATEGORY_LABELS,
  CARE_UPDATE_CATEGORIES,
  type CareUpdate,
  type CareUpdateCategory,
  type CreateCareUpdateInput,
} from "./domain/types"
