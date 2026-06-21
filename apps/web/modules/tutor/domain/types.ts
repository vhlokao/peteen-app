/**

 * Módulo: tutor

 * Camada: domain

 *

 * Tipos de tutor + reexportações do módulo pets (Etapa 6.3).

 */



import { z } from "zod"



// Reexportações pets — compatibilidade com imports existentes

export {

  SPECIES,

  SPECIES_LABELS,

  SPECIES_EMOJI,

  PET_GENDERS,

  PET_GENDER_LABELS,

  PET_SIZES,

  PET_SIZE_LABELS,

  CreatePetSchema,

  UpdatePetSchema,

  type Species,

  type PetGender,

  type PetSize,

  type CreatePetInput,

  type UpdatePetInput,

  type PetData,

  type PetContextSnapshot,

  type PetSummary,

} from "@/modules/pets/domain/types"



// ─────────────────────────────────────────────────────────────────────────────

// SCHEMAS — TutorProfile

// ─────────────────────────────────────────────────────────────────────────────



export const CreateTutorProfileSchema = z.object({

  displayName: z

    .string()

    .min(2, "Nome deve ter ao menos 2 caracteres")

    .max(100, "Nome muito longo"),

  bio: z.string().max(500, "Bio pode ter no máximo 500 caracteres").optional(),

  phone: z

    .string()

    .regex(/^\+?[\d\s\-()]{8,20}$/, "Telefone inválido")

    .optional()

    .or(z.literal("")),

  neighborhood: z.string().max(100).optional(),

  city: z.string().min(2, "Cidade é obrigatória").max(100),

  state: z

    .string()

    .length(2, "Use a sigla do estado (ex: SP)")

    .toUpperCase(),

  lat: z.number().min(-90).max(90).optional(),

  lng: z.number().min(-180).max(180).optional(),

})



export type CreateTutorProfileInput = z.infer<typeof CreateTutorProfileSchema>



export const UpdateTutorProfileSchema = CreateTutorProfileSchema.partial()

export type UpdateTutorProfileInput = z.infer<typeof UpdateTutorProfileSchema>



// ─────────────────────────────────────────────────────────────────────────────

// TIPOS — TutorProfile

// ─────────────────────────────────────────────────────────────────────────────



export type TutorProfileData = {

  id: string

  userId: string

  displayName: string

  avatarUrl: string | null

  bio: string | null

  phone: string | null

  neighborhood: string | null

  neighborhoodId: string | null

  regionId: string | null

  city: string

  state: string

  lat: number | null

  lng: number | null

  createdAt: Date

  updatedAt: Date

  deletedAt: Date | null

}



export type ActionResult<T = void> =

  | { success: true; data: T }

  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

