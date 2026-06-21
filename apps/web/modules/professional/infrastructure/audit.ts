/**
 * Módulo: professional
 * Camada: infrastructure — auditoria de perfil (Etapa 6.5)
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import type { ProfessionalProfileData } from "../domain/types"

function profileAuditPayload(
  profile: ProfessionalProfileData
): Record<string, unknown> {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    state: profile.state,
    neighborhood: profile.neighborhood,
    phone: profile.phone,
    bio: profile.bio,
    serviceRadiusKm: profile.serviceRadiusKm,
    serviceTypes: profile.serviceTypes,
    specializations: profile.specializations,
  }
}

export async function recordProfessionalProfileAudit(
  userId: string,
  profile: ProfessionalProfileData,
  before?: ProfessionalProfileData | null
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "professional.profile_updated",
        entity: "ProfessionalProfile",
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
