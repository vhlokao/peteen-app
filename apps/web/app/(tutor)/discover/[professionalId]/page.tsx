import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShieldCheck, Star, MapPin, Users, Repeat2, Heart } from "lucide-react"
import Link from "next/link"

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
import { PARTNER_CATEGORY_LABELS } from "@/modules/partners/domain/constants"
import type { PartnerEndorsement } from "@/modules/partners/domain/types"
import {
  RELATIONSHIP_LEVEL_LABELS,
  RELATIONSHIP_LEVEL_ICONS,
} from "@/modules/relationship/domain/constants"
import { formatRelationshipSummary } from "@/modules/relationship/domain/relationship-levels"
import {
  TRUST_LEVEL_LABELS,
  SERVICE_TYPE_LABELS,
  type ServiceType,
  type TrustLevel,
} from "@/modules/professional/domain/types"
import {
  isPublicTrustBuilding,
  PUBLIC_TRUST_BUILDING_LABEL,
  PUBLIC_TRUST_BUILDING_MESSAGE,
} from "@/modules/trust-engine/domain/public-trust-display"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ReviewCard } from "@/components/shared/cards/ReviewCard"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { RequestServiceSheet } from "@/modules/service-request/components/RequestServiceSheet"
import { BadgeList } from "@/components/shared/badges/BadgeList"
import { ProfessionalReputationBadges } from "@/modules/reputation-badges/components/professional-reputation-badges"
import { ProfessionalTrustSummary } from "@/modules/reputation-badges/components/professional-trust-summary"

type ProfilePageProps = {
  params: Promise<{ professionalId: string }>
  searchParams: Promise<{ from?: string; returnTo?: string }>
}

function TrustStatCard({
  label,
  value,
  description,
  isNegative = false,
}: {
  label: string
  value: number
  description: string
  isNegative?: boolean
}) {
  const formatted = value === 0
    ? "0"
    : `${value > 0 && !isNegative ? "+" : ""}${value.toFixed(1)}`

  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/50 p-3">
      <span
        className={`text-base font-bold tabular-nums ${
          isNegative && value < 0
            ? "text-destructive"
            : value > 0
              ? "text-foreground"
              : "text-muted-foreground"
        }`}
      >
        {formatted}
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-[0.6rem] leading-tight text-muted-foreground">{description}</span>
    </div>
  )
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { professionalId } = await params
  const result = await getProfessionalPublicProfileAction(professionalId)
  if (!result.success) return { title: "Profissional" }
  return { title: result.data.displayName }
}

