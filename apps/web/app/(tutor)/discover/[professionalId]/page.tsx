import type { Metadata } from "next"
import { Check } from "lucide-react"
import { notFound } from "next/navigation"

import { getProfessionalPublicProfileAction } from "@/modules/professional/application/actions"
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
import { BackButton } from "./BackButton"
import { ShareButton } from "./ShareButton"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"

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
 * /discover/[professionalId] — Perfil público do profissional (reskin visual).
 *
 * Server Component: busca perfil, reviews e pets do tutor em paralelo —
 * mesma estratégia de fetch de sempre, só a apresentação mudou.
 *
 * Confiança nunca aparece como número bruto: TrustStateChip é chamado sem
 * trustScore (ver ProfessionalProfileTrustCard), e o breakdown técnico do
 * Trust Engine (trust.breakdown) não é renderizado aqui.
 *
 * RequestServiceSheet é reaproveitado sem alteração — mesma Server Action,
 * mesma rota de destino pós-envio. Só o container visual ao redor mudou:
 * barra fixa acima do BottomNav no mobile, card lateral fixo no desktop.
 *
 * O botão Voltar usa BackButton (novo), que reaproveita
 * resolvePublicPageBackLink — a mesma resolução contextual real via
 * from/returnTo (ex.: parceiro/profissional voltando pro próprio portal).
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
    <div className="pb-28 lg:pb-10">
      <div className="lg:mx-auto lg:max-w-5xl lg:px-[var(--page-padding-x)] lg:pt-6">
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
          {/* ── Coluna principal ─────────────────────────────────────────── */}
          <div className="min-w-0">
            {/* Capa navy — voltar, compartilhar, identidade, confiança */}
            <div
              className="relative overflow-hidden px-[var(--page-padding-x)] pb-7 pt-4 lg:rounded-[28px] lg:px-6 lg:pt-6"
              style={{ background: NAVY }}
            >
              <span className="pointer-events-none absolute -right-[50px] -top-[70px] size-[190px] rounded-full bg-[#6EC6FF]/[.13]" />
              <span className="pointer-events-none absolute -bottom-[60px] -left-[40px] size-[150px] rounded-full bg-[#E07A5F]/[.15]" />

              <div className="relative mb-5 flex items-center justify-between">
                <BackButton searchParams={query} fallbackHref="/discover" />
                <ShareButton />
              </div>

              <div className="relative">
                <ProfessionalProfileHero
                  displayName={profile.displayName}
                  avatarUrl={profile.avatarUrl}
                  city={profile.city}
                  state={profile.state}
                  primaryService={primaryService}
                  isVerified={verificationActive}
                />
              </div>

              {/* Confiança — dentro da capa no mobile; desktop usa a versão da sidebar */}
              <div className="relative mt-4 lg:hidden">
                <ProfessionalProfileTrustCard
                  professionalId={professionalId}
                  trustState={trustState}
                  trustLevel={trust.level}
                  viewerRelationshipCompletedServices={myRelationshipCompleted}
                  partnerEndorsements={partnerEndorsements}
                  tone="cover"
                />
              </div>
            </div>

            <div className="px-[var(--page-padding-x)] pt-5 lg:px-0">
              {/* Histórico/recorrência — sinais humanos, "stats" reais */}
              <ProfessionalHistorySummary
                displayName={profile.displayName}
                myRelationship={myRelationship}
                analytics={analytics}
              />

              {/* Sobre */}
              <section className="mb-5 rounded-[15px] border border-border/70 bg-card p-5">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Sobre {profile.displayName.split(" ")[0]}
                </h2>
                <p className="text-sm leading-relaxed text-foreground">
                  {profile.bio || "Este profissional ainda não adicionou uma descrição."}
                </p>
              </section>

              {/* Verificado — selo público explícito (nunca expõe verifiedIdentity) */}
              {verificationActive && (
                <div className="mb-5 flex flex-wrap gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ color: GREEN, background: "#E7F1EC" }}
                  >
                    <Check className="size-3" />
                    Verificado
                  </span>
                </div>
              )}

              {hasLegacyBadges && (
                <section className="mb-5 rounded-[15px] border border-border/70 bg-card p-5">
                  <BadgeList badges={badgesResult.badges} verifications={badgesResult.verifications} />
                </section>
              )}

              {/* Serviços */}
              <section className="mb-5">
                <h2 className="mb-3 text-[15.5px] font-extrabold tracking-[-0.01em] text-foreground">
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
                  <h2 className="text-[15.5px] font-extrabold tracking-[-0.01em] text-foreground">
                    Avaliações
                    {averageRating !== null && totalReviews > 0 && (
                      <span className="ml-2 text-[13px] font-semibold text-muted-foreground">
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
          </div>

          {/* ── Coluna lateral (desktop) ─────────────────────────────────── */}
          <aside className="hidden px-[var(--page-padding-x)] lg:sticky lg:top-20 lg:block lg:space-y-5 lg:px-0">
            <ProfessionalProfileTrustCard
              professionalId={professionalId}
              trustState={trustState}
              trustLevel={trust.level}
              viewerRelationshipCompletedServices={myRelationshipCompleted}
              partnerEndorsements={partnerEndorsements}
              tone="card"
            />
            <div className="rounded-[15px] border border-border/70 bg-card p-5">
              <RequestServiceSheet professional={requestServiceProfessional} pets={pets} />
            </div>
          </aside>
        </div>
      </div>

      {/* CTA fixo — mobile apenas (desktop usa o card lateral acima) */}
      <ProfessionalStickyCTA professional={requestServiceProfessional} pets={pets} />
    </div>
  )
}
