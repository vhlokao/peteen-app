/**
 * módulo: badges
 * camada: domain
 *
 * Metadados de todos os badges e selos de verificação.
 * Sem lógica — apenas dados descritivos para exibição.
 */

import type { BadgeType, VerificationSeal, BadgeData, VerificationData } from "./types"

// ── Metadados dos badges ──────────────────────────────────────────────────────

export const BADGE_METADATA: Record<BadgeType, Omit<BadgeData, "type">> = {
  FIRST_CLIENT: {
    label:       "Primeiro Cliente",
    description: "Completou seu primeiro atendimento.",
    emoji:       "🌱",
  },
  RECURRING: {
    label:       "Recorrente",
    description: "Clientes retornam para novos atendimentos.",
    emoji:       "🔄",
  },
  TRUSTED: {
    label:       "Confiável",
    description: "Profissional com histórico positivo comprovado.",
    emoji:       "🛡️",
  },
  HIGHLY_RATED: {
    label:       "Muito Bem Avaliado",
    description: "Avaliações consistentemente positivas.",
    emoji:       "⭐",
  },
  EXPERT: {
    label:       "Especialista",
    description: "Ampla experiência comprovada em atendimentos.",
    emoji:       "🏆",
  },
  PARTNER_ENDORSED: {
    label:       "Recomendado por Parceiro",
    description: "Recomendado por um parceiro verificado da rede Peteen.",
    emoji:       "🤝",
  },
}

// ── Prioridade de exibição (maior prioridade = índice menor) ─────────────────
// Usado para determinar quais 2 badges mostrar no card da Discovery.

export const BADGE_DISPLAY_PRIORITY: BadgeType[] = [
  "PARTNER_ENDORSED",
  "TRUSTED",
  "HIGHLY_RATED",
  "RECURRING",
  "EXPERT",
  "FIRST_CLIENT",
]

// ── Metadados dos selos de verificação ───────────────────────────────────────

export const VERIFICATION_METADATA: Record<
  VerificationSeal,
  Omit<VerificationData, "type" | "active">
> = {
  VERIFIED_PROFILE: {
    label:       "Perfil Verificado",
    description: "Perfil revisado e aprovado pela equipe Peteen.",
    emoji:       "✓",
    activatable: true,
  },
  VERIFIED_IDENTITY: {
    label:       "Documento Verificado",
    description: "Identidade verificada via documento oficial.",
    emoji:       "🪪",
    activatable: false,
    internalOnly: true,
  },
  VERIFIED_PHONE: {
    label:       "Telefone Verificado",
    description: "Número de telefone confirmado.",
    emoji:       "📱",
    activatable: false,
  },
  VERIFIED_PARTNER: {
    label:       "Parceiro Verificado",
    description: "Parceiro certificado pela rede Peteen.",
    emoji:       "🤝",
    activatable: false,
  },
}
