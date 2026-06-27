/**
 * módulo: trust-engine
 * camada: domain — labels de exibição
 *
 * Textos humanos para o TrustBreakdown visível ao profissional.
 * NÃO altera cálculo, pesos ou lógica do Trust Engine.
 * Apenas transforma os campos técnicos em linguagem de produto.
 */

import type { TrustLevel } from "@/modules/professional/domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// NÍVEIS DE CONFIANÇA — descrições completas para o painel profissional
// ─────────────────────────────────────────────────────────────────────────────

export type TrustLevelMeta = {
  label: string
  tagline: string
  description: string
  color: string       // Tailwind token para badge/anel
}

export const TRUST_LEVEL_META: Record<TrustLevel, TrustLevelMeta> = {
  INITIAL: {
    label:       "Novo",
    tagline:     "Construção em andamento",
    description: "Você está começando. Complete seu perfil, configure seus serviços e realize seus primeiros atendimentos para ganhar pontos de confiança.",
    color:       "text-neutral-500 bg-neutral-100",
  },
  BUILDING: {
    label:       "Confiável",
    tagline:     "Histórico em crescimento",
    description: "Seu histórico está crescendo. Continue atendendo com qualidade e construindo recorrência com seus clientes.",
    color:       "text-blue-700 bg-blue-100",
  },
  ESTABLISHED: {
    label:       "Verificado",
    tagline:     "Reputação estabelecida",
    description: "Você tem um histórico sólido. Focar em recorrência e recomendações de parceiros pode levá-lo ao próximo nível.",
    color:       "text-emerald-700 bg-emerald-100",
  },
  TRUSTED: {
    label:       "Destaque",
    tagline:     "Referência de confiança",
    description: "Tutores confiam em você de forma consistente. Mantenha a qualidade operacional e incentive avaliações reais.",
    color:       "text-green-700 bg-green-100",
  },
  ELITE: {
    label:       "Elite",
    tagline:     "Topo da confiança",
    description: "Você está entre os profissionais mais confiáveis do Peteen. Sua reputação é construída por histórico real e recorrência.",
    color:       "text-amber-700 bg-amber-100",
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// FATORES DO BREAKDOWN — label, descrição, dica de melhoria
// ─────────────────────────────────────────────────────────────────────────────

export type BreakdownFactorStatus = "positive" | "neutral" | "attention"

export type BreakdownFactorMeta = {
  label:      string
  description: string
  tip:        string
}

export const BREAKDOWN_FACTOR_META = {
  reviews: {
    label:       "Avaliações",
    description: "Avaliações recebidas de atendimentos concluídos na plataforma têm o maior peso individual no seu índice.",
    tip:         "Incentive tutores a avaliar após cada atendimento. Avaliações reais e espontâneas pesam mais.",
  },
  completions: {
    label:       "Conclusões",
    description: "Cada atendimento concluído dentro da plataforma contribui diretamente para o seu índice.",
    tip:         "Conclua todos os atendimentos aceitos pela plataforma. Evite cancelar após aceitar.",
  },
  recurrence: {
    label:       "Recorrência",
    description: "Clientes que voltam a contratar você são o sinal mais forte de confiança real. O bônus de recorrência cresce com cada sessão repetida.",
    tip:         "Foque na qualidade do atendimento. Recorrência não pode ser forçada — ela nasce da satisfação.",
  },
  identityVerified: {
    label:       "Verificação de identidade",
    description: "Dados verificados ajudam tutores a se sentirem seguros antes do primeiro contato. A verificação adiciona pontos fixos ao índice.",
    tip:         "Solicite a verificação de identidade nas configurações do perfil. É um processo simples com impacto direto.",
  },
  bonuses: {
    label:       "Recomendações e bônus",
    description: "Recomendações de parceiros da rede Peteen e conexões confiáveis fortalecem sua reputação contextual.",
    tip:         "Recomendações genuínas de parceiros credenciados têm peso significativo. Busque ser recomendado por parceiros oficiais.",
  },
  trustGraphBonus: {
    label:       "Rede de confiança",
    description: "Conexões ativas na rede Peteen — de parceiros, tutores e outros profissionais — fortalecem sua posição no ecossistema.",
    tip:         "Construa relações legítimas com tutores recorrentes e parceiros credenciados da plataforma.",
  },
  penalties: {
    label:       "Cancelamentos e ocorrências",
    description: "Cancelamentos após aceitar uma solicitação impactam negativamente a confiança operacional. Quanto mais tarde o cancelamento, maior o impacto.",
    tip:         "Aceite apenas solicitações que conseguirá atender. É melhor recusar do que cancelar após o aceite.",
  },
} as const satisfies Record<string, BreakdownFactorMeta>

export type BreakdownFactorKey = keyof typeof BREAKDOWN_FACTOR_META

// ─────────────────────────────────────────────────────────────────────────────
// COMO MELHORAR — lista educativa geral
// ─────────────────────────────────────────────────────────────────────────────

export const HOW_TO_IMPROVE_TIPS = [
  "Complete suas informações de perfil com dados verificáveis.",
  "Configure seus serviços com preços e descrições claras.",
  "Atenda solicitações até a conclusão — evite cancelamentos após aceite.",
  "Incentive tutores reais a avaliar após cada atendimento.",
  "Construa recorrência: a mesma pessoa voltando vale mais do que um novo cliente.",
  "Solicite verificação de identidade para ganhar pontos fixos imediatos.",
  "Evite aceitar solicitações que não conseguirá atender no horário combinado.",
] as const

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — derivar status de exibição a partir dos valores do breakdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determina o status visual de um fator positivo (reviews, completions, recurrence,
 * bonuses, identityVerified, trustGraphBonus).
 *
 * Regra: se o valor é > 0, está contribuindo positivamente → "positive".
 * Se = 0, ainda não foi conquistado → "neutral".
 */
export function positiveFactorStatus(value: number): BreakdownFactorStatus {
  return value > 0 ? "positive" : "neutral"
}

/**
 * Determina o status visual do fator de penalidades (acumula valores negativos).
 *
 * Regra: se penalties < 0, há impacto negativo → "attention".
 * Se = 0, sem ocorrências → "positive" (sinal de boa operação).
 */
export function penaltyFactorStatus(penalties: number): BreakdownFactorStatus {
  return penalties < 0 ? "attention" : "positive"
}
