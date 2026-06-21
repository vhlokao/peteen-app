/**
 * módulo: relationship
 * camada: domain — constantes
 *
 * Todos os parâmetros do Relationship Engine estão aqui.
 * Alterar qualquer valor aqui afeta scores, níveis, badges e analytics.
 * Nada hardcoded fora deste arquivo.
 */

import type { RelationshipLevel } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// NÍVEIS — thresholds baseados em completedServices
//
// Filosofia: o nível reflete a profundidade do vínculo, não a satisfação.
// Um tutor que voltou 10 vezes é parceiro, independente da nota média.
// ─────────────────────────────────────────────────────────────────────────────

export const RELATIONSHIP_LEVEL_THRESHOLDS: Record<RelationshipLevel, number> = {
  NEW:       1,   // primeiro atendimento concluído
  KNOWN:     2,   // segundo atendimento — já se conhecem
  RECURRING: 3,   // terceiro+ — padrão de retorno estabelecido
  TRUSTED:   5,   // quinto+ — confiança consolidada
  PARTNER:   10,  // décimo+ — parceria de longo prazo
}

export const RELATIONSHIP_LEVEL_LABELS: Record<RelationshipLevel, string> = {
  NEW:       "Novo",
  KNOWN:     "Conhecido",
  RECURRING: "Recorrente",
  TRUSTED:   "Confiável",
  PARTNER:   "Parceiro",
}

export const RELATIONSHIP_LEVEL_ICONS: Record<RelationshipLevel, string> = {
  NEW:       "👋",
  KNOWN:     "🤝",
  RECURRING: "🔄",
  TRUSTED:   "💙",
  PARTNER:   "⭐",
}

// Ordem decrescente de nível — usada em lógicas de resolução
export const RELATIONSHIP_LEVEL_ORDER: RelationshipLevel[] = [
  "PARTNER",
  "TRUSTED",
  "RECURRING",
  "KNOWN",
  "NEW",
]

// ─────────────────────────────────────────────────────────────────────────────
// SCORE — pesos para cálculo do relationshipScore
//
// O score é interno ao relacionamento.
// Mínimo: 0 (um relacionamento existe ou não existe, nunca é negativo)
// ─────────────────────────────────────────────────────────────────────────────

export const RELATIONSHIP_SCORE_WEIGHTS = {
  SERVICE_COMPLETED:     2.0,   // +2.0 por atendimento concluído — peso principal
  REVIEW_GIVEN:          0.5,   // +0.5 por review — engajamento ativo
  CANCELLATION_BY_TUTOR: -0.5,  // -0.5 por cancelamento do tutor — sinal de inconsistência
  CANCELLATION_BY_PRO:   -1.0,  // -1.0 por cancelamento do profissional — quebra de compromisso
  DISPUTE:               -3.0,  // -3.0 por disputa — sinal grave de problema
} as const

// ─────────────────────────────────────────────────────────────────────────────
// THRESHOLDS DE ANALYTICS — usados em queries e filtros de UI
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_THRESHOLDS = {
  RECURRING: 3,   // completedServices >= 3 → "cliente recorrente"
  TRUSTED:   5,   // completedServices >= 5 → "relação confiável"
  PARTNER:   10,  // completedServices >= 10 → "parceiro recorrente"
} as const

// ─────────────────────────────────────────────────────────────────────────────
// BADGES — estrutura para uso no perfil (implementação futura de persistência)
//
// Os badges são determinísticos a partir de completedServices.
// Não precisam de tabela própria — são calculados on-the-fly.
// Fase 6: persistir badges ganhos para exibição em destaque no perfil.
// ─────────────────────────────────────────────────────────────────────────────

export const RELATIONSHIP_BADGES = {
  FIRST_CLIENT: {
    id:          "FIRST_CLIENT",
    label:       "Primeiro Cliente",
    description: "Primeira vez contratando este profissional",
    icon:        "👋",
    minServices: 1,
    maxServices: 1, // badge único — não persiste além do 1º atendimento
  },
  RECURRING_CLIENT: {
    id:          "RECURRING_CLIENT",
    label:       "Cliente Recorrente",
    description: "Já contratou 3 ou mais vezes",
    icon:        "🔄",
    minServices: 3,
    maxServices: null,
  },
  TRUSTED_TUTOR: {
    id:          "TRUSTED_TUTOR",
    label:       "Tutor Confiável",
    description: "Relacionamento consolidado com 5+ atendimentos",
    icon:        "💙",
    minServices: 5,
    maxServices: null,
  },
  TRUSTED_PARTNER: {
    id:          "TRUSTED_PARTNER",
    label:       "Parceiro de Confiança",
    description: "Parceria de longo prazo com 10+ atendimentos",
    icon:        "⭐",
    minServices: 10,
    maxServices: null,
  },
} as const

export type RelationshipBadgeId = keyof typeof RELATIONSHIP_BADGES
export type RelationshipBadge = (typeof RELATIONSHIP_BADGES)[RelationshipBadgeId]
