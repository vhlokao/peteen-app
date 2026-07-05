"use server"

/**
 * Módulo: professional
 * Camada: application (Server Actions)
 *
 * Responsabilidade:
 *   - Orquestrar: autenticação → validação → regras de negócio → repositório → efeitos
 *   - Único ponto de entrada para mutações de ProfessionalProfile e Service
 *
 * Regras invariantes:
 *   - trustScore e trustLevel NUNCA são escritos por Server Actions
 *   - isVerified e planType NUNCA são alterados pelo próprio profissional
 *   - Ownership sempre verificado antes de qualquer mutação
 *   - Transação atômica no onboarding (perfil + user role em uma operação)
 */

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { requireAuth } from "@/modules/identity/application/get-session"
import {
  CreateProfessionalProfileSchema,
  UpdateProfessionalProfileSchema,
  CreateServiceSchema,
  UpdateServiceSchema,
  FindProfessionalsSchema,
  type ActionResult,
  type ProfessionalProfileData,
  type ProfessionalPublicProfile,
  type ServiceData,
  type CreateProfessionalProfileInput,
  type UpdateProfessionalProfileInput,
  type CreateServiceInput,
  type UpdateServiceInput,
  type FindProfessionalsInput,
} from "../domain/types"
import {
  createProfessionalProfileRecord,
  findProfessionalProfileByUserId,
  findProfessionalProfileById,
  updateProfessionalProfileRecord,
  findPublicProfessionals,
  findPublicProfessionalById,
  createServiceRecord,
  findServicesByProfessionalId,
  findServiceByIdAndProfessionalId,
  updateServiceRecord,
  deactivateServiceRecord,
  reactivateServiceRecord,
} from "../infrastructure/repository"
import { recordProfessionalProfileAudit } from "../infrastructure/audit"
import { normalizeCityName, normalizeNeighborhoodName } from "@/modules/location"

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria o perfil de profissional para o usuário autenticado.
 *
 * Invariantes:
 *   - Usuário deve estar autenticado
 *   - Não pode existir ProfessionalProfile para este userId (idempotência)
 *   - trustScore e trustLevel iniciados nos defaults do schema — nunca definidos aqui
 *   - planType inicia em FREE — monetização é responsabilidade de módulo separado
 *
 * Transação atômica:
 *   ProfessionalProfile + User.activePrimaryRole + User.onboardingCompletedAt
 */
export async function createProfessionalProfileAction(
  input: CreateProfessionalProfileInput
): Promise<ActionResult<ProfessionalProfileData>> {
  try {
    const session = await requireAuth()

    const existing = await findProfessionalProfileByUserId(session.id)
    if (existing) {
      return {
        success: false,
        error: "Perfil de profissional já existe para este usuário.",
      }
    }

    const parsed = CreateProfessionalProfileSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.professionalProfile.create({
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
          serviceTypes: parsed.data.serviceTypes,
          specializations: parsed.data.specializations ?? [],
          // trustScore: default 0 — gerenciado pelo Trust Engine
          // trustLevel: default INITIAL — gerenciado pelo Trust Engine
          // planType: default FREE — gerenciado pelo módulo de billing
        },
      })

      await tx.user.update({
        where: { id: session.id },
        data: {
          activePrimaryRole: "PROFESSIONAL",
          onboardingCompletedAt: new Date(),
          lastSeenAt: new Date(),
        },
      })

      return p
    })

    revalidatePath("/onboarding")
    revalidatePath("/(professional)/onboarding")

    return {
      success: true,
      data: {
        ...profile,
        serviceTypes: profile.serviceTypes as import("../domain/types").ServiceType[],
        trustLevel: profile.trustLevel as import("../domain/types").TrustLevel,
        planType: profile.planType as import("../domain/types").PlanType,
      },
    }
  } catch (err) {
    console.error("[createProfessionalProfileAction]", err)
    return { success: false, error: "Erro interno ao criar perfil de profissional." }
  }
}

/**
 * Atualiza dados editáveis do perfil de profissional.
 *
 * Campos NÃO editáveis pelo próprio profissional (verificados implicitamente
 * pela ausência no UpdateProfessionalProfileSchema):
 *   - trustScore, trustLevel — Trust Engine
 *   - isVerified, verifiedAt — moderação
 *   - planType, planExpiresAt — billing
 */
