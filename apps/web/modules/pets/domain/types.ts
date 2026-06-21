/**
 * Módulo: pets
 * Camada: domain — Etapa 6.3 Pet Management Foundation
 *
 * Tipos e schemas puros — sem dependência de Prisma ou Next.js.
 */

import { z } from "zod"

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const SPECIES = ["DOG", "CAT", "BIRD", "RODENT", "OTHER"] as const
export type Species = (typeof SPECIES)[number]

export const SPECIES_LABELS: Record<Species, string> = {
  DOG: "Cachorro",
  CAT: "Gato",
  BIRD: "Pássaro",
  RODENT: "Roedor",
  OTHER: "Outro",
}

export const SPECIES_EMOJI: Record<Species, string> = {
  DOG: "🐶",
  CAT: "🐱",
  BIRD: "🐦",
  RODENT: "🐹",
  OTHER: "🐾",
}

export const PET_GENDERS = ["MALE", "FEMALE", "UNKNOWN"] as const
export type PetGender = (typeof PET_GENDERS)[number]

export const PET_GENDER_LABELS: Record<PetGender, string> = {
  MALE: "Macho",
  FEMALE: "Fêmea",
  UNKNOWN: "Não informado",
}

export const PET_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const
export type PetSize = (typeof PET_SIZES)[number]

export const PET_SIZE_LABELS: Record<PetSize, string> = {
  SMALL: "Pequeno",
  MEDIUM: "Médio",
  LARGE: "Grande",
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const CreatePetSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do pet é obrigatório")
    .max(100, "Nome muito longo"),
  species: z.enum(SPECIES, { error: () => "Selecione uma espécie válida" }),
  breed: z.string().max(100, "Raça muito longa").optional(),
  gender: z.enum(PET_GENDERS).optional(),
  birthDate: z.coerce.date().optional(),
  weight: z
    .number()
    .positive("Peso deve ser positivo")
    .max(200, "Peso inválido")
    .optional(),
  size: z.enum(PET_SIZES).optional(),
  description: z
    .string()
    .max(1000, "Descrição pode ter no máximo 1000 caracteres")
    .optional(),
  avatarUrl: z
    .string()
    .url("URL de imagem inválida")
    .optional()
    .or(z.literal("")),
  // Legado — mantido para onboarding e reviews
  notes: z.string().max(1000).optional(),
  isNeutered: z.boolean().optional(),
  hasSpecialNeeds: z.boolean().default(false),
})

export type CreatePetInput = z.infer<typeof CreatePetSchema>

export const UpdatePetSchema = CreatePetSchema.partial()
export type UpdatePetInput = z.infer<typeof UpdatePetSchema>

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

export type PetData = {
  id: string
  tutorId: string
  name: string
  species: Species
  breed: string | null
  gender: PetGender | null
  birthDate: Date | null
  weight: number | null
  size: PetSize | null
  avatarUrl: string | null
  description: string | null
  notes: string | null
  isNeutered: boolean | null
  hasSpecialNeeds: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/** Snapshot imutável para contexto reputacional (reviews). */
export type PetContextSnapshot = {
  name: string
  species: Species
  breed: string | null
  hasSpecialNeeds: boolean
  notes: string | null
  weightKg: number | null
}

/** Resumo para listagens e dashboard. */
export type PetSummary = Pick<
  PetData,
  "id" | "name" | "species" | "breed" | "avatarUrl" | "isActive" | "createdAt"
>
