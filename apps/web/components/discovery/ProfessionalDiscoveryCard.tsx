import Link from "next/link"
import { MapPin, ShieldCheck, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
  type TrustLevel,
} from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"
import { getPublicTrustState } from "@/modules/trust-engine/domain/public-trust-display"
import { TrustStateChip } from "@/components/shared/trust/TrustStateChip"
import { ReputationBadgePill } from "@/modules/reputation-badges/components/reputation-badge-pill"
import type { ReputationBadge } from "@/modules/reputation-badges/domain/types"
import type { PartnerEndorsement } from "@/modules/partners/domain/types"
import { resolvePublicLocation } from "@/modules/location"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"

type ProfessionalDiscoveryCardService = {
  id: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
}

type ProfessionalDiscoveryCardProps = {
  id: string
  displayName: string
  avatarUrl: string | null
  city: string
  state: string
  trustScore: number
  trustLevel: TrustLevel
  isVerified: boolean
  serviceTypes: ServiceType[]
  services: ProfessionalDiscoveryCardService[]
  reviewCount: number
  averageRating: number | null
  /** Quantas vezes o tutor autenticado já contratou este profissional. */
  myCompletedServices?: number
  /** Quantos tutores distintos têm relacionamento recorrente (3+ sessões). */
  recurringClientsCount?: number
  reputationBadges?: ReputationBadge[]
  partnerEndorsements?: PartnerEndorsement[]
}

/**
 * Card de profissional para o Discovery mobile-first (UX 3.4).
 *
 * Confiança sempre antes de preço: os sinais (TrustStateChip, recorrência,
 * badges) vêm antes do rodapé de avaliação/preço. Nunca renderiza o score
 * bruto — TrustStateChip é chamado sem a prop `trustScore`, então só mostra
 * o nível humano (TrustLevelBadge) e os estados building/initial.
 */
export function ProfessionalDiscoveryCard({
  id,
  displayName,
  avatarUrl,
  city,
  state,
  trustScore,
  trustLevel,
  isVerified,
  serviceTypes,
  services,
  reviewCount,
  averageRating,
  myCompletedServices,
  recurringClientsCount,
  reputationBadges = [],
  partnerEndorsements = [],
}: ProfessionalDiscoveryCardProps) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const trustState = getPublicTrustState(trustScore, trustLevel, {
    reviewCount,
    isVerified,
    hasPartnerEndorsement: partnerEndorsements.length > 0,
    hasReputationBadge: reputationBadges.length > 0,
    recurringClientsCount,
    completedCount: myCompletedServices,
  })

  const primaryService = serviceTypes[0]
  const primaryServiceEntry =
    services.find((s) => s.serviceType === primaryService) ?? services[0]
  const priceLabel = primaryServiceEntry
    ? formatPublicServicePrice(primaryServiceEntry)
    : null
  const hasReviews = averageRating !== null && reviewCount > 0

  return (
    <Link
      href={`/discover/${id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      {/* Faixa decorativa sutil no topo */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#2C4893]/[0.06] to-transparent"
        aria-hidden
      />

      {/* Identidade */}
      <div className="relative flex items-start gap-3 p-4 pb-3">
        <Avatar
          className="size-16 shrink-0 rounded-2xl ring-1 ring-border/60"
          style={{ background: "linear-gradient(135deg,#E8EEF6,#D7E2F2)" }}
        >
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="rounded-2xl bg-transparent text-lg font-semibold" style={{ color: NAVY }}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[0.95rem] font-semibold tracking-tight text-foreground">
              {displayName}
            </span>
            {isVerified && (
              <ShieldCheck className="size-4 shrink-0" style={{ color: GREEN }} aria-label="Verificado" />
            )}
          </div>
          {primaryService && (
            <span className="mt-1 inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {SERVICE_TYPE_LABELS[primaryService]}
            </span>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {resolvePublicLocation({ city, state }).label}
            </span>
          </div>
        </div>
      </div>

      {/* Sinais de confiança — máx 3 elementos, hierarquia clara */}
      <div className="relative flex flex-wrap items-center gap-1.5 px-4 pb-3">
        {/* 1. Trust state — sempre */}
        <TrustStateChip trustState={trustState} trustLevel={trustLevel} size="sm" />

        {/* 2. Partner endorsement OU primeiro badge de reputação */}
        {partnerEndorsements.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
            Recomendado
          </span>
        ) : reputationBadges.length > 0 && reputationBadges[0] ? (
          <ReputationBadgePill badge={reputationBadges[0]} size="xs" />
        ) : null}

        {/* 3. Recorrência — pessoal OU clientes recorrentes */}
        {myCompletedServices != null && myCompletedServices > 0 ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
            Você já contratou {myCompletedServices}×
          </span>
        ) : recurringClientsCount != null && recurringClientsCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground">
            {recurringClientsCount}{" "}
            {recurringClientsCount === 1 ? "tutor voltou" : "tutores voltaram"}
          </span>
        ) : null}
      </div>

      {/* Rodapé: avaliação + preço secundário + CTA */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1">
          {hasReviews ? (
            <>
              <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {averageRating!.toFixed(1)}
              </span>
              <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                ({reviewCount})
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sem avaliações ainda</span>
          )}
          {priceLabel && (
            <span className="truncate text-[0.65rem] text-muted-foreground">
              · {priceLabel}
            </span>
          )}
        </div>

        <span className="shrink-0 rounded-full bg-[#E8EEF6] px-2.5 py-1 text-xs font-bold text-[#1D2F6F] transition-colors group-hover:bg-[#1D2F6F] group-hover:text-white">
          Ver perfil →
        </span>
      </div>
    </Link>
  )
}
