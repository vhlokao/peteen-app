/**
 * Módulo: professional
 * Camada: infrastructure
 *
 * Responsabilidade: I/O com o banco via Prisma.
 * Regras:
 *   - Sem lógica de negócio — apenas leitura e escrita
 *   - Sem verificação de autenticação — responsabilidade da camada application
 *   - Retorna tipos de domínio, não tipos brutos do Prisma
 *   - trustScore e trustLevel NUNCA são escritos aqui (gerenciados pelo Trust Engine)
 *
 * Ponto de extensão do Ranking Engine:
 *   `findPublicProfessionals` é o ponto onde o Ranking Engine da Fase 4
 *   substituirá a query simples por um algoritmo contextual ponderado.
 *   A assinatura da função permanece a mesma — apenas a implementação muda.
 */

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma/client"
import type {
  ProfessionalProfileData,
  ProfessionalPublicProfile,
  ServiceData,
  CreateProfessionalProfileInput,
  UpdateProfessionalProfileInput,
  CreateServiceInput,
  UpdateServiceInput,
  FindProfessionalsInput,
  ServiceType,
  TrustLevel,
  PlanType,
} from "../domain/types"

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export async function createProfessionalProfileRecord(
  userId: string,
  input: CreateProfessionalProfileInput
): Promise<ProfessionalProfileData> {
  const result = await prisma.professionalProfile.create({
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
      avatarUrl: input.avatarUrl?.trim() || null,
      serviceRadiusKm: input.serviceRadiusKm ?? undefined,
      serviceTypes: input.serviceTypes,
      specializations: input.specializations ?? [],
      // trustScore e trustLevel iniciados nos defaults do schema (0, INITIAL)
      // Nunca definidos explicitamente — são domínio do Trust Engine
    },
  })
  return mapToDomain(result)
}

export async function findProfessionalProfileByUserId(
  userId: string
): Promise<ProfessionalProfileData | null> {
  const result = await prisma.professionalProfile.findUnique({
    where: { userId },
  })
  return result ? mapToDomain(result) : null
}

export async function findProfessionalProfileById(
  id: string
): Promise<ProfessionalProfileData | null> {
  const result = await prisma.professionalProfile.findUnique({
    where: { id },
  })
  return result ? mapToDomain(result) : null
}

export async function updateProfessionalProfileRecord(
  id: string,
  input: UpdateProfessionalProfileInput
): Promise<ProfessionalProfileData> {
  const result = await prisma.professionalProfile.update({
    where: { id },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.bio !== undefined && { bio: input.bio ?? null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.neighborhood !== undefined && { neighborhood: input.neighborhood ?? null }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.state !== undefined && { state: input.state }),
      ...(input.lat !== undefined && { lat: input.lat ?? null }),
      ...(input.lng !== undefined && { lng: input.lng ?? null }),
      ...(input.avatarUrl !== undefined && {
        avatarUrl: input.avatarUrl?.trim() || null,
      }),
      ...(input.serviceRadiusKm !== undefined && {
        serviceRadiusKm: input.serviceRadiusKm ?? null,
      }),
      ...(input.serviceTypes !== undefined && { serviceTypes: input.serviceTypes }),
      ...(input.specializations !== undefined && { specializations: input.specializations }),
      // trustScore, trustLevel, isVerified: NUNCA atualizados aqui
    },
  })
  return mapToDomain(result)
}

