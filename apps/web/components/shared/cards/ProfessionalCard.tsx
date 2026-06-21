import Link from "next/link"
import { ShieldCheck, Star, MapPin, Repeat2, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  SERVICE_TYPE_LABELS,
  TRUST_LEVEL_LABELS,
  type ServiceType,
  type TrustLevel,
} from "@/modules/professional/domain/types"
import { BadgePill } from "@/components/shared/badges/BadgePill"
import type { BadgeData } from "@/modules/badges/domain/types"
import type { ReputationBadge } from "@/modules/reputation-badges/domain/types"
import { ReputationBadgeList } from "@/modules/reputation-badges/components/reputation-badge-list"
import type { PartnerEndorsement } from "@/modules/partners/domain/types"

type ProfessionalCardService = {
  id: string
  serviceType: ServiceType
}

type ProfessionalCardProps = {
  id: string
  displayName: string
  avatarUrl: string | null
  city: string
  state: string
  trustScore: number
  trustLevel: TrustLevel
  isVerified: boolean
  serviceTypes: ServiceType[]
  services: ProfessionalCardService[]
  reviewCount: number
  averageRating: number | null
  /** Quantas vezes o tutor autenticado já contratou este profissional. */
  myCompletedServices?: number
  /** Quantos tutores distintos têm relacionamento recorrente (3+ sessões) com este profissional. */
  recurringClientsCount?: number
  /**
   * Top badges do profissional (legado badges module).
   */
  badges?: BadgeData[]
  /** Badges reputacionais Etapa 6.7 */
  reputationBadges?: ReputationBadge[]
  /** Parceiros que recomendam este profissional (Etapa 5.9) */
  partnerEndorsements?: PartnerEndorsement[]
}

const TRUST_LEVEL_COLORS: Record<TrustLevel, string> = {
  INITIAL:     "bg-muted text-muted-foreground",
  BUILDING:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ESTABLISHED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TRUSTED:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ELITE:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export function ProfessionalCard({
  id,
  displayName,
  avatarUrl,
  city,
  state,
  trustScore,
  trustLevel,
  isVerified,
  serviceTypes,
  reviewCount,
  averageRating,
  myCompletedServices,
  recurringClientsCount,
  badges = [],
  reputationBadges = [],
  partnerEndorsements = [],
}: ProfessionalCardProps) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar className="size-12 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground leading-snug">
                {displayName}
              </span>
              {isVerified && (
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-label="Verificado" />
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {city}, {state}
              </span>
            </div>
          </div>
        </div>

        {/* Reputação: estrelas + Trust Score + nível */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* Média de avaliações */}
          {averageRating !== null && reviewCount > 0 ? (
            <div className="flex items-center gap-1" title={`${reviewCount} avaliação${reviewCount !== 1 ? "ões" : ""}`}>
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {averageRating.toFixed(1)}
              </span>
              <span className="text-[0.65rem] text-muted-foreground">
                ({reviewCount})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Star className="size-3.5 text-muted-foreground/40" />
              <span className="text-[0.65rem] text-muted-foreground">—</span>
            </div>
          )}

          {/* Separador visual */}
          <span className="text-muted-foreground/30 text-xs" aria-hidden>·</span>

          {/* Trust Score + nível */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-muted-foreground">Trust</span>
            <span className="text-xs font-bold text-foreground tabular-nums">
              {trustScore.toFixed(0)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${TRUST_LEVEL_COLORS[trustLevel]}`}
            >
              {TRUST_LEVEL_LABELS[trustLevel]}
            </span>
          </div>
        </div>

        {/* Sinal de recorrência ─────────────────────────────────────────────
            Prioridade: relacionamento pessoal do tutor > dado público agregado.
            Não exibir se não houver dado relevante. */}
        {myCompletedServices != null && myCompletedServices > 0 ? (
          <div className="flex items-center gap-1.5 rounded-md bg-primary/8 px-2.5 py-1.5 text-xs text-primary">
            <Repeat2 className="size-3.5 shrink-0" aria-hidden />
            <span>
              Você já contratou{" "}
              <strong>{myCompletedServices}</strong>{" "}
              {myCompletedServices === 1 ? "vez" : "vezes"}
            </span>
          </div>
        ) : recurringClientsCount != null && recurringClientsCount > 0 ? (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <span>
              <strong className="text-foreground">{recurringClientsCount}</strong>{" "}
              {recurringClientsCount === 1 ? "tutor voltou" : "tutores voltaram"}
            </span>
          </div>
        ) : null}

        {/* Badges reputacionais */}
        {(reputationBadges.length > 0 || badges.length > 0 || isVerified) && (
          <div className="flex flex-wrap gap-1.5">
            {reputationBadges.length > 0 ? (
              <ReputationBadgeList badges={reputationBadges} />
            ) : (
              <>
                {isVerified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[0.65rem] font-medium text-primary"
                    title="Perfil revisado e aprovado pela equipe Peteen"
                  >
                    ✓ Perfil Verificado
                  </span>
                )}
                {badges.map((badge) => (
                  <BadgePill key={badge.type} badge={badge} size="xs" />
                ))}
              </>
            )}
          </div>
        )}

        {/* Recomendação de parceiro — Etapa 5.9 */}
        {partnerEndorsements.length > 0 && (
          <div className="rounded-md bg-violet-50 px-2.5 py-1.5 text-xs dark:bg-violet-900/20">
            <span className="text-muted-foreground">Recomendado por </span>
            {partnerEndorsements.slice(0, 2).map((p, i) => (
              <span key={p.connectionId}>
                {i > 0 && ", "}
                {p.slug ? (
                  <Link href={`/partners/${p.slug}`} className="font-medium text-violet-700 hover:underline dark:text-violet-400">
                    {p.name}
                  </Link>
                ) : (
                  <span className="font-medium text-violet-700 dark:text-violet-400">{p.name}</span>
                )}
              </span>
            ))}
            {partnerEndorsements.length > 2 && (
              <span className="text-muted-foreground"> +{partnerEndorsements.length - 2}</span>
            )}
          </div>
        )}

        {/* Service types */}
        {serviceTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {serviceTypes.slice(0, 3).map((type) => (
              <Badge key={type} variant="secondary" className="text-[0.65rem] font-normal">
                {SERVICE_TYPE_LABELS[type]}
              </Badge>
            ))}
            {serviceTypes.length > 3 && (
              <Badge variant="secondary" className="text-[0.65rem] font-normal">
                +{serviceTypes.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/discover/${id}`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "mt-auto w-full" })}
        >
          Ver perfil
        </Link>
      </CardContent>
    </Card>
  )
}
