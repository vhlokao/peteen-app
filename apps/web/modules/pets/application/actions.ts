"use server"

/**
 * Módulo: pets
 * Camada: application — Server Actions (Etapa 6.3)
 */

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import type { ActionResult } from "@/modules/tutor/domain/types"
import {
  CreatePetSchema,
  UpdatePetSchema,
  type CreatePetInput,
  type UpdatePetInput,
  type PetData,
  type PetSummary,
} from "../domain/types"
import { recordPetAudit } from "../infrastructure/audit"
import {
  archivePetRecord,
  countActivePetsByTutorId,
  createPetRecord,
  findActivePetsByTutorId,
  findPetByIdAndTutorId,
  findRecentPetsByTutorId,
  updatePetRecord,
} from "../infrastructure/repository"

const PET_PATHS = ["/me/pets", "/tutor", "/tutor/pets", "/discover"] as const

function revalidatePetPaths() {
  for (const path of PET_PATHS) {
    revalidatePath(path)
  }
}

async function requireTutorProfile(userId: string) {
  return findTutorProfileByUserId(userId)
}

export async function createPetAction(
  input: CreatePetInput
): Promise<ActionResult<PetData>> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return {
        success: false,
        error: "Complete o perfil de tutor antes de adicionar pets.",
      }
    }

    const parsed = CreatePetSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const pet = await createPetRecord(tutorProfile.id, parsed.data)
    await recordPetAudit(session.id, "pet.created", pet)

    revalidatePetPaths()
    return { success: true, data: pet }
  } catch (err) {
    console.error("[createPetAction]", err)
    return { success: false, error: "Erro interno ao adicionar pet." }
  }
}

export async function updatePetAction(
  petId: string,
  input: UpdatePetInput
): Promise<ActionResult<PetData>> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return { success: false, error: "Perfil de tutor não encontrado." }
    }

    const existing = await findPetByIdAndTutorId(petId, tutorProfile.id)
    if (!existing) {
      return { success: false, error: "Pet não encontrado ou acesso negado." }
    }

    const parsed = UpdatePetSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const updated = await updatePetRecord(petId, tutorProfile.id, parsed.data)
    await recordPetAudit(session.id, "pet.updated", updated, existing)

    revalidatePetPaths()
    return { success: true, data: updated }
  } catch (err) {
    console.error("[updatePetAction]", err)
    return { success: false, error: "Erro interno ao atualizar pet." }
  }
}

export async function archivePetAction(petId: string): Promise<ActionResult> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return { success: false, error: "Perfil de tutor não encontrado." }
    }

    const existing = await findPetByIdAndTutorId(petId, tutorProfile.id)
    if (!existing) {
      return { success: false, error: "Pet não encontrado ou acesso negado." }
    }

    const archived = await archivePetRecord(petId, tutorProfile.id)
    await recordPetAudit(session.id, "pet.archived", archived, existing)

    revalidatePetPaths()
    return { success: true, data: undefined }
  } catch (err) {
    console.error("[archivePetAction]", err)
    return { success: false, error: "Erro interno ao arquivar pet." }
  }
}

/** @deprecated Use archivePetAction */
export async function deletePetAction(petId: string): Promise<ActionResult> {
  return archivePetAction(petId)
}

export async function getMyPetsAction(): Promise<ActionResult<PetData[]>> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return { success: true, data: [] }
    }

    const pets = await findActivePetsByTutorId(tutorProfile.id)
    return { success: true, data: pets }
  } catch (err) {
    console.error("[getMyPetsAction]", err)
    return { success: false, error: "Erro ao buscar pets." }
  }
}

export async function getPetByIdAction(
  petId: string
): Promise<ActionResult<PetData>> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return { success: false, error: "Perfil de tutor não encontrado." }
    }

    const pet = await findPetByIdAndTutorId(petId, tutorProfile.id, {
      includeArchived: true,
    })
    if (!pet) {
      return { success: false, error: "Pet não encontrado ou acesso negado." }
    }

    return { success: true, data: pet }
  } catch (err) {
    console.error("[getPetByIdAction]", err)
    return { success: false, error: "Erro ao buscar pet." }
  }
}

export type TutorPetDashboardStats = {
  totalPets: number
  recentPets: PetSummary[]
}

export async function getTutorPetDashboardStatsAction(): Promise<
  ActionResult<TutorPetDashboardStats>
> {
  try {
    const session = await requireAuth()
    const tutorProfile = await requireTutorProfile(session.id)

    if (!tutorProfile) {
      return { success: true, data: { totalPets: 0, recentPets: [] } }
    }

    const [totalPets, recentPets] = await Promise.all([
      countActivePetsByTutorId(tutorProfile.id),
      findRecentPetsByTutorId(tutorProfile.id, 3),
    ])

    return { success: true, data: { totalPets, recentPets } }
  } catch (err) {
    console.error("[getTutorPetDashboardStatsAction]", err)
    return { success: false, error: "Erro ao carregar pets." }
  }
}