export async function softDeleteProfessionalProfile(id: string): Promise<void> {
  await prisma.professionalProfile.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY — busca pública de profissionais
//
// FASE 3: Ordena por trustScore DESC como aproximação do ranking.
//
// FASE 4 (Ranking Engine):
//   Esta função será substituída por RankingEngine.query(filters, petContext)
//   que considerará:
//     - decay temporal do trustScore
//     - relevância contextual (espécie, especialização, necessidades especiais)
//     - densidade local (profissionais na mesma cidade/bairro)
//     - recorrência com o tutor solicitante (se autenticado)
//   A assinatura pública não muda — apenas a implementação interna.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Review aggregation helper
//
// Agrega reviewCount e averageRating em tempo real a partir da tabela Review,
// sem depender do campo denormalizado ProfessionalProfile.trustScore.
// O campo trustScore é domínio exclusivo do Trust Engine (Fase 5) e pode
// divergir do rating médio real enquanto o engine não estiver ativo.
// ─────────────────────────────────────────────────────────────────────────────

type ReviewStat = {
  professionalId: string
  reviewCount: number
  averageRating: number | null
}

async function fetchReviewStats(professionalIds: string[]): Promise<Map<string, ReviewStat>> {
  if (professionalIds.length === 0) return new Map()

  try {
    // Tabelas mapeadas via @@map no schema:
    //   Review         → "reviews"
    //   ServiceRequest → "service_requests"
    // Colunas sem @map individual mantêm o nome camelCase do schema Prisma.
    const rows = await prisma.$queryRaw<ReviewStat[]>`
      SELECT
        sr."professionalId",
        COUNT(r.id)::int     AS "reviewCount",
        AVG(r.rating)::float AS "averageRating"
      FROM reviews r
      JOIN service_requests sr ON sr.id = r."requestId"
      WHERE sr."professionalId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(professionalIds)}]::text[]`})
        AND r."isVisible" = true
        AND r."isFlagged" = false
      GROUP BY sr."professionalId"
    `

    const map = new Map<string, ReviewStat>()
    for (const row of rows) {
      map.set(row.professionalId, {
        professionalId: row.professionalId,
        reviewCount: Number(row.reviewCount),
        averageRating: row.averageRating != null ? Number(row.averageRating) : null,
      })
    }
    return map
  } catch (err) {
    // Falha silenciosa: profissionais ainda aparecem na lista com reviewCount = 0
    // Erro é logado para diagnóstico mas não quebra o Discovery
    console.error("[fetchReviewStats]", err)
    return new Map()
  }
}

export async function findPublicProfessionals(
  filters: FindProfessionalsInput
): Promise<ProfessionalPublicProfile[]> {
  const results = await prisma.professionalProfile.findMany({
    where: {
      deletedAt: null,
      city: { equals: filters.city, mode: "insensitive" },
      ...(filters.serviceType
        ? { serviceTypes: { has: filters.serviceType } }
        : {}),
    },
    include: {
      services: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          serviceType: true,
          priceMin: true,
          priceMax: true,
        },
      },
    },
    // FASE 3: trustScore DESC como proxy de ranking
    // FASE 4: substituir por RankingEngine.query()
    orderBy: { trustScore: "desc" },
    take: filters.limit,
    skip: filters.offset,
  })

  const statsMap = await fetchReviewStats(results.map((r) => r.id))

  return results.map((r) => {
    const stat = statsMap.get(r.id)
    return {
      id: r.id,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      bio: r.bio,
      neighborhood: r.neighborhood,
      city: r.city,
      state: r.state,
      lat: r.lat,
      lng: r.lng,
      serviceRadiusKm: r.serviceRadiusKm,
      serviceTypes: r.serviceTypes as ServiceType[],
      specializations: r.specializations,
      trustScore: r.trustScore,
      trustLevel: r.trustLevel as TrustLevel,
      isVerified: r.isVerified,
      verifiedIdentity: r.verifiedIdentity,
      verifiedAt: r.verifiedAt,
      planType: r.planType as PlanType,
      createdAt: r.createdAt,
      reviewCount: stat?.reviewCount ?? 0,
      averageRating: stat?.averageRating ?? null,
      services: r.services.map((s) => ({
        id: s.id,
        name: s.name,
        serviceType: s.serviceType as ServiceType,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
      })),
    }
  })
}

export async function findPublicProfessionalById(
  id: string
): Promise<ProfessionalPublicProfile | null> {
  const [result, statsMap] = await Promise.all([
    prisma.professionalProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            serviceType: true,
            priceMin: true,
            priceMax: true,
          },
        },
      },
    }),
    fetchReviewStats([id]),
  ])

  if (!result) return null

  const stat = statsMap.get(id)

  return {
    id: result.id,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    bio: result.bio,
    neighborhood: result.neighborhood,
    city: result.city,
    state: result.state,
    lat: result.lat,
    lng: result.lng,
    serviceRadiusKm: result.serviceRadiusKm,
    serviceTypes: result.serviceTypes as ServiceType[],
    specializations: result.specializations,
    trustScore: result.trustScore,
    trustLevel: result.trustLevel as TrustLevel,
    isVerified: result.isVerified,
    verifiedIdentity: result.verifiedIdentity,
    verifiedAt: result.verifiedAt,
    planType: result.planType as PlanType,
    createdAt: result.createdAt,
    reviewCount: stat?.reviewCount ?? 0,
    averageRating: stat?.averageRating ?? null,
    services: result.services.map((s) => ({
      id: s.id,
      name: s.name,
      serviceType: s.serviceType as ServiceType,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES (catálogo do profissional)
// ─────────────────────────────────────────────────────────────────────────────

export async function createServiceRecord(
  professionalId: string,
  input: CreateServiceInput
): Promise<ServiceData> {
  return prisma.service.create({
    data: {
      professionalId,
      name: input.name,
      description: input.description ?? null,
      serviceType: input.serviceType,
      priceMin: input.priceMin ?? null,
      priceMax: input.priceMax ?? null,
      isActive: true,
    },
  }) as Promise<ServiceData>
}

export async function findServicesByProfessionalId(
  professionalId: string,
  options?: { activeOnly?: boolean }
): Promise<ServiceData[]> {
  return prisma.service.findMany({
    where: {
      professionalId,
      ...(options?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: { createdAt: "asc" },
  }) as Promise<ServiceData[]>
}

export async function findServiceById(id: string): Promise<ServiceData | null> {
  return prisma.service.findUnique({ where: { id } }) as Promise<ServiceData | null>
}

/**
 * Busca serviço com validação de ownership embutida.
 * Retorna null se o serviço não pertence ao profissional.
 */
export async function findServiceByIdAndProfessionalId(
  id: string,
  professionalId: string
): Promise<ServiceData | null> {
  return prisma.service.findFirst({
    where: { id, professionalId },
  }) as Promise<ServiceData | null>
}

export async function updateServiceRecord(
  id: string,
  input: UpdateServiceInput
): Promise<ServiceData> {
  return prisma.service.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.serviceType !== undefined && { serviceType: input.serviceType }),
      ...(input.priceMin !== undefined && { priceMin: input.priceMin ?? null }),
      ...(input.priceMax !== undefined && { priceMax: input.priceMax ?? null }),
    },
  }) as Promise<ServiceData>
}

export async function deactivateServiceRecord(id: string): Promise<ServiceData> {
  return prisma.service.update({
    where: { id },
    data: { isActive: false },
  }) as Promise<ServiceData>
}

export async function reactivateServiceRecord(id: string): Promise<ServiceData> {
  return prisma.service.update({
    where: { id },
    data: { isActive: true },
  }) as Promise<ServiceData>
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function mapToDomain(record: {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  phone: string | null
  neighborhood: string | null
  city: string
  state: string
  lat: number | null
  lng: number | null
  serviceRadiusKm: number | null
  serviceTypes: string[]
  specializations: string[]
  trustScore: number
  trustLevel: string
  isVerified: boolean
  verifiedAt: Date | null
  verifiedIdentity: boolean
  planType: string
  planExpiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): ProfessionalProfileData {
  return {
    ...record,
    serviceTypes: record.serviceTypes as ServiceType[],
    trustLevel: record.trustLevel as TrustLevel,
    planType: record.planType as PlanType,
  }
}
