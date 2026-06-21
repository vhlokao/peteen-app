"use server"

/**
 * módulo: growth-engine
 * camada: application — Server Actions (admin + leitura pública)
 */

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/modules/identity/application/get-session"
import { createAdminAudit } from "@/modules/moderation/infrastructure/repository"
import {
  getGrowthOverviewMetrics,
  getRegionGrowthRows,
  getNeighborhoodHeatmap,
  getDistinctCitiesForHeatmap,
  getLocalDiscoveryContext,
  getTerritorialPosition,
  createRegion,
  updateRegion,
  createNeighborhood,
  updateNeighborhood,
  listRegionsForSelect,
} from "../infrastructure/repository"
import type {
  CreateRegionInput,
  CreateNeighborhoodInput,
  UpdateRegionInput,
  UpdateNeighborhoodInput,
} from "../domain/types"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function assertAdmin(): Promise<string> {
  const user = await requireAdmin()
  return user.id
}

export async function getAdminGrowthOverviewAction() {
  await assertAdmin()
  return getGrowthOverviewMetrics()
}

export async function getAdminRegionGrowthRowsAction() {
  await assertAdmin()
  return getRegionGrowthRows()
}

export async function getAdminNeighborhoodHeatmapAction(city?: string) {
  await assertAdmin()
  return getNeighborhoodHeatmap(city)
}

export async function getAdminHeatmapCitiesAction() {
  await assertAdmin()
  return getDistinctCitiesForHeatmap()
}

export async function getRegionsForSelectAction() {
  await assertAdmin()
  return listRegionsForSelect()
}

export async function getLocalDiscoveryContextAction(input: {
  city:           string | null
  neighborhood:   string | null
  neighborhoodId: string | null
  regionId:       string | null
}) {
  return getLocalDiscoveryContext(input)
}

export async function getTerritorialPositionAction(professionalId: string) {
  return getTerritorialPosition(professionalId)
}

export async function createRegionAction(
  input: CreateRegionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminId = await assertAdmin()
    const region = await createRegion(input)

    await createAdminAudit({
      adminId,
      action:     "growth.region_created",
      entityType: "REGION",
      entityId:   region.id,
      metadata:   { city: region.city, state: region.state, name: region.name, slug: region.slug },
    })

    revalidatePath("/admin/growth")
    return { ok: true, data: { id: region.id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar região"
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Já existe uma região com este slug nesta cidade." }
    }
    return { ok: false, error: msg }
  }
}

export async function updateRegionAction(
  id: string,
  input: UpdateRegionInput
): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdmin()
    const region = await updateRegion(id, input)

    await createAdminAudit({
      adminId,
      action:     "growth.region_updated",
      entityType: "REGION",
      entityId:   id,
      metadata:   { city: region.city, name: region.name },
    })

    revalidatePath("/admin/growth")
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar região" }
  }
}

export async function createNeighborhoodAction(
  input: CreateNeighborhoodInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminId = await assertAdmin()
    const nb = await createNeighborhood(input)

    await createAdminAudit({
      adminId,
      action:     "growth.neighborhood_created",
      entityType: "NEIGHBORHOOD",
      entityId:   nb.id,
      metadata:   {
        city: nb.city, state: nb.state, name: nb.name, slug: nb.slug, regionId: nb.regionId,
      },
    })

    revalidatePath("/admin/growth")
    return { ok: true, data: { id: nb.id } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar bairro"
    if (msg.includes("Unique constraint")) {
      return { ok: false, error: "Já existe um bairro com este slug nesta cidade." }
    }
    return { ok: false, error: msg }
  }
}

export async function updateNeighborhoodAction(
  id: string,
  input: UpdateNeighborhoodInput
): Promise<ActionResult<void>> {
  try {
    const adminId = await assertAdmin()
    const nb = await updateNeighborhood(id, input)

    await createAdminAudit({
      adminId,
      action:     "growth.neighborhood_updated",
      entityType: "NEIGHBORHOOD",
      entityId:   id,
      metadata:   { city: nb.city, name: nb.name, regionId: nb.regionId },
    })

    revalidatePath("/admin/growth")
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar bairro" }
  }
}
