/**
 * módulo: partners
 * camada: domain — constantes
 */

import type { PartnerCategory, PartnerOnboardingStatus, PartnerVerificationStatus } from "./types"

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  PET_SHOP:           "Pet Shop",
  VETERINARY_CLINIC:  "Clínica Veterinária",
  PET_HOTEL:          "Hotel Pet",
  DAYCARE:            "Creche / Daycare",
  TRAINING_CENTER:    "Centro de Adestramento",
  NGO:                "ONG",
  OTHER:              "Outro",
}

export const PARTNER_CATEGORIES: PartnerCategory[] = [
  "PET_SHOP",
  "VETERINARY_CLINIC",
  "PET_HOTEL",
  "DAYCARE",
  "TRAINING_CENTER",
  "NGO",
  "OTHER",
]

export const PARTNER_ONBOARDING_STATUS_LABELS: Record<PartnerOnboardingStatus, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  COMPLETED:   "Concluído",
}

export const PARTNER_VERIFICATION_STATUS_LABELS: Record<PartnerVerificationStatus, string> = {
  NONE:                  "—",
  PENDING_VERIFICATION:  "Verificação pendente",
  VERIFIED:              "Verificado",
}
