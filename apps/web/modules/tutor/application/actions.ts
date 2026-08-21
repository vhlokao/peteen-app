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
import { normalizeLocationInput } from "@/modules/location"
import {
  uploadAvatarPhoto,
  deleteAvatarByUrl,
  AvatarValidationError,
} from "@/lib/storage/avatar-photo"

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

    // Normalização de escrita (Location Consistency V0.1) — ponto server-side
    // autoritativo, antes da persistência. Nunca bloqueia cidade desconhecida.
    const location = normalizeLocationInput({
      city: parsed.data.city,
      state: parsed.data.state,
      neighborhood: parsed.data.neighborhood,
    })

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.tutorProfile.create({
        data: {
          userId: session.id,
          displayName: parsed.data.displayName,
          bio: parsed.data.bio ?? null,
          phone: parsed.data.phone || null,
          neighborhood: location.neighborhood ?? null,
          city: location.city ?? parsed.data.city,
          state: location.state ?? parsed.data.state,
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

/**
 * Envia um novo avatar para o tutor autenticado.
 *
 * Espelha `uploadProfessionalAvatarAction` (modules/professional/application/
 * actions.ts) sobre a MESMA infraestrutura de storage — nenhuma arquitetura
 * nova, nenhum path novo, nenhuma RLS nova. `session.authId` só existe aqui,
 * resolvido do lado do servidor a partir da sessão real, nunca de um campo
 * do formulário: é essa garantia, e a checagem de ownership logo abaixo, que
 * impedem um tutor de alterar o avatar de outro — a mesma dupla trava do
 * hardening do bucket `avatars`.
 */
export async function uploadTutorAvatarAction(
  profileId: string,
  formData: FormData
): Promise<ActionResult<{ avatarUrl: string }>> {
  try {
    const session = await requireAuth()

    const profile = await findTutorProfileById(profileId)
    if (!profile) {
      return { success: false, error: "Perfil não encontrado." }
    }
    if (profile.userId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Nenhuma imagem enviada." }
    }

    let avatarUrl: string
    try {
      avatarUrl = await uploadAvatarPhoto(file, session.authId)
    } catch (err) {
      if (err instanceof AvatarValidationError) {
        return { success: false, error: err.message }
      }
      throw err
    }

    const previousAvatarUrl = profile.avatarUrl
    const updated = await updateTutorProfileRecord(profileId, { avatarUrl })
    await recordTutorProfileAudit(session.id, updated, profile)

    // Só remove o avatar ANTERIOR depois que o banco já aponta para o novo —
    // nunca antes. Best-effort: uma falha aqui não desfaz o upload, que já
    // está salvo e funcional; só deixa um objeto órfão no bucket.
    await deleteAvatarByUrl(previousAvatarUrl)

    revalidatePath("/tutor")
    revalidatePath("/tutor/perfil")
    revalidatePath("/tutor/conta")

    return { success: true, data: { avatarUrl } }
  } catch (err) {
    console.error("[uploadTutorAvatarAction]", err)
    return { success: false, error: "Erro interno ao enviar a foto." }
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