const TRUST_LEVEL_COLORS: Record<TrustLevel, string> = {
  INITIAL:     "bg-muted text-muted-foreground",
  BUILDING:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ESTABLISHED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TRUSTED:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ELITE:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

/**
 * /discover/[professionalId] — Perfil público do profissional.
 *
 * Server Component: busca perfil, reviews e pets do tutor em paralelo.
 * RequestServiceSheet é Client Component passivo — recebe dados como props.
 *
 * Trust Graph (Fase 4): cada ReviewCard é um "nó de evidência".
 * Ranking Engine (Fase 4): trustScore/trustLevel serão calculados em tempo real.
 */
export default async function ProfessionalProfilePage({
  params,
  searchParams,
}: ProfilePageProps) {
  const { professionalId } = await params
  const query = await searchParams

  // Busca paralela para minimizar latência
  // Nota: getProfessionalBadges é isolado em Promise.allSettled para não derrubar a página
  // se houver erro na query de badges (campos novos, Prisma stale, etc.)
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

  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const myRelationshipCompleted = myRelationship?.completedServices

  return (
    <div className="page-container max-w-2xl">
      <PublicPageBackLink
        searchParams={query}
        fallbackHref="/discover"
        fallbackLabel="Voltar à busca"
      />

      {/* Header do perfil */}
      <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start">
        <Avatar className="size-20 shrink-0 self-start">
          {profile.avatarUrl && (
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
          )}
          <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-3">
          {/* Nome + verificado */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {profile.displayName}
              </h1>
              {verificationActive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3.5" />
                  ✓ Perfil Verificado
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span>
                {profile.city}, {profile.state}
              </span>
            </div>
            <ProfessionalReputationBadges
              professionalId={professionalId}
              className="mt-2"
              viewerRelationshipCompletedServices={myRelationshipCompleted}
            />
          </div>

          {/* Reputação: estrelas + Trust Score */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Média de avaliações */}
            <div className="flex items-center gap-1.5">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {averageRating !== null && totalReviews > 0 ? (
                <>
                  <span className="text-base font-bold text-foreground tabular-nums">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({totalReviews} avaliação{totalReviews !== 1 ? "ões" : ""})
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Sem avaliações</span>
              )}
            </div>

            {/* Trust Score */}
            <div className="flex items-center gap-2">
              {isPublicTrustBuilding(trust.score, trust.level) ? (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground">
                  {PUBLIC_TRUST_BUILDING_LABEL}
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1">
                    <span className="text-xs font-medium text-muted-foreground">Confiança</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {trust.score.toFixed(0)}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRUST_LEVEL_COLORS[trust.level]}`}
                  >
                    {TRUST_LEVEL_LABELS[trust.level]}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Especializações */}
          {profile.specializations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.specializations.map((spec) => (
                <Badge key={spec} variant="outline" className="text-xs font-normal">
                  {spec}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sobre
          </h2>
          <p className="text-sm leading-relaxed text-foreground">{profile.bio}</p>
        </section>
      )}

      {/* Trust Score — bloco de confiança contextual */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Índice de Confiança
          </h2>
          {isPublicTrustBuilding(trust.score, trust.level) ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TRUST_LEVEL_COLORS[trust.level]}`}>
              {TRUST_LEVEL_LABELS[trust.level]}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {trust.score.toFixed(0)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TRUST_LEVEL_COLORS[trust.level]}`}
              >
                {TRUST_LEVEL_LABELS[trust.level]}
              </span>
            </div>
          )}
        </div>

        {isPublicTrustBuilding(trust.score, trust.level) ? (
          /* Estado "em construção" — sem barra vazia nem zeros */
          <p className="text-sm text-muted-foreground leading-relaxed">
            {PUBLIC_TRUST_BUILDING_MESSAGE}
          </p>
        ) : (
          <>
            {/* Barra de progresso */}
            <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${trust.score}%` }}
                role="progressbar"
                aria-valuenow={trust.score}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TrustStatCard
                label="Avaliações"
                value={trust.breakdown.reviews}
                description="soma das avaliações"
              />
              <TrustStatCard
                label="Concluídos"
                value={trust.breakdown.completions}
                description="atendimentos finalizados"
              />
              <TrustStatCard
                label="Recorrência"
                value={trust.breakdown.recurrence}
                description="tutores que voltaram"
              />
              <TrustStatCard
                label="Penalidades"
                value={trust.breakdown.penalties}
                isNegative
                description="cancelamentos e disputas"
              />
            </div>
          </>
        )}
      </section>

      <section className="mb-6">
        <ProfessionalTrustSummary
          professionalId={professionalId}
          viewerRelationshipCompletedServices={myRelationshipCompleted}
          hideBadges
        />
      </section>

      {/* ── Badges e verificações (legado) ───────────────────────────────── */}
      {(() => {
        const showSection =
          badgesResult.badges.length > 0 ||
          badgesResult.verifications.some((v) => v.active && !v.internalOnly)

        if (!showSection) return null

        return (
          <section className="mb-6 rounded-2xl border border-border bg-card p-5">
            <BadgeList
              badges={badgesResult.badges}
              verifications={badgesResult.verifications}
            />
          </section>
        )
      })()}

      {/* ── Parceiros que recomendam — Etapa 5.9 ── */}
      {partnerEndorsements.length > 0 && (
        <section className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800/30 dark:bg-violet-900/10">
          <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
            Parceiros que recomendam
          </p>
          <div className="space-y-3">
            {partnerEndorsements.map((p) => (
              <div key={p.connectionId} className="flex items-center gap-3">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt="" className="size-10 rounded-lg object-cover" />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/40">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {p.slug ? (
                    <Link href={`/partners/${p.slug}`} className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                  )}
                  {p.category && (
                    <p className="text-xs text-muted-foreground">{PARTNER_CATEGORY_LABELS[p.category]}</p>
                  )}
                </div>
                {p.isVerified && (
                  <span className="shrink-0 text-xs text-primary">✓ Verificado</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Relacionamento pessoal do tutor com este profissional ─────────── */}
      {myRelationship && myRelationship.completedServices > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-lg">
            {RELATIONSHIP_LEVEL_ICONS[myRelationship.relationshipLevel]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {formatRelationshipSummary(profile.displayName, myRelationship.completedServices)}
            </p>
            <p className="text-xs text-muted-foreground">
              Relacionamento{" "}
              <span className="font-medium text-primary">
                {RELATIONSHIP_LEVEL_LABELS[myRelationship.relationshipLevel]}
              </span>
              {myRelationship.lastServiceAt && (
                <> · último atendimento em{" "}
                  {new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
                    .format(new Date(myRelationship.lastServiceAt))}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <Separator className="mb-6" />

      {/* ── Recorrência e relacionamentos do profissional (dados públicos) ── */}
      {analytics && analytics.totalRelationships > 0 && (
        <>
          <section className="mb-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Relacionamentos recorrentes
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
                <Users className="size-5 text-muted-foreground" />
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {analytics.totalRelationships}
                </span>
                <span className="text-[0.65rem] leading-tight text-muted-foreground">
                  tutores atendidos
                </span>
              </div>

              <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
                <Repeat2 className="size-5 text-muted-foreground" />
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {analytics.recurringClients}
                </span>
                <span className="text-[0.65rem] leading-tight text-muted-foreground">
                  voltaram 3+ vezes
                </span>
              </div>

              <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3 text-center">
                <Heart className="size-5 text-muted-foreground" />
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {analytics.trustedClients}
                </span>
                <span className="text-[0.65rem] leading-tight text-muted-foreground">
                  relações confiáveis
                </span>
              </div>
            </div>

            {analytics.partnerClients > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-900/10">
                <span className="text-base">⭐</span>
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  <span className="font-semibold">{analytics.partnerClients}</span>{" "}
                  {analytics.partnerClients === 1
                    ? "tutor é parceiro recorrente"
                    : "tutores são parceiros recorrentes"}{" "}
                  (10+ atendimentos)
                </p>
              </div>
            )}
          </section>

          <Separator className="mb-6" />
        </>
      )}

      {/* Serviços ativos */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Serviços
        </h2>

        {profile.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço ativo no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.services.map((service) => {
              const priceLabel = formatPublicServicePrice(service)
              return (
              <div
                key={service.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground leading-snug">{service.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {SERVICE_TYPE_LABELS[service.serviceType as ServiceType]}
                  </p>
                </div>
                {priceLabel && (
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {priceLabel}
                    </p>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </section>

      <Separator className="mb-6" />

      {/* Avaliações */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Avaliações recentes
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
            description="Seja o primeiro a registrar sua experiência com este profissional."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </section>

      <PublicAvailabilityCard days={availabilityDays} />

      {/* CTA — Solicitar atendimento */}
      <div className="sticky bottom-4 z-10">
        <RequestServiceSheet
          professional={{
            id: profile.id,
            displayName: profile.displayName,
            services: profile.services,
          }}
          pets={pets}
        />
      </div>
    </div>
  )
}
