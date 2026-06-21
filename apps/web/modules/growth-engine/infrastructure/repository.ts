/**
 * módulo: growth-engine
 * camada: infrastructure — agregações territoriais via Prisma
 */

import { prisma } from "@/lib/prisma/client"
import {
  computeHealthScore,
  computeTerritoryMetrics,
  classifyHealthScore,
  healthToStars,
} from "../domain/scoring"
import type {
  GrowthOverviewMetrics,
  RegionGrowthRow,
  NeighborhoodHeatmapRow,
  LocalDiscoveryContext,
  TerritorialPosition,
  CreateRegionInput,
  CreateNeighborhoodInput,
  UpdateRegionInput,
  UpdateNeighborhoodInput,
} from "../domain/types"
import { RECURRENCE_TRUSTED_THRESHOLD } from "../domain/constants"
import { slugifyTerritory } from "../domain/scoring"

const GROWTH_DELEGATE_UNAVAILABLE =
  "Módulo Growth Engine indisponível no Prisma Client. Execute `npx prisma generate` e reinicie o servidor (npm run dev)."

function hasGrowthDelegates(): boolean {
  const record = prisma as unknown as Record<string, unknown>
  return record.region !== undefined && record.neighborhood !== undefined
}

function getRegionDelegate() {
  return (prisma as unknown as { region?: typeof prisma.region }).region ?? null
}

function getNeighborhoodDelegate() {
  return (prisma as unknown as { neighborhood?: typeof prisma.neighborhood }).neighborhood ?? null
}

// ── Overview ──────────────────────────────────────────────────────────────────