export async function updateProfessionalProfileAction(
  profileId: string,
  input: UpdateProfessionalProfileInput
): Promise<ActionResult<ProfessionalProfileData>> {
  try {
    const session = await requireAuth()

    const profile = await findProfessionalProfileById(profileId)
    if (!profile) {
      return { success: false, error: "Perfil não encontrado." }
    }
    if (profile.userId !== session.id) {
      return { success: false, error: "Acesso negado." }
    }

    const parsed = UpdateProfessionalProfileSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const updated = await updateProfessionalProfileRecord(profileId, parsed.data)
    await recordProfessionalProfileAudit(session.id, updated, profile)

    revalidatePath("/(professional)")
    revalidatePath("/professional")
    revalidatePath("/professional/profile")
    revalidatePath("/professional/metricas")
    revalidatePath("/admin/audit")
    revalidatePath("/discover")
    revalidatePath(`/discover/${profileId}`)
    revalidatePath("/(discovery)/professionals")

    return { success: true, data: updated }
  } catch (err) {
    console.error("[updateProfessionalProfileAction]", err)
    return { success: false, error: "Erro interno ao atualizar perfil." }
  }
}

/**
 * Retorna o perfil de profissional do usuário autenticado.
 * Retorna null se o perfil ainda não foi criado.
 */
export async function getMyProfessionalProfileAction(): Promise<
  ActionResult<ProfessionalProfileData | null>
> {
  try {
    const session = await requireAuth()
    const profile = await findProfessionalProfileByUserId(session.id)
    return { success: true, data: profile }
  } catch (err) {
    console.error("[getMyProfessionalProfileAction]", err)
    return { success: false, error: "Erro ao buscar perfil." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY — ações públicas (não exigem autenticação)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca profissionais disponíveis para discovery.
 *
 * FASE 3: Ordenação por trustScore DESC (simples).
 * FASE 4: Ranking Engine substituirá a query com algoritmo contextual que
 *   considera: petContext, recorrência com o tutor, densidade local,
 *   especialização e decay temporal do trustScore.
 *
 * Esta função é chamada sem autenticação — dados públicos.
 */
export async function findProfessionalsAction(
  input: FindProfessionalsInput
): Promise<ActionResult<ProfessionalPublicProfile[]>> {
  try {
    const parsed = FindProfessionalsSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Filtros inválidos.",
      }
    }

    // Location Foundation V0 — normaliza os filtros textuais antes da query:
    // "carapicuiba" vira "Carapicuíba" (dicionário), o match no banco continua
    // case-insensitive. Sem dado estruturado falso, sem distância, sem geo.
    const filters = {
      ...parsed.data,
      city: normalizeCityName(parsed.data.city) ?? parsed.data.city,
      neighborhood: parsed.data.neighborhood
        ? (normalizeNeighborhoodName(parsed.data.neighborhood) ?? undefined)
        : undefined,
    }

    const results = await findPublicProfessionals(filters)
    return { success: true, data: results }
  } catch (err) {
    console.error("[findProfessionalsAction]", err)
    return { success: false, error: "Erro ao buscar profissionais." }
  }
}

/**
 * Retorna o perfil público de um profissional pelo ID.
 * Inclui serviços ativos. Sem autenticação.
 */
export async function getProfessionalPublicProfileAction(
  professionalId: string
): Promise<ActionResult<ProfessionalPublicProfile>> {
  try {
    const profile = await findPublicProfessionalById(professionalId)
    if (!profile) {
      return { success: false, error: "Profissional não encontrado." }
    }
    return { success: true, data: profile }
  } catch (err) {
    console.error("[getProfessionalPublicProfileAction]", err)
    return { success: false, error: "Erro ao buscar perfil do profissional." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES — catálogo de serviços do profissional
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria um serviço no catálogo do profissional autenticado.
 *
 * Invariantes:
 *   - Usuário deve ter ProfessionalProfile
 *   - priceMax >= priceMin (validado no schema + regra de negócio explícita)
 *   - Serviço criado como isActive: true
 */
export async function createServiceAction(
  input: CreateServiceInput
): Promise<ActionResult<ServiceData>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) {
      return {
        success: false,
        error: "Complete o perfil de profissional antes de criar serviços.",
      }
    }

    const parsed = CreateServiceSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    // Regra de negócio explícita (além da validação do schema)
    if (
      parsed.data.priceMin !== undefined &&
      parsed.data.priceMax !== undefined &&
      parsed.data.priceMax < parsed.data.priceMin
    ) {
      return {
        success: false,
        error: "Preço máximo deve ser maior ou igual ao mínimo.",
        fieldErrors: { priceMax: ["Preço máximo deve ser maior ou igual ao mínimo."] },
      }
    }

    const service = await createServiceRecord(professionalProfile.id, parsed.data)

    revalidatePath("/(professional)/services")
    revalidatePath(`/(discovery)/professionals/${professionalProfile.id}`)

    return { success: true, data: service }
  } catch (err) {
    console.error("[createServiceAction]", err)
    return { success: false, error: "Erro interno ao criar serviço." }
  }
}

/**
 * Atualiza um serviço existente.
 *
 * Invariantes:
 *   - Serviço deve pertencer ao ProfessionalProfile do usuário autenticado
 *   - priceMax >= priceMin se ambos informados
 */
export async function updateServiceAction(
  serviceId: string,
  input: UpdateServiceInput
): Promise<ActionResult<ServiceData>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) {
      return { success: false, error: "Perfil de profissional não encontrado." }
    }

    const service = await findServiceByIdAndProfessionalId(
      serviceId,
      professionalProfile.id
    )
    if (!service) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    const parsed = UpdateServiceSchema.safeParse(input)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    // Valida priceMax vs priceMin considerando valores já persistidos
    const effectiveMin = parsed.data.priceMin ?? service.priceMin ?? undefined
    const effectiveMax = parsed.data.priceMax ?? service.priceMax ?? undefined
    if (
      effectiveMin !== undefined &&
      effectiveMax !== undefined &&
      effectiveMax < effectiveMin
    ) {
      return {
        success: false,
        error: "Preço máximo deve ser maior ou igual ao mínimo.",
        fieldErrors: { priceMax: ["Preço máximo deve ser maior ou igual ao mínimo."] },
      }
    }

    const updated = await updateServiceRecord(serviceId, parsed.data)

    revalidatePath("/(professional)/services")
    revalidatePath(`/(discovery)/professionals/${professionalProfile.id}`)

    return { success: true, data: updated }
  } catch (err) {
    console.error("[updateServiceAction]", err)
    return { success: false, error: "Erro interno ao atualizar serviço." }
  }
}

