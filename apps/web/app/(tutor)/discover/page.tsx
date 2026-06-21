import type { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"

import { findProfessionalsAction } from "@/modules/professional/application/actions"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { rankProfessionals } from "@/modules/ranking/application/rank-professionals"
import { getAuthContext } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { getMyRelationshipsForProfessionals } from "@/modules/relationship/infrastructure/repository"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import {
  getCompletedServicesMap,
  computeBadgesFromDiscoveryData,
} from "@/modules/badges/application/get-professional-badges"
import { getActiveConnectionsBatch } from "@/modules/trust-graph/infrastructure/repository"
import type { ActiveConnection } from "@/modules/trust-graph/domain/types"
import { getPartnerEndorsementsBatch } from "@/modules/partners/application/get-partner-endorsements"
import { getRecommendations } from "@/modules/recommendation/application/get-recommendations"
import { getLocalDiscoveryContextAction } from "@/modules/growth-engine/application/actions"
import { ProfessionalCard } from "@/components/shared/cards/ProfessionalCard"
import { RecommendationSection } from "@/components/discovery/RecommendationSection"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { CitySearchInput } from "@/components/discovery/CitySearchInput"
import { ServiceTypeSelect } from "@/components/discovery/ServiceTypeSelect"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = {
  title: "Descobrir profissionais",
}

type DiscoverPageProps = {
  searchParams: Promise<{
    city?: string
    serviceType?: string
  }>
}

/**
 * /discover — Descoberta de profissionais confiáveis.
 *
 * Princípio de design: a tela prioriza confiança, contexto e reputação — não preço.
 *
 * Estratégia de busca: searchParams + RSC (sem React Query, sem client-side fetch).
 * A URL é a única fonte de verdade dos filtros ativos.
 *
 * FASE 4 (Ranking Engine):
 *   `findProfessionalsAction` será substituído por `RankingEngine.query(filters, petContext)`.
 *   A assinatura do componente não muda — apenas a fonte de dados.
 */
export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const { city, serviceType } = await searchParams

  const cleanCity = city?.trim() ?? ""
  const cleanServiceType = serviceType?.trim() ?? ""

  const hasCity = cleanCity.length >= 2
  const hasServiceType = cleanServiceType.length > 0
  const hasActiveFilters = hasCity || hasServiceType

  // ── 1. Busca paralela: candidatos + contexto de auth ─────────────────────
  const [result, ctx] = await Promise.all([
    hasCity
      ? findProfessionalsAction({
          city: cleanCity,
          serviceType: hasServiceType ? (cleanServiceType as ServiceType) : undefined,
          limit: 20,
          offset: 0,
        })
      : Promise.resolve(null),
    getAuthContext(),
  ])

  const candidates = result?.success ? result.data : []

  // ── 2. Ranking contextual + perfil do tutor em paralelo ──────────────────
  // rankProfessionals já expõe relationshipStats (público) de cada profissional.
  // findTutorProfileByUserId identifica o tutor para buscar seus relacionamentos pessoais.
  const [professionals, tutorProfile] = await Promise.all([
    candidates.length > 0
      ? rankProfessionals(candidates, {
          serviceType: hasServiceType ? (cleanServiceType as ServiceType) : undefined,
        })
      : Promise.resolve([]),
    ctx.authenticated ? findTutorProfileByUserId(ctx.user.id) : Promise.resolve(null),
  ])

  const professionalIds = professionals.map((p) => p.id)

  const tutorCityForRec =
    cleanCity || tutorProfile?.city || null
  const tutorNeighborhood = tutorProfile?.neighborhood ?? null
  const tutorRegionId = tutorProfile?.regionId ?? null
  const tutorNeighborhoodId = tutorProfile?.neighborhoodId ?? null

  // ── 3a. Relacionamentos pessoais do tutor + completedServices (badges) + endorsements ─
  // Uma query por tipo de dado — nenhuma N+1.
  const [myRelMap, completedServicesMap, endorsementsMap, partnerEndorsementsMap] = await Promise.all([
    tutorProfile && professionals.length > 0
      ? getMyRelationshipsForProfessionals(tutorProfile.id, professionalIds)
      : Promise.resolve(new Map<string, number>()),
    professionals.length > 0
      ? getCompletedServicesMap(professionalIds)
      : Promise.resolve(new Map<string, number>()),
    professionals.length > 0
      ? getActiveConnectionsBatch(professionalIds)
      : Promise.resolve(new Map<string, ActiveConnection[]>()),
    professionals.length > 0
      ? getPartnerEndorsementsBatch(professionalIds)
      : Promise.resolve(new Map()),
  ])

  // ── 3b. Recomendações + contexto local Growth Engine ───────────────────────
  const [recommendationBlocks, localContext] = await Promise.all([
    ctx.authenticated
      ? getRecommendations(
          {
            tutorCity:            tutorCityForRec,
            tutorNeighborhood,
            tutorRegionId,
            tutorNeighborhoodId,
            requestedServiceType: hasServiceType ? (cleanServiceType as ServiceType) : null,
            myRelMap,
          },
          { limit: 4 }
        )
      : Promise.resolve([]),
    getLocalDiscoveryContextAction({
      city:           hasCity ? cleanCity : tutorProfile?.city ?? null,
      neighborhood:   tutorNeighborhood,
      neighborhoodId: tutorNeighborhoodId,
      regionId:       tutorRegionId,
    }),
  ])

  return (
    <div className="page-container">
      <PageHeader
        title="Descobrir"
        description="Encontre pessoas confiáveis para cuidar do seu pet."
      />

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Cidade
          </label>
          <CitySearchInput defaultValue={cleanCity} />
        </div>

        {hasCity && (
          <div className="w-full sm:w-52">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tipo de serviço
            </label>
            <ServiceTypeSelect defaultValue={cleanServiceType} />
          </div>
        )}

        {hasActiveFilters && (
          <Link
            href="/discover"
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Limpar filtros
          </Link>
        )}
      </div>

      {/* Contexto local — Growth Engine 6.0 */}
      {localContext.messages.length > 0 && (
        <div className="mb-4 space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          {localContext.messages.map((msg) => (
            <p key={msg} className="text-sm text-foreground">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* Filtro ativo: label informativo */}
      {hasCity && (
        <p className="mb-4 text-sm text-muted-foreground">
          {professionals.length > 0 ? (
            <>
              {professionals.length} profissional{professionals.length !== 1 ? "is" : ""} em{" "}
              <strong className="text-foreground">{cleanCity}</strong>
              {hasServiceType && (
                <>
                  {" "}
                  para{" "}
                  <strong className="text-foreground">
                    {SERVICE_TYPE_LABELS[cleanServiceType as ServiceType]}
                  </strong>
                </>
              )}
            </>
          ) : (
            <>
              Nenhum profissional encontrado em{" "}
              <strong className="text-foreground">{cleanCity}</strong>
              {hasServiceType && (
                <>
                  {" "}
                  para{" "}
                  <strong className="text-foreground">
                    {SERVICE_TYPE_LABELS[cleanServiceType as ServiceType]}
                  </strong>
                </>
              )}
            </>
          )}
        </p>
      )}

      {/* Estado: sem cidade */}
      {!hasCity && (
        <EmptyState
          icon={<Search className="size-7" />}
          title="Onde seu pet mora?"
          description="Digite sua cidade para encontrar profissionais confiáveis perto de você."
        />
      )}

      {/* Estado: com cidade, sem resultados */}
      {hasCity && professionals.length === 0 && (
        <EmptyState
          icon={<Search className="size-7" />}
          title="Nenhum profissional encontrado"
          description={
            hasServiceType
              ? "Tente remover o filtro de serviço ou buscar em outra cidade."
              : "Ainda não há profissionais cadastrados nessa cidade."
          }
          action={{ label: "Limpar filtros", href: "/discover" }}
        />
      )}

      {/* Lista de profissionais */}
      {professionals.length > 0 && (
        // FASE 5: substituir por RankingEngine.query()
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro) => {
            const completedServices   = completedServicesMap.get(pro.id) ?? 0
            const proConnections      = endorsementsMap.get(pro.id) ?? []
            const partnerEndorsements = proConnections.filter(
              (c) => c.connectionType === "PARTNER_RECOMMENDS_PROFESSIONAL"
            ).length
            const cardBadges = computeBadgesFromDiscoveryData({
              trustScore:          pro.trustScore,
              reviewCount:         pro.reviewCount,
              averageRating:       pro.averageRating,
              isVerified:          pro.isVerified,
              verifiedIdentity:    pro.verifiedIdentity,
              completedServices,
              partnerEndorsements,
            })
            const verificationActive = isProfessionalVerificationActive(pro)
            const partnerEndorsementsList = partnerEndorsementsMap.get(pro.id) ?? []
            return (
              <ProfessionalCard
                key={pro.id}
                id={pro.id}
                displayName={pro.displayName}
                avatarUrl={pro.avatarUrl}
                city={pro.city}
                state={pro.state}
                trustScore={pro.trustScore}
                trustLevel={pro.trustLevel}
                isVerified={verificationActive}
                serviceTypes={pro.serviceTypes}
                services={pro.services}
                reviewCount={pro.reviewCount}
                averageRating={pro.averageRating}
                myCompletedServices={myRelMap.get(pro.id)}
                recurringClientsCount={pro.relationshipStats.recurringClients}
                badges={cardBadges}
                partnerEndorsements={partnerEndorsementsList}
              />
            )
          })}
        </div>
      )}

      {/* Recomendações — visíveis para tutores autenticados */}
      {recommendationBlocks.length > 0 && (
        <div
          className={
            hasCity && professionals.length > 0
              ? "mt-8 border-t border-border pt-6"
              : "mt-6"
          }
        >
          <RecommendationSection blocks={recommendationBlocks} />
        </div>
      )}
    </div>
  )
}
