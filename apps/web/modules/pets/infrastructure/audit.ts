/**
 * Módulo: pets
 * Camada: infrastructure — auditoria transversal (AuditLog)
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { PetData } from "../domain/types"

export type PetAuditAction = "pet.created" | "pet.updated" | "pet.archived"

function petAuditPayload(pet: PetData): Record<string, unknown> {
  return {
    id: pet.id,
    tutorId: pet.tutorId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    gender: pet.gender,
    size: pet.size,
    isActive: pet.isActive,
  }
}

export async function recordPetAudit(
  userId: string,
  action: PetAuditAction,
  pet: PetData,
  before?: PetData | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: "Pet",
        entityId: pet.id,
        before: before
          ? (petAuditPayload(before) as Prisma.InputJsonValue)
          : undefined,
        after: petAuditPayload(pet) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
