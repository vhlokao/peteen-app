import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getProfessionalPublicProfileAction } from "@/modules/professional/application/actions"
import { PublicPageBackLink } from "@/modules/partner-portal/components/public-page-back-link"
import { PublicAvailabilityCard } from "@/modules/professional-availability/components/public-availability-card"
import { getPublicAvailabilityForProfessional } from "@/modules/professional-availability/infrastructure/queries"
import { getProfessionalBadges } from "@/modules/badges/application/get-professional-badges"
import type { BadgeResolverResult } from "@/modules/badges/domain/types"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state"
import { getPublicReviewsForProfessionalAction } from "@/modules/review/application/actions"
import { getMyPetsAction } from "@/modules/pets/application/actions"
import { calculateTrustScore } from "@/modules/trust-engine/application/calculate-trust-score"
import {
  getRelationshipAnalyticsAction,
  getMyRelationshipWithProfessional,
} from "@/modules/relationship/application/actions"
import { getPartnerEndorsementsForProfessional } from "@/modules/partners/application/get-partner-endorsements"
import type { PartnerEndorsement } from "@/modules/partners/domain/types"
import { getPublicTrustState } from "@/modules/trust-engine/domain/public-trust-display"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { ReviewCard } from "@/components/shared/cards/ReviewCard"
import { BadgeList } from "@/components/shared/badges/BadgeList"
import { RequestServiceSheet } from "@/modules/service-request/components/RequestServiceSheet"
import { ProfessionalProfileHero } from "@/components/professional-profile/ProfessionalProfileHero"
import { ProfessionalProfileTrustCard } from "@/components/professional-profile/ProfessionalProfileTrustCard"
import { ProfessionalServicesList } from "@/components/professional-profile/ProfessionalServicesList"
import { ProfessionalHistorySummary } from "@/components/professional-profile/ProfessionalHistorySummary"
import { ProfessionalStickyCTA } from "@/components/professional-profile/ProfessionalStickyCTA"

type ProfilePageProps = {
  params: Promise<{ professionalId: string }>
  searchParams: Promise<{ from?: string; returnTo?: string }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { professionalId } = await params
  const result = await getProfessionalPublicProfileAction(professionalId)
  if (!result.success) return { title: "Profissional" }
  return { title: result.data.displayName }
}

/**
 * /discover/[professionalId] — Perfil público do profissional (UX 3.5 mobile-first).
 *
 * Server Component: busca perfil, reviews e pets do tutor em paralelo —
 * a mesma estratégia de fetch da versão anterior, só a apresentação mudou.
 *
 * Confiança nunca aparece como número bruto: TrustStateChip é chamado sem
 * trustScore (ver ProfessionalProfileTrustCard), e o breakdown técnico do
 * Trust Engine (trust.breakdown) — que o próprio domínio documenta como
 * "contadores auxiliares para o painel de debug" — não é renderizado aqui.
 *
 * RequestServiceSheet é reaproveitado sem alteração — mesma Server Action,
 * mesma rota de destino pós-envio. Só o container visual ao redor mudou:
 * barra fixa acima do BottomNav no mobile, card lateral fixo no desktop.
 */
