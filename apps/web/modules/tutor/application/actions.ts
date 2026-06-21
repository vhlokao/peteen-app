"use server"

/**
 * Módulo: tutor — Server Actions (perfil de tutor)
 */

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { requireAuth } from "@/modules/identity/application/get-session"
import {
  CreateTutorProfileSchema,
  UpdateTutorProfileSchema,
  type ActionResult,
  type TutorProfileData,
  type CreateTutorProfileInput,
  type UpdateTutorProfileInput,
} from "../domain/types"
import {
  findTutorProfileByUserId,
  findTutorProfileById,
  updateTutorProfileRecord,
} from "../infrastructure/repository"
import { recordTutorProfileAudit } from "../infrastructure/audit"

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export async function createTutorProfileAction(
  input: CreateTutorProfileInput
): Promise<ActionResult<TutorProfileData>> {
  try {
    const session = await requireAuth()

    const existing = await findTutorProfileByUserId(session.id)
    if (existing) {
      return {
        success: false,
        error: "Perfil de tutor já existe para este usuário.",
      }
    }

    const parsed = CreateTutorProfileSchema.safeParse(input)
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

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.tutorProfile.create({
        data: {
          userId: session.id,
          displayName: parsed.data.displayName,
          bio: parsed.data.bio ?? null,
          phone: parsed.data.phone || null,
          neighborhood: parsed.data.neighborhood ?? null,
          city: parsed.data.city,
          state: parsed.data.state,
          lat: parsed.data.lat ?? null,
          lng: parsed.data.lng ?? null,
        },
      })

      await tx.user.update({
        where: { id: session.id },
        data: {
          activePrimaryRole: "TUTOR",
          onboardingCompletedAt: new Date(),
          lastSeenAt: new Date(),
        },
      })

      return p
    })

    revalidatePath("/onboarding")
    revalidatePath("/(tutor)/onboarding")

    return { success: true, data: profile }
  } catch (err) {
    console.error("[createTutorProfileAction]", err)
    return { success: false, error: "Erro interno ao criar perfil de tutor." }
  }
}

export async function updateTutorProfileAction(
  profileId: string,
  input: UpdateTutorProfileInput
): Promise<ActionResult<TutorProfileData>> {
  try {
    const session = await requireAuth()

    const profile = await findTutorProfileById(profileId)
    if (!profile) {
      return { success: false, error: "Perfil não encontrado." }
    }
    if (profile.userId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const parsed = UpdateTutorProfileSchema.safeParse(input)
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

    const updated = await updateTutorProfileRecord(profileId, parsed.data)
    await recordTutorProfileAudit(session.id, updated, profile)

    revalidatePath("/tutor")
    revalidatePath("/tutor/perfil")
    revalidatePath("/admin/audit")

    return { success: true, data: updated }
  } catch (err) {
    console.error("[updateTutorProfileAction]", err)
    return { success: false, error: "Erro interno ao atualizar perfil." }
  }
}

export async function getMyTutorProfileAction(): Promise<
  ActionResult<TutorProfileData | null>
> {
  try {
    const session = await requireAuth()
    const profile = await findTutorProfileByUserId(session.id)
    return { success: true, data: profile }
  } catch (err) {
    console.error("[getMyTutorProfileAction]", err)
    return { success: false, error: "Erro ao buscar perfil." }
  }
}
