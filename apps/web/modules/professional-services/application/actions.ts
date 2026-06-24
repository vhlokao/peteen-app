"use server"

import { revalidatePath } from "next/cache"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  type CreateServiceInput,
  type ServiceData,
  type UpdateServiceInput,
  type ActionResult,
} from "@/modules/professional/domain/types"
import {
  createServiceRecord,
  deactivateServiceRecord,
  findServiceByIdAndProfessionalId,
  reactivateServiceRecord,
  updateServiceRecord,
} from "@/modules/professional/infrastructure/repository"

import { recordServiceAudit } from "../infrastructure/audit"
import { getProfessionalServices } from "../infrastructure/queries"
import type {
  ProfessionalServiceFormInput,
  ProfessionalServiceRow,
  ProfessionalServiceUpdateInput,
} from "../domain/types"

function revalidateServicePaths(professionalId: string) {
  revalidatePath("/professional/services")
  revalidatePath("/professional/profile")
  revalidatePath(`/discover/${professionalId}`)
}

function mapCreateInput(input: ProfessionalServiceFormInput): CreateServiceInput {
  return {
    name: input.name,
    description: input.description,
    serviceType: input.serviceType,
    priceMin: input.basePrice,
    priceMax: input.basePrice,
  }
}

function mapUpdateInput(input: ProfessionalServiceUpdateInput): UpdateServiceInput {
  const mapped: UpdateServiceInput = {}
  if (input.name !== undefined) mapped.name = input.name
  if (input.description !== undefined) mapped.description = input.description
  if (input.serviceType !== undefined) mapped.serviceType = input.serviceType
  if (input.basePrice !== undefined) {
    mapped.priceMin = input.basePrice
    mapped.priceMax = input.basePrice
  }
  return mapped
}

export async function listProfessionalServicesAction(): Promise<
  ActionResult<ProfessionalServiceRow[]>
> {
  try {
    const { profile } = await requireProfessionalContext()
    const services = await getProfessionalServices(profile.id)
    return { success: true, data: services }
  } catch (err) {
    console.error("[listProfessionalServicesAction]", err)
    return { success: false, error: "Erro ao buscar serviços." }
  }
}

export async function createProfessionalServiceAction(
  input: ProfessionalServiceFormInput
): Promise<ActionResult<ServiceData>> {
  try {
    const { session, profile } = await requireProfessionalContext()

    const parsed = CreateServiceSchema.safeParse(mapCreateInput(input))
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const service = await createServiceRecord(profile.id, parsed.data)
    await recordServiceAudit(session.id, "professional.service_created", service)

    revalidateServicePaths(profile.id)
    return { success: true, data: service }
  } catch (err) {
    console.error("[createProfessionalServiceAction]", err)
    return { success: false, error: "Erro interno ao criar serviço." }
  }
}

export async function updateProfessionalServiceAction(
  serviceId: string,
  input: ProfessionalServiceUpdateInput
): Promise<ActionResult<ServiceData>> {
  try {
    const { session, profile } = await requireProfessionalContext()

    const existing = await findServiceByIdAndProfessionalId(serviceId, profile.id)
    if (!existing) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    const mapped = mapUpdateInput(input)
    const parsed = UpdateServiceSchema.safeParse(mapped)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        fieldErrors,
      }
    }

    const effectiveMin = parsed.data.priceMin ?? existing.priceMin ?? undefined
    const effectiveMax = parsed.data.priceMax ?? existing.priceMax ?? undefined
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
    await recordServiceAudit(session.id, "professional.service_updated", updated, existing)

    revalidateServicePaths(profile.id)
    return { success: true, data: updated }
  } catch (err) {
    console.error("[updateProfessionalServiceAction]", err)
    return { success: false, error: "Erro interno ao atualizar serviço." }
  }
}

export async function activateProfessionalServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceData>> {
  try {
    const { session, profile } = await requireProfessionalContext()

    const existing = await findServiceByIdAndProfessionalId(serviceId, profile.id)
    if (!existing) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    if (existing.isActive) {
      return { success: false, error: "Serviço já está ativo." }
    }

    const activated = await reactivateServiceRecord(serviceId)
    await recordServiceAudit(session.id, "professional.service_activated", activated, existing)

    revalidateServicePaths(profile.id)
    return { success: true, data: activated }
  } catch (err) {
    console.error("[activateProfessionalServiceAction]", err)
    return { success: false, error: "Erro interno ao ativar serviço." }
  }
}

export async function deactivateProfessionalServiceAction(
  serviceId: string
): Promise<ActionResult<ServiceData>> {
  try {
    const { session, profile } = await requireProfessionalContext()

    const existing = await findServiceByIdAndProfessionalId(serviceId, profile.id)
    if (!existing) {
      return { success: false, error: "Serviço não encontrado ou acesso negado." }
    }

    if (!existing.isActive) {
      return { success: false, error: "Serviço já está inativo." }
    }

    const deactivated = await deactivateServiceRecord(serviceId)
    await recordServiceAudit(session.id, "professional.service_deactivated", deactivated, existing)

    revalidateServicePaths(profile.id)
    return { success: true, data: deactivated }
  } catch (err) {
    console.error("[deactivateProfessionalServiceAction]", err)
    return { success: false, error: "Erro interno ao desativar serviço." }
  }
}
