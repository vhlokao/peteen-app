/**
 * Módulo: tutor
 * Camada: infrastructure — auditoria de perfil (Etapa 6.4)
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { TutorProfileData } from "../domain/types"

function profileAuditPayload(
  profile: TutorProfileData
): Record<string, unknown> {
  return {
    id: profile.id,
    displayName: profile.displayName,
    city: profile.city,
    state: profile.state,
    neighborhood: profile.neighborhood,
    phone: profile.phone,
    bio: profile.bio,
  }
}

export async function recordTutorProfileAudit(
  userId: string,
  profile: TutorProfileData,
  before?: TutorProfileData | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "tutor.profile_updated",
        entity: "TutorProfile",
        entityId: profile.id,
        before: before
          ? (profileAuditPayload(before) as Prisma.InputJsonValue)
          : undefined,
        after: profileAuditPayload(profile) as Prisma.InputJsonValue,
      },
    })
  } catch {
    // auditoria nunca deve quebrar fluxo principal
  }
}