export default async function ProfessionalProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { professionalId } = await params
  const query = await searchParams

  const [profileResult, reviewsResult, petsResult, trustResult, analyticsResult, myRelationship] =
    await Promise.all([
      getProfessionalPublicProfileAction(professionalId),
      getPublicReviewsForProfessionalAction(professionalId, { limit: 5 }),
      getMyPetsAction(),
      calculateTrustScore(professionalId),
      getRelationshipAnalyticsAction(professionalId),
      getMyRelationshipWithProfessional(professionalId),
    ])

  const [badgesResult, partnerEndorsements, availabilityDays] = await Promise.all([
    getProfessionalBadges(professionalId).catch(
      (): BadgeResolverResult => ({ badges: [], verifications: [] })
    ),
    getPartnerEndorsementsForProfessional(professionalId).catch(
      (): PartnerEndorsement[] => []
    ),
    getPublicAvailabilityForProfessional(professionalId).catch(() => []),
  ])

  if (!profileResult.success || !profileResult.data) {
    notFound()
  }

  const profile = profileResult.data
  const reviews = reviewsResult.success ? reviewsResult.data : []
  const pets = petsResult.success ? petsResult.data : []
  const trust = trustResult
  const analytics = analyticsResult.success ? analyticsResult.data : null
  const verificationActive = isProfessionalVerificationActive(profile)

  const totalReviews = profile.reviewCount
  const averageRating = profile.averageRating
  const myRelationshipCompleted = myRelationship?.completedServices
  const primaryService = profile.serviceTypes[0] ?? null

  const trustState = getPublicTrustState(trust.score, trust.level, {
    reviewCount: totalReviews,
    isVerified: verificationActive,
    hasPartnerEndorsement: partnerEndorsements.length > 0,
    completedCount: trust.meta.totalCompletedRequests,
    recurringClientsCount: analytics?.totalRelationships ?? 0,
  })

  const requestServiceProfessional = {
    id: profile.id,
    displayName: profile.displayName,
    services: profile.services,
  }

  const hasLegacyBadges =
    badgesResult.badges.length > 0 ||
    badgesResult.verifications.some((v) => v.active && !v.internalOnly)

  return (
    <div className="page-container max-w-5xl pb-28 lg:pb-10">
      <PublicPageBackLink
        searchParams={query}
        fallbackHref="/discover"
        fallbackLabel="Voltar à busca"
      />

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        {/* ── Coluna principal ─────────────────────────────────────────── */}
        <div className="min-w-0">
          <ProfessionalProfileHero
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl}
            city={profile.city}
            state={profile.state}
            primaryService={primaryService}
            isVerified={verificationActive}
          />

          {/* Confiança — visível também no mobile antes do CTA desktop-only aparecer */}
          <div className="lg:hidden">
            <ProfessionalProfileTrustCard
              professionalId={professionalId}
              trustState={trustState}
              trustLevel={trust.level}
              viewerRelationshipCompletedServices={myRelationshipCompleted}
              partnerEndorsements={partnerEndorsements}
            />
          </div>

          {/* Sobre */}
          <section className="mb-5 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sobre {profile.displayName.split(" ")[0]}
            </h2>
            <p className="text-sm leading-relaxed text-foreground">
              {profile.bio || "Este profissional ainda não adicionou uma descrição."}
            </p>
          </section>

          {hasLegacyBadges && (
            <section className="mb-5 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
              <BadgeList badges={badgesResult.badges} verifications={badgesResult.verifications} />
            </section>
          )}

          <ProfessionalHistorySummary
            displayName={profile.displayName}
            myRelationship={myRelationship}
            analytics={analytics}
          />

          {/* Serviços */}
          <section className="mb-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Serviços
            </h2>
            <ProfessionalServicesList services={profile.services} />
          </section>

          <div className="mb-5">
            <PublicAvailabilityCard days={availabilityDays} />
          </div>

          {/* Avaliações */}
          <section className="mb-6">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Avaliações
                {averageRating !== null && totalReviews > 0 && (
                  <span className="ml-2 font-normal normal-case text-foreground">
                    {averageRating.toFixed(1)} · {totalReviews}{" "}
                    {totalReviews !== 1 ? "avaliações" : "avaliação"}
                  </span>
                )}
              </h2>
              {totalReviews > reviews.length && (
                <span className="text-xs text-muted-foreground">
                  Exibindo {reviews.length} de {totalReviews}
                </span>
              )}
            </div>

            {reviews.length === 0 ? (
              <EmptyState
                title="Ainda sem avaliações"
                description="Este profissional ainda está construindo seu histórico de avaliações."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Coluna lateral (desktop) ─────────────────────────────────── */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:space-y-5">
          <ProfessionalProfileTrustCard
            professionalId={professionalId}
            trustState={trustState}
            trustLevel={trust.level}
            viewerRelationshipCompletedServices={myRelationshipCompleted}
            partnerEndorsements={partnerEndorsements}
          />
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
            <RequestServiceSheet professional={requestServiceProfessional} pets={pets} />
          </div>
        </aside>
      </div>

      {/* CTA fixo — mobile apenas (desktop usa o card lateral acima) */}
      <ProfessionalStickyCTA professional={requestServiceProfessional} pets={pets} />
    </div>
  )
}
