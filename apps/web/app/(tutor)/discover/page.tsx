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
import { getProfessionalReputationBadgesBatch } from "@/modules/reputation-badges/application/get-reputation"
import type { ReputationBadge } from "@/modules/reputation-badges/domain/types"
import { getPartnerEndorsementsBatch } from "@/modules/partners/application/get-partner-endorsements"
import { getRecommendations } from "@/modules/recommendation/application/get-recommendations"
import { getLocalDiscoveryContextAction } from "@/modules/growth-engine/application/actions"
import { ProfessionalDiscoveryCard } from "@/components/discovery/ProfessionalDiscoveryCard"
import { RecommendationSection } from "@/components/discovery/RecommendationSection"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { CitySearchInput } from "@/components/discovery/CitySearchInput"
import { DiscoverServiceChips } from "@/components/discovery/DiscoverServiceChips"

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
 * /discover — Descoberta de profissionais confiáveis (UX 3.4 mobile-first).
 *
 * Princípio de design: a tela prioriza confiança, contexto e reputação — não
 * preço. Nenhum score bruto de confiança é exibido (ver
 * ProfessionalDiscoveryCard, que chama TrustStateChip sem a prop trustScore).
 *
 * Estratégia de busca: searchParams + RSC (sem React Query, sem client-side
 * fetch). A URL é a única fonte de verdade dos filtros ativos — inalterada
 * nesta etapa (city + serviceType). Nenhum sort real existe no backend hoje
 * (a ordem já vem do Ranking Engine); por isso não foi adicionado controle
 * de ordenação — ver relatório da missão UX 3.4.
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

  const tutorCityForRec = cleanCity || tutorProfile?.city || null
  const tutorNeighborhood = tutorProfile?.neighborhood ?? null
  const tutorRegionId = tutorProfile?.regionId ?? null
  const tutorNeighborhoodId = tutorProfile?.neighborhoodId ?? null

  // ── 3a. Relacionamentos pessoais do tutor + endorsements ──────────────────
  // Uma query por tipo de dado — nenhuma N+1.
  const [myRelMap, partnerEndorsementsMap] = await Promise.all([
    tutorProfile && professionals.length > 0
      ? getMyRelationshipsForProfessionals(tutorProfile.id, professionalIds)
      : Promise.resolve(new Map<string, number>()),
    professionals.length > 0
      ? getPartnerEndorsementsBatch(professionalIds)
      : Promise.resolve(new Map()),
  ])

  const reputationBadgesMap =
    professionals.length > 0
      ? await getProfessionalReputationBadgesBatch(professionalIds, myRelMap)
      : new Map<string, ReputationBadge[]>()

  // ── 3b. Recomendações + contexto local Growth Engine ──────────────────────
  const [recommendationBlocks, localContext] = await Promise.all([
    ctx.authenticated
      ? getRecommendations(
          {
            tutorCity: tutorCityForRec,
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
      city: hasCity ? cleanCity : (tutorProfile?.city ?? null),
      neighborhood: tutorNeighborhood,
      neighborhoodId: tutorNeighborhoodId,
      regionId: tutorRegionId,
    }),
  ])

  return (
    <div className="page-container pb-4">
      {/* Header */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Encontre cuidado confiável
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque profissionais para cuidar do seu pet com mais segurança.
        </p>
      </header>

      {/* Busca principal — CitySearchInput preservado sem alteração */}
      <div className="mb-4 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        <CitySearchInput defaultValue={cleanCity} />
      </div>

      {/* Chips de serviço — sempre visíveis, escrevem serviceType na URL */}
      <div className="mb-5">
        <DiscoverServiceChips activeValue={cleanServiceType} />
      </div>

      {hasActiveFilters && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {hasCity ? (
              professionals.length > 0 ? (
                <>
                  <strong className="text-foreground">{professionals.length}</strong>{" "}
                  {professionals.length !== 1 ? "profissionais" : "profissional"} em{" "}
                  <strong className="text-foreground">{cleanCity}</strong>
                  {hasServiceType && (
                    <>
                      {" "}
                      ·{" "}
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
                </>
              )
            ) : (
              <>
                Filtrando por{" "}
                <strong className="text-foreground">
                  {SERVICE_TYPE_LABELS[cleanServiceType as ServiceType]}
                </strong>{" "}
                — digite uma cidade para ver os resultados
              </>
            )}
          </p>
          <Link
            href="/discover"
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Limpar filtros
          </Link>
        </div>
      )}

      {/* Contexto local — Growth Engine 6.0 (preservado) */}
      {localContext.messages.length > 0 && (
        <div className="mb-5 space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          {localContext.messages.map((msg) => (
            <p key={msg} className="text-sm text-foreground">
              {msg}
            </p>
          ))}
        </div>
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
          description="Tente mudar o tipo de cuidado ou buscar por outra região."
          action={{ label: "Limpar filtros", href: "/discover" }}
        />
      )}

      {/* Lista de profissionais */}
      {professionals.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro) => {
            const reputationBadges = reputationBadgesMap.get(pro.id) ?? []
            const verificationActive = isProfessionalVerificationActive(pro)
            const partnerEndorsementsList = partnerEndorsementsMap.get(pro.id) ?? []
            return (
              <ProfessionalDiscoveryCard
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
                reputationBadges={reputationBadges}
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
              ? "mt-9 border-t border-border pt-7"
              : "mt-6"
          }
        >
          <RecommendationSection blocks={recommendationBlocks} />
        </div>
      )}
    </div>
  )
}
