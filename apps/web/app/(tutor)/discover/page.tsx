import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Search } from "lucide-react"

import { findProfessionalsAction } from "@/modules/professional/application/actions"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { rankProfessionals } from "@/modules/ranking/application/rank-professionals"
import { getAuthContext } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { countActivePetsByTutorId } from "@/modules/pets/infrastructure/repository"
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
import { normalizeCityName } from "@/modules/location"

export const metadata: Metadata = {
  title: "Descobrir profissionais",
}

type DiscoverPageProps = {
  searchParams: Promise<{
    city?: string
    serviceType?: string
    neighborhood?: string
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
  const { city, serviceType, neighborhood } = await searchParams

  const cleanCity = city?.trim() ?? ""
  const cleanServiceType = serviceType?.trim() ?? ""
  const cleanNeighborhood = neighborhood?.trim() ?? ""

  const hasCity = cleanCity.length >= 2
  const hasServiceType = cleanServiceType.length > 0
  // Mesmo mínimo de FindProfessionalsSchema.neighborhood (min(2)) — evita
  // mandar 1 caractere pra Zod rejeitar silenciosamente lá na frente.
  const hasNeighborhood = cleanNeighborhood.length >= 2

  // ── 1. Contexto de auth + perfil do tutor (sequencial, antes da busca) ───
  // Precisa existir ANTES da busca porque agora decide o filtro efetivo, não
  // só o rótulo/ranking (ver bloco de effectiveCity abaixo).
  const ctx = await getAuthContext()
  const tutorProfile = ctx.authenticated
    ? await findTutorProfileByUserId(ctx.user.id)
    : null

  // ── Default Discovery na cidade do tutor ──────────────────────────────────
  // effectiveCity = cidade explícita (searchParams) OU a cidade do perfil do
  // tutor. Sem nenhuma das duas (anônimo, ou "Todas as cidades" — nenhum
  // tutor hoje tem city vazia, campo obrigatório no schema e no Zod), a busca
  // roda sem filtro de cidade — findPublicProfessionals já trata city ausente
  // como "sem restrição". Nenhuma normalização acontece aqui: a action já
  // normaliza qualquer string recebida (explícita ou o city do perfil, que já
  // está normalizado desde a escrita) — nunca duplicar a regra no client.
  const effectiveCity = cleanCity || tutorProfile?.city || undefined
  const hasEffectiveCity = Boolean(effectiveCity)

  // Só para exibição — reflete o filtro que REALMENTE está em vigor
  // (explícito ou default do perfil), nunca o texto bruto da URL sozinho.
  const displayCity = normalizeCityName(effectiveCity ?? "") ?? effectiveCity ?? cleanCity

  // tutorCity mantém o nome histórico (consumido por getRecommendations,
  // getLocalDiscoveryContextAction, rankProfessionals) — mesmo valor de
  // effectiveCity, sem duplicar a conta.
  const tutorCity = effectiveCity
  const tutorNeighborhood = tutorProfile?.neighborhood ?? null

  // `neighborhood` aqui é o filtro EXPLÍCITO da URL — distinto de
  // `tutorNeighborhood` (perfil do tutor), que nunca filtrou a query, só
  // alimenta locationLabel/ranking. Antes desta correção, `neighborhood` na
  // URL não era lido pela página: o Client Component já limpava esse param
  // ao trocar de cidade (CitySearchInput), mas o Server Component nunca o
  // repassava para a busca — o filtro existia na action/query e nos testes,
  // mas nunca era alcançável a partir de /discover.
  const result = await findProfessionalsAction({
    city: effectiveCity,
    serviceType: hasServiceType ? (cleanServiceType as ServiceType) : undefined,
    neighborhood: hasNeighborhood ? cleanNeighborhood : undefined,
    tutorCity,
    tutorNeighborhood: tutorNeighborhood ?? undefined,
    limit: 20,
    offset: 0,
  })

  const candidates = result.success ? result.data : []

  // rankProfessionals já expõe relationshipStats (público) de cada profissional.
  const professionals =
    candidates.length > 0
      ? await rankProfessionals(candidates, {
          serviceType: hasServiceType ? (cleanServiceType as ServiceType) : undefined,
          tutorCity,
          tutorNeighborhood: tutorNeighborhood ?? undefined,
        })
      : []

  // Gate: tutor precisa de ao menos 1 pet cadastrado para acessar o Discovery.
  // Reaproveita o tutorProfile já buscado — sem query extra de perfil.
  if (tutorProfile) {
    const petCount = await countActivePetsByTutorId(tutorProfile.id)
    if (petCount === 0) {
      redirect("/onboarding/tutor/pet")
    }
  }

  const professionalIds = professionals.map((p) => p.id)

  // Mesmo valor de tutorCity (já calculado acima com o fallback pro perfil),
  // só convertido pra null (em vez de undefined) — formato que
  // getRecommendations já espera.
  const tutorCityForRec = tutorCity ?? null
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
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-foreground">
          Encontre cuidado confiável
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Profissionais próximos, com confiança de verdade.
        </p>
      </header>

      {/* Busca principal — cidade + bairro opcional (Location Foundation V0) */}
      <div className="mb-4 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
        <CitySearchInput defaultValue={cleanCity} />
      </div>

      {/* Chips de serviço — sempre visíveis, escrevem serviceType na URL */}
      <div className="mb-5">
        <DiscoverServiceChips activeValue={cleanServiceType} />
      </div>

      {(hasEffectiveCity || hasServiceType) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {hasEffectiveCity ? (
              professionals.length > 0 ? (
                <>
                  <strong className="text-foreground">{professionals.length}</strong>{" "}
                  {professionals.length !== 1 ? "profissionais" : "profissional"} em{" "}
                  <strong className="text-foreground">
                    {displayCity}
                  </strong>
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
                  <strong className="text-foreground">
                    {displayCity}
                  </strong>
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
          {/* Só oferece "limpar" quando há algo EXPLÍCITO a limpar — clicar
              sem filtro explícito recarregaria a mesma busca (default do
              perfil continua valendo), então o link seria um no-op confuso.
              `neighborhood` conta como explícito igual a city/serviceType. */}
          {(hasCity || hasServiceType || hasNeighborhood) && (
            <Link
              href="/discover"
              className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Limpar filtros
            </Link>
          )}
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

      {/* Estado: com cidade (explícita ou default do perfil), sem resultados */}
      {hasEffectiveCity && professionals.length === 0 && (
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
                locationLabel={pro.locationLabel}
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
