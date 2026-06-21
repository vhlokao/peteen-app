import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, RotateCcw, ShieldCheck, Star } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { OPERATIONAL_VERIFICATION_LABELS } from "@/modules/professional-crm/domain/verification-messages"
import { ProfessionalReputationBadges } from "@/modules/reputation-badges/components/professional-reputation-badges"
import { ProfessionalTrustSummary } from "@/modules/reputation-badges/components/professional-trust-summary"
import { getTutorProfessionalHistoryAction } from "@/modules/relationship-history/application/actions"
import { RelationshipSummaryCard } from "@/modules/relationship-history/components/relationship-summary-card"
import { RelationshipPetsList } from "@/modules/relationship-history/components/relationship-pets-list"
import { RelationshipRequestsList } from "@/modules/relationship-history/components/relationship-requests-list"
import { RelationshipReviewsList } from "@/modules/relationship-history/components/relationship-reviews-list"
import { RelationshipTimeline } from "@/modules/relationship-history/components/relationship-timeline"

export const metadata: Metadata = {
  title: "Histórico com profissional",
}

type PageProps = {
  params: Promise<{ professionalId: string }>
}

const VERIFICATION_BADGE_STYLES = {
  verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  not_verified: "bg-muted text-muted-foreground",
} as const

export default async function TutorProfessionalHistoryPage({
  params,
}: PageProps) {
  const { professionalId } = await params
  const history = await getTutorProfessionalHistoryAction(professionalId)
  const { professional, summary } = history

  const verificationLabel =
    OPERATIONAL_VERIFICATION_LABELS[professional.verificationStatus]
  const verificationStyle =
    VERIFICATION_BADGE_STYLES[professional.verificationStatus]

  const fmt = (d: Date | null) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tutor"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
        >
          <ArrowLeft className="size-4" />
          Portal do tutor
        </Link>
      </div>

      <PageHeader
        title="Histórico com profissional"
        description="Atendimentos, pets, reviews e solicitações com este profissional."
      />

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 pt-6">
          <Avatar size="lg">
            {professional.avatarUrl ? (
              <AvatarImage
                src={professional.avatarUrl}
                alt={professional.displayName}
              />
            ) : null}
            <AvatarFallback>
              {professional.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h2 className="text-xl font-semibold">{professional.displayName}</h2>
              <p className="text-sm text-muted-foreground">{professional.city}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                Trust Score {professional.trustScore.toFixed(1)}
              </Badge>
              <Badge className={verificationStyle} variant="secondary">
                <ShieldCheck className="mr-1 size-3" />
                {verificationLabel}
              </Badge>
              {summary.isRecurring && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  Cliente recorrente
                </Badge>
              )}
            </div>
            <ProfessionalReputationBadges
              professionalId={professional.id}
              viewerRelationshipCompletedServices={summary.completedServices}
            />
            <p className="text-sm text-muted-foreground">
              {summary.completedServices} atendimento
              {summary.completedServices !== 1 ? "s" : ""} · Última contratação:{" "}
              {fmt(summary.lastHiredAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/discover/${professional.id}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Ver perfil público
            </Link>
            <Link
              href={`/discover/${professional.id}`}
              className={buttonVariants({ size: "sm", className: "gap-1" })}
            >
              <RotateCcw className="size-3.5" />
              Contratar novamente
            </Link>
          </div>
        </CardContent>
      </Card>

      <ProfessionalTrustSummary
        professionalId={professional.id}
        viewerRelationshipCompletedServices={summary.completedServices}
        hideBadges
      />

      <RelationshipSummaryCard
        summary={summary}
        showRecurringBadge={false}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RelationshipPetsList pets={history.pets} />
        <RelationshipReviewsList
          reviews={history.reviews}
          emptyMessage="Nenhuma review enviada ainda."
        />
      </div>

      <RelationshipRequestsList requests={history.requests} />

      <RelationshipTimeline
        summary={summary}
        requests={history.requests}
        reviews={history.reviews}
      />
    </div>
  )
}
