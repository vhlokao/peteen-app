/**
 * Módulo: care-timeline — Care Timeline V0
 *
 * O profissional publica atualizações de cuidado durante um atendimento
 * IN_PROGRESS; o tutor visualiza. Texto obrigatório, com até 3 fotos por
 * atualização (R2B.4). Sem impacto em Trust/Ranking. Ver plano arquitetural
 * aprovado (Fase 4).
 */

export {
  publishCareUpdateAction,
  getCareTimelineAction,
  editCareUpdateAction,
  deleteCareUpdateAction,
} from "./application/actions"

export { CareTimeline } from "./components/CareTimeline"
export { CareMoments } from "./components/CareMoments"
export { CareTimelineSummary } from "./components/CareTimelineSummary"
export { CareTimelineAutoRefresh } from "./components/CareTimelineAutoRefresh"
export { CareUpdateForm } from "./components/CareUpdateForm"

export {
  CARE_CATEGORY_LABELS,
  CARE_UPDATE_CATEGORIES,
  type CareUpdate,
  type CareUpdateCategory,
  type CreateCareUpdateInput,
} from "./domain/types"