/**
 * Desativa um serviço do catálogo.
 *
 * Serviço desativado:
 *   - Não aparece no perfil público
 *   - Não aceita novas solicitações
 *   - Permanece nos registros históricos (ServiceRequests existentes intactos)
 *
 * Por que não deletar:
 *   - ServiceRequests passados referenciam o serviceType, não o Service.id
 *   - O histórico de atendimentos não pode ser quebrado
 */
export async function deactivateServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceData>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) {
      return { success: false, error: "Perfil de profissional não encontrado." }
    }

    const service = await findServiceByIdAndProfessionalId(
      serviceId,
      professionalProfile.id
    )
    if (!service) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    if (!service.isActive) {
      return { success: false, error: "Serviço já está desativado." }
    }

    const deactivated = await deactivateServiceRecord(serviceId)

    revalidatePath("/(professional)/services")
    revalidatePath(`/(discovery)/professionals/${professionalProfile.id}`)

    return { success: true, data: deactivated }
  } catch (err) {
    console.error("[deactivateServiceAction]", err)
    return { success: false, error: "Erro interno ao desativar serviço." }
  }
}

/**
 * Reativa um serviço previamente desativado.
 */
export async function reactivateServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceData>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) {
      return { success: false, error: "Perfil de profissional não encontrado." }
    }

    const service = await findServiceByIdAndProfessionalId(
      serviceId,
      professionalProfile.id
    )
    if (!service) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    if (service.isActive) {
      return { success: false, error: "Serviço já está ativo." }
    }

    const reactivated = await reactivateServiceRecord(serviceId)

    revalidatePath("/(professional)/services")

    return { success: true, data: reactivated }
  } catch (err) {
    console.error("[reactivateServiceAction]", err)
    return { success: false, error: "Erro interno ao reativar serviço." }
  }
}

/**
 * Retorna todos os serviços do profissional autenticado.
 */
export async function getMyServicesAction(options?: {
  activeOnly?: boolean
}): Promise<ActionResult<ServiceData[]>> {
  try {
    const session = await requireAuth()

    const professionalProfile = await findProfessionalProfileByUserId(session.id)
    if (!professionalProfile) {
      return { success: true, data: [] }
    }

    const services = await findServicesByProfessionalId(
      professionalProfile.id,
      options
    )

    return { success: true, data: services }
  } catch (err) {
    console.error("[getMyServicesAction]", err)
    return { success: false, error: "Erro ao buscar serviços." }
  }
}