export async function getGrowthOverviewMetrics(): Promise<GrowthOverviewMetrics> {
  if (!hasGrowthDelegates()) {
    return { citiesMonitored: 0, neighborhoodsMonitored: 0, regionsMonitored: 0 }
  }

  try {
    const regionDelegate = getRegionDelegate()!
    const neighborhoodDelegate = getNeighborhoodDelegate()!

    const [regions, neighborhoods, cities] = await Promise.all([
      regionDelegate.count(),
      neighborhoodDelegate.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT LOWER(TRIM(city))) AS count
        FROM (
          SELECT city FROM professional_profiles WHERE "deletedAt" IS NULL
          UNION
          SELECT city FROM tutor_profiles WHERE "deletedAt" IS NULL
          UNION
          SELECT city FROM partners WHERE "isActive" = TRUE
        ) AS c
      `,
    ])
    return {
      citiesMonitored:        Number(cities[0]?.count ?? 0),
      neighborhoodsMonitored: neighborhoods,
      regionsMonitored:       regions,
    }
  } catch {
    return { citiesMonitored: 0, neighborhoodsMonitored: 0, regionsMonitored: 0 }
  }
}

// ── Regiões ───────────────────────────────────────────────────────────────────

export async function getRegionGrowthRows(): Promise<RegionGrowthRow[]> {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) return []

  try {
    const regions = await regionDelegate.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { neighborhoods: { select: { id: true } } },
    })

    if (regions.length === 0) return []

    const rows: RegionGrowthRow[] = []

    for (const region of regions) {
      const neighborhoodIds = region.neighborhoods.map((n) => n.id)

      const regionFilter = {
        OR: [
          { regionId: region.id },
          ...(neighborhoodIds.length > 0
            ? [{ neighborhoodId: { in: neighborhoodIds } }]
            : []),
        ],
      }

      const [
        professionalCount,
        tutorCount,
        partnerCount,
        trustAgg,
        requestCount,
        recurringCount,
        totalRelationships,
      ] = await Promise.all([
        prisma.professionalProfile.count({
          where: { deletedAt: null, ...regionFilter },
        }),
        prisma.tutorProfile.count({
          where: { deletedAt: null, ...regionFilter },
        }),
        prisma.partner.count({
          where: { isActive: true, regionId: region.id },
        }),
        prisma.professionalProfile.aggregate({
          where: { deletedAt: null, ...regionFilter },
          _avg: { trustScore: true },
        }),
        prisma.serviceRequest.count({
          where: {
            professional: {
              deletedAt: null,
              ...regionFilter,
            },
          },
        }),
        prisma.tutorProfessionalRelationship.count({
          where: {
            completedServices: { gte: 3 },
            professional: { deletedAt: null, ...regionFilter },
          },
        }),
        prisma.tutorProfessionalRelationship.count({
          where: { professional: { deletedAt: null, ...regionFilter } },
        }),
      ])

      const recurrenceRatio =
        totalRelationships > 0 ? recurringCount / totalRelationships : 0

      const metrics = computeTerritoryMetrics({
        professionalCount,
        requestCount,
        trustAvg: trustAgg._avg.trustScore ?? 0,
        recurrenceRatio,
        partnerCount,
      })

      const healthScore = computeHealthScore(metrics)

      rows.push({
        regionId:          region.id,
        regionName:        region.name,
        city:              region.city,
        state:             region.state,
        professionalCount,
        tutorCount,
        requestCount,
        recurrenceAvg:     Math.round(recurrenceRatio * 100),
        trustAvg:          Math.round(trustAgg._avg.trustScore ?? 0),
        partnerCount,
        metrics,
        healthScore,
        classification:    classifyHealthScore(healthScore),
      })
    }

    return rows.sort((a, b) => b.healthScore - a.healthScore)
  } catch {
    return []
  }
}

// ── Heatmap por cidade ────────────────────────────────────────────────────────

export async function getNeighborhoodHeatmap(cityFilter?: string): Promise<NeighborhoodHeatmapRow[]> {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) return []

  try {
    const where = cityFilter
      ? { city: { equals: cityFilter, mode: "insensitive" as const } }
      : {}

    const neighborhoods = await neighborhoodDelegate.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { region: { select: { name: true } } },
    })

    const rows: NeighborhoodHeatmapRow[] = []

    for (const nb of neighborhoods) {
      const filter = {
        OR: [
          { neighborhoodId: nb.id },
          {
            neighborhood: { equals: nb.name, mode: "insensitive" as const },
            city:         { equals: nb.city, mode: "insensitive" as const },
          },
        ],
      }

      const [professionals, requests, trustAgg, partners, recurring, totalRel] =
        await Promise.all([
          prisma.professionalProfile.count({ where: { deletedAt: null, ...filter } }),
          prisma.serviceRequest.count({
            where: { professional: { deletedAt: null, ...filter } },
          }),
          prisma.professionalProfile.aggregate({
            where: { deletedAt: null, ...filter },
            _avg: { trustScore: true },
          }),
          prisma.partner.count({
            where: {
              isActive: true,
              OR: [
                { neighborhoodId: nb.id },
                { city: { equals: nb.city, mode: "insensitive" } },
              ],
            },
          }),
          prisma.tutorProfessionalRelationship.count({
            where: {
              completedServices: { gte: 3 },
              professional: { deletedAt: null, ...filter },
            },
          }),
          prisma.tutorProfessionalRelationship.count({
            where: { professional: { deletedAt: null, ...filter } },
          }),
        ])

      const metrics = computeTerritoryMetrics({
        professionalCount: professionals,
        requestCount:      requests,
        trustAvg:          trustAgg._avg.trustScore ?? 0,
        recurrenceRatio:   totalRel > 0 ? recurring / totalRel : 0,
        partnerCount:      partners,
      })

      const healthScore = computeHealthScore(metrics)

      rows.push({
        neighborhoodId:   nb.id,
        neighborhoodName: nb.name,
        city:             nb.city,
        state:            nb.state,
        healthScore,
        starRating:       healthToStars(healthScore),
      })
    }

    return rows.sort((a, b) => b.healthScore - a.healthScore)
  } catch {
    return []
  }
}

export async function getDistinctCitiesForHeatmap(): Promise<string[]> {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) return []

  try {
    const rows = await neighborhoodDelegate.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    })
    return rows.map((r) => r.city)
  } catch {
    return []
  }
}

// ── Discovery context ─────────────────────────────────────────────────────────

export async function getLocalDiscoveryContext(input: {
  city:             string | null
  neighborhood:     string | null
  neighborhoodId:   string | null
  regionId:         string | null
  trustedMinScore?: number
}): Promise<LocalDiscoveryContext> {
  const trustedMin = input.trustedMinScore ?? 25
  const messages: string[] = []

  if (!input.city) {
    return {
      trustedNearbyCount:   0,
      city:                 null,
      neighborhood:         null,
      region:               null,
      hasHighRecurrence:    false,
      communityRecommended: false,
      messages:             [],
    }
  }

  const geoFilter = {
    city: { equals: input.city, mode: "insensitive" as const },
    ...(input.neighborhoodId
      ? { neighborhoodId: input.neighborhoodId }
      : input.neighborhood
        ? { neighborhood: { equals: input.neighborhood, mode: "insensitive" as const } }
        : {}),
  }

  const [trustedNearby, recurrenceRatio, partnerEndorsements] = await Promise.all([
    prisma.professionalProfile.count({
      where: {
        deletedAt: null,
        trustScore: { gte: trustedMin },
        ...geoFilter,
      },
    }),
    computeRecurrenceRatioForGeo(geoFilter),
    input.city
      ? prisma.partner.count({
          where: { isActive: true, city: { equals: input.city, mode: "insensitive" } },
        })
      : Promise.resolve(0),
  ])

  let regionName: string | null = null
  if (input.regionId) {
    const regionDelegate = getRegionDelegate()
    if (regionDelegate) {
      const region = await regionDelegate.findUnique({
        where: { id: input.regionId },
        select: { name: true },
      })
      regionName = region?.name ?? null
    }
  }

  if (trustedNearby > 0) {
    messages.push(
      `${trustedNearby} profissional${trustedNearby !== 1 ? "is" : ""} confiável${trustedNearby !== 1 ? "eis" : ""} próximos de você`
    )
  }

  const hasHighRecurrence = recurrenceRatio >= RECURRENCE_TRUSTED_THRESHOLD
  if (hasHighRecurrence) {
    messages.push("Região com alta recorrência")
  }

  const communityRecommended = partnerEndorsements >= 2
  if (communityRecommended) {
    messages.push("Área recomendada pela comunidade Peteen")
  }

  return {
    trustedNearbyCount:   trustedNearby,
    city:                 input.city,
    neighborhood:         input.neighborhood,
    region:               regionName,
    hasHighRecurrence,
    communityRecommended,
    messages,
  }
}

async function computeRecurrenceRatioForGeo(
  geoFilter: Record<string, unknown>
): Promise<number> {
  const [recurring, total] = await Promise.all([
    prisma.tutorProfessionalRelationship.count({
      where: {
        completedServices: { gte: 3 },
        professional: { deletedAt: null, ...geoFilter },
      },
    }),
    prisma.tutorProfessionalRelationship.count({
      where: { professional: { deletedAt: null, ...geoFilter } },
    }),
  ])
  return total > 0 ? recurring / total : 0
}

// ── Posição territorial (Trust Debug) ─────────────────────────────────────────

export async function getTerritorialPosition(
  professionalId: string
): Promise<TerritorialPosition | null> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    select: {
      city: true,
      state: true,
      neighborhood: true,
      neighborhoodId: true,
      regionId: true,
      trustScore: true,
      regionRef: { select: { name: true } },
      neighborhoodRef: { select: { name: true } },
    },
  })

  if (!profile) return null

  const neighborhoodLabel =
    profile.neighborhoodRef?.name ?? profile.neighborhood ?? null

  const cityPros = await prisma.professionalProfile.findMany({
    where: { deletedAt: null, city: { equals: profile.city, mode: "insensitive" } },
    select: { id: true, trustScore: true },
    orderBy: { trustScore: "desc" },
  })

  const cityRankIdx = cityPros.findIndex((p) => p.id === professionalId)
  const rankInCity = cityRankIdx >= 0 ? cityRankIdx + 1 : null

  let rankInNeighborhood: number | null = null
  let totalInNeighborhood = 0

  if (profile.neighborhoodId || profile.neighborhood) {
    const nbFilter = profile.neighborhoodId
      ? { neighborhoodId: profile.neighborhoodId }
      : {
          neighborhood: { equals: profile.neighborhood!, mode: "insensitive" as const },
          city: { equals: profile.city, mode: "insensitive" as const },
        }

    const nbPros = await prisma.professionalProfile.findMany({
      where: { deletedAt: null, ...nbFilter },
      select: { id: true, trustScore: true },
      orderBy: { trustScore: "desc" },
    })

    totalInNeighborhood = nbPros.length
    const idx = nbPros.findIndex((p) => p.id === professionalId)
    rankInNeighborhood = idx >= 0 ? idx + 1 : null
  }

  return {
    neighborhood:       neighborhoodLabel,
    region:             profile.regionRef?.name ?? null,
    city:               profile.city,
    state:              profile.state,
    rankInNeighborhood,
    rankInCity:         rankInCity,
    totalInNeighborhood,
    totalInCity:        cityPros.length,
  }
}

// ── CRUD territorial ──────────────────────────────────────────────────────────

export async function createRegion(data: CreateRegionInput) {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  const slug = data.slug?.trim() || slugifyTerritory(data.name)
  return regionDelegate.create({
    data: {
      city:  data.city.trim(),
      state: data.state.trim(),
      name:  data.name.trim(),
      slug,
    },
  })
}

export async function updateRegion(id: string, data: UpdateRegionInput) {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  return regionDelegate.update({
    where: { id },
    data: {
      ...(data.city !== undefined && { city: data.city.trim() }),
      ...(data.state !== undefined && { state: data.state.trim() }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.slug !== undefined && { slug: data.slug.trim() }),
    },
  })
}

export async function createNeighborhood(data: CreateNeighborhoodInput) {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  const slug = data.slug?.trim() || slugifyTerritory(data.name)
  return neighborhoodDelegate.create({
    data: {
      city:     data.city.trim(),
      state:    data.state.trim(),
      name:     data.name.trim(),
      slug,
      regionId: data.regionId ?? null,
    },
  })
}

export async function updateNeighborhood(id: string, data: UpdateNeighborhoodInput) {
  const neighborhoodDelegate = getNeighborhoodDelegate()
  if (!neighborhoodDelegate) throw new Error(GROWTH_DELEGATE_UNAVAILABLE)

  return neighborhoodDelegate.update({
    where: { id },
    data: {
      ...(data.city !== undefined && { city: data.city.trim() }),
      ...(data.state !== undefined && { state: data.state.trim() }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.slug !== undefined && { slug: data.slug.trim() }),
      ...(data.regionId !== undefined && { regionId: data.regionId }),
    },
  })
}

export async function listRegionsForSelect() {
  const regionDelegate = getRegionDelegate()
  if (!regionDelegate) return []

  return regionDelegate.findMany({
    select: { id: true, name: true, city: true, state: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  })
}
