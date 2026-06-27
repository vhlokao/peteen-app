import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  PawPrint,
  User,
  FileText,
  MapPin,
  Info,
  Star,
  CheckCircle2,
} from "lucide-react"

import { requireAuth } from "@/modules/identity/application/get-session"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions"
import { getReviewForRequestAction } from "@/modules/review/application/actions"
import { getMyRelationshipWithProfessional } from "@/modules/relationship/application/actions"
import { buildDiscoverUrl } from "@/modules/partner-portal/domain/navigation"
import {
  RELATIONSHIP_LEVEL_LABELS,
  RELATIONSHIP_LEVEL_ICONS,
} from "@/modules/relationship/domain/constants"
import { formatServiceCount } from "@/modules/relationship/domain/relationship-levels"
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@/modules/service-request/domain/types"
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { RequestTimeline } from "@/components/requests/RequestTimeline"
import { ReviewForm } from "@/components/reviews/ReviewForm"
import { TutorRequestActions } from "@/modules/tutor-portal/components/tutor-request-actions"

export const metadata: Metadata = {
  title: "Detalhe da solicitação",
}

type PageProps = {
  params: Promise<{ requestId: string }>
}

const STATUS_BADGE_STYLES: Partial<Record<RequestStatus, string>> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACCEPTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS:
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED_BY_TUTOR: "bg-muted text-muted-foreground",
  CANCELLED_BY_PROFESSIONAL:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  DISPUTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  EXPIRED: "bg-muted text-muted-foreground",
}

function formatDate(date: Date | null): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-foreground">{value}</div>
      </div>
    </div>
  )
}

function SubmittedReview({
  rating,
  comment,
  createdAt,
}: {
  rating: number
  comment: string | null
  createdAt: Date
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-label={`${rating} de 5 estrelas`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`size-5 ${
                i < rating
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateShort(createdAt)}
        </span>
      </div>
      {comment ? (
        <p className="text-sm leading-relaxed text-foreground">{comment}</p>
      ) : null}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-green-500" />
        <span>Avaliação enviada com sucesso</span>
      </div>
    </div>
  )
}

export default async function TutorRequestDetailPage({ params }: PageProps) {
  const { requestId } = await params
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const detailResult = await getServiceRequestDetailAction(requestId)

  if (!detailResult.success || !detailResult.data) {
    notFound()
  }

  const request = detailResult.data

  if (request.tutorId !== tutorProfile.id) {
    notFound()
  }

  const isCompleted = request.status === "COMPLETED"
  const hasReview = request.review !== null
  const canCancel = ["PENDING", "ACCEPTED"].includes(request.status)
  const canReview = isCompleted && !hasReview

  const [existingReviewResult, myRelationship] = await Promise.all([
    isCompleted && hasReview ? getReviewForRequestAction(requestId) : null,
    getMyRelationshipWithProfessional(request.professional.id),
  ])

  const existingReview = existingReviewResult?.success
    ? existingReviewResult.data
    : null

  const pro = request.professional
  const proInitials = pro.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  const statusBadge =
    STATUS_BADGE_STYLES[request.status] ?? "bg-muted text-muted-foreground"

  return (
    <div className="page-container max-w-2xl">
      <Link
        href="/tutor/requests"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar às solicitações
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solicitação #{requestId.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusBadge}`}
        >
          {REQUEST_STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Profissional
          </h2>
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              {pro.avatarUrl ? (
                <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                {proInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                href={buildDiscoverUrl(pro.id, {
                  from: "tutor",
                  returnTo: `/tutor/requests/${requestId}`,
                })}
                className="font-semibold text-foreground hover:text-primary"
              >
                {pro.displayName}
              </Link>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                <span>{pro.city}</span>
              </div>
            </div>
          </div>
          {myRelationship && myRelationship.completedServices > 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="shrink-0 text-base">
                {RELATIONSHIP_LEVEL_ICONS[myRelationship.relationshipLevel]}
              </span>
              <p className="text-xs text-foreground">
                Você já contratou{" "}
                <span className="font-semibold">{pro.displayName}</span>{" "}
                <span className="font-semibold text-primary">
                  {formatServiceCount(myRelationship.completedServices)}
                </span>
                {" · "}
                <span className="text-muted-foreground">
                  {RELATIONSHIP_LEVEL_LABELS[myRelationship.relationshipLevel]}
                </span>
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detalhes
          </h2>
          <div className="flex flex-col gap-4">
            <InfoRow
              icon={<PawPrint className="size-4" />}
              label="Pet"
              value={
                request.pet ? (
                  <span>
                    <Link
                      href={`/me/pets/${request.pet.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {request.pet.name}
                    </Link>
                    <span className="ml-1.5 text-muted-foreground">
                      ({SPECIES_LABELS[request.pet.species]})
                      {request.pet.breed ? ` · ${request.pet.breed}` : ""}
                    </span>
                    {request.pet.hasSpecialNeeds ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <Info className="size-3" />
                        Necessidades especiais
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Não informado</span>
                )
              }
            />
            <InfoRow
              icon={<User className="size-4" />}
              label="Tipo de serviço"
              value={SERVICE_TYPE_LABELS[request.serviceType as ServiceType]}
            />
            <InfoRow
              icon={<CalendarDays className="size-4" />}
              label="Data solicitada"
              value={formatDate(request.scheduledAt)}
            />
            {request.notes ? (
              <>
                <Separator />
                <InfoRow
                  icon={<FileText className="size-4" />}
                  label="Suas observações"
                  value={
                    <p className="leading-relaxed text-foreground/80">
                      {request.notes}
                    </p>
                  }
                />
              </>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico
          </h2>
          <RequestTimeline
            request={{
              status: request.status,
              createdAt: request.createdAt,
              updatedAt: request.updatedAt,
              startedAt: request.startedAt,
              completedAt: request.completedAt,
            }}
          />
        </section>

        {canCancel ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ações
            </h2>
            <TutorRequestActions
              requestId={requestId}
              currentStatus={request.status}
            />
          </section>
        ) : null}

        {canReview && request.pet ? (
          <section className="rounded-2xl border border-primary/20 bg-card p-5 ring-1 ring-primary/10">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Avaliar atendimento
            </h2>
            <ReviewForm
              requestId={requestId}
              professionalName={pro.displayName}
              serviceTypeLabel={
                SERVICE_TYPE_LABELS[request.serviceType as ServiceType]
              }
              petName={request.pet.name}
              petSpeciesLabel={SPECIES_LABELS[request.pet.species]}
            />
          </section>
        ) : null}

        {isCompleted && hasReview && existingReview ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sua avaliação
            </h2>
            <SubmittedReview
              rating={existingReview.rating}
              comment={existingReview.comment}
              createdAt={existingReview.createdAt}
            />
          </section>
        ) : null}

        {request.status === "PENDING" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
            Sua solicitação está aguardando resposta do profissional.
          </div>
        ) : null}

        {request.status === "ACCEPTED" || request.status === "IN_PROGRESS" ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800/40 dark:bg-blue-900/10 dark:text-blue-400">
            O profissional confirmou o atendimento. Aguarde o início ou
            conclusão do serviço.
          </div>
        ) : null}
      </div>
    </div>
  )
}
