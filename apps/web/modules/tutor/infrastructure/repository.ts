/**
 * Módulo: tutor
 * Camada: infrastructure — TutorProfile + reexport pets
 */

import { prisma } from "@/lib/prisma/client"
import type {
  TutorProfileData,
  CreateTutorProfileInput,
  UpdateTutorProfileInput,
} from "../domain/types"

export {
  createPetRecord,
  findPetsByTutorId,
  findPetById,
  findPetByIdAndTutorId,
  buildPetContextSnapshot,
  softDeletePet,
} from "@/modules/pets/infrastructure/repository"

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export async function createTutorProfileRecord(
  userId: string,
  input: CreateTutorProfileInput
): Promise<TutorProfileData> {
  return prisma.tutorProfile.create({
    data: {
      userId,
      displayName: input.displayName,
      bio: input.bio ?? null,
      phone: input.phone || null,
      neighborhood: input.neighborhood ?? null,
      city: input.city,
      state: input.state,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    },
  })
}

export async function findTutorProfileByUserId(
  userId: string
): Promise<TutorProfileData | null> {
  return prisma.tutorProfile.findUnique({
    where: { userId },
  })
}

export async function findTutorProfileById(
  id: string
): Promise<TutorProfileData | null> {
  return prisma.tutorProfile.findUnique({
    where: { id },
  })
}

export async function findPublicTutorProfiles(filters: {
  city?: string
  limit?: number
  offset?: number
}): Promise<TutorProfileData[]> {
  return prisma.tutorProfile.findMany({
    where: {
      deletedAt: null,
      ...(filters.city ? { city: filters.city } : {}),
    },
    take: filters.limit ?? 20,
    skip: filters.offset ?? 0,
    orderBy: { createdAt: "desc" },
  })
}

export async function updateTutorProfileRecord(
  id: string,
  input: UpdateTutorProfileInput
): Promise<TutorProfileData> {
  return prisma.tutorProfile.update({
    where: { id },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.bio !== undefined && { bio: input.bio ?? null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.neighborhood !== undefined && {
        neighborhood: input.neighborhood ?? null,
      }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.lat !== undefined && { lat: input.lat ?? null }),
      ...(input.lng !== undefined && { lng: input.lng ?? null }),
    },
  })
}

export async function softDeleteTutorProfile(id: string): Promise<void> {
  await prisma.tutorProfile.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}
