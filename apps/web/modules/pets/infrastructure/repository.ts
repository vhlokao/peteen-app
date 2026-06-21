/**
 * Módulo: pets
 * Camada: infrastructure — persistência Prisma
 */

import { prisma } from "@/lib/prisma/client"
import type {
  PetData,
  PetContextSnapshot,
  PetSummary,
  CreatePetInput,
  UpdatePetInput,
} from "../domain/types"

const ACTIVE_PET_WHERE = {
  deletedAt: null,
  isActive: true,
} as const

export async function createPetRecord(
  tutorId: string,
  input: CreatePetInput
): Promise<PetData> {
  const description = input.description ?? input.notes ?? null

  return prisma.pet.create({
    data: {
      tutorId,
      name: input.name,
      species: input.species,
      breed: input.breed ?? null,
      gender: input.gender ?? null,
      birthDate: input.birthDate ?? null,
      weight: input.weight ?? null,
      size: input.size ?? null,
      description,
      notes: input.notes ?? description,
      isNeutered: input.isNeutered ?? null,
      hasSpecialNeeds: input.hasSpecialNeeds ?? false,
      avatarUrl: input.avatarUrl || null,
      isActive: true,
    },
  })
}

export async function findActivePetsByTutorId(
  tutorId: string
): Promise<PetData[]> {
  return prisma.pet.findMany({
    where: { tutorId, ...ACTIVE_PET_WHERE },
    orderBy: { createdAt: "desc" },
  })
}

export async function findRecentPetsByTutorId(
  tutorId: string,
  limit = 3
): Promise<PetSummary[]> {
  return prisma.pet.findMany({
    where: { tutorId, ...ACTIVE_PET_WHERE },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      species: true,
      breed: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
    },
  })
}

export async function countActivePetsByTutorId(tutorId: string): Promise<number> {
  return prisma.pet.count({
    where: { tutorId, ...ACTIVE_PET_WHERE },
  })
}

export async function findPetById(id: string): Promise<PetData | null> {
  return prisma.pet.findUnique({ where: { id } })
}

export async function findPetByIdAndTutorId(
  id: string,
  tutorId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<PetData | null> {
  return prisma.pet.findFirst({
    where: {
      id,
      tutorId,
      deletedAt: null,
      ...(includeArchived ? {} : { isActive: true }),
    },
  })
}

export async function updatePetRecord(
  id: string,
  input: UpdatePetInput
): Promise<PetData> {
  const description =
    input.description !== undefined
      ? input.description ?? null
      : input.notes !== undefined
        ? input.notes ?? null
        : undefined

  return prisma.pet.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.species !== undefined && { species: input.species }),
      ...(input.breed !== undefined && { breed: input.breed ?? null }),
      ...(input.gender !== undefined && { gender: input.gender ?? null }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate ?? null }),
      ...(input.weight !== undefined && { weight: input.weight ?? null }),
      ...(input.size !== undefined && { size: input.size ?? null }),
      ...(description !== undefined && {
        description,
        notes: input.notes ?? description,
      }),
      ...(input.isNeutered !== undefined && { isNeutered: input.isNeutered ?? null }),
      ...(input.hasSpecialNeeds !== undefined && {
        hasSpecialNeeds: input.hasSpecialNeeds,
      }),
      ...(input.avatarUrl !== undefined && {
        avatarUrl: input.avatarUrl || null,
      }),
    },
  })
}

export async function archivePetRecord(id: string): Promise<PetData> {
  return prisma.pet.update({
    where: { id },
    data: { isActive: false },
  })
}

/** @deprecated Preferir archivePetRecord — mantido para compatibilidade legada */
export async function softDeletePet(id: string): Promise<void> {
  await prisma.pet.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
}

/** Compatibilidade: listagem ativa (substitui findPetsByTutorId legado). */
export async function findPetsByTutorId(tutorId: string): Promise<PetData[]> {
  return findActivePetsByTutorId(tutorId)
}

export function buildPetContextSnapshot(pet: PetData): PetContextSnapshot {
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    hasSpecialNeeds: pet.hasSpecialNeeds,
    notes: pet.notes ?? pet.description,
    weightKg: pet.weight,
  }
}
