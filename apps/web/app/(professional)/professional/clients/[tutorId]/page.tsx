import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getProfessionalClientHistoryAction } from "@/modules/relationship-history/application/actions"
import { RelationshipSummaryCard } from "@/modules/relationship-history/components/relationship-summary-card"
import { RelationshipPetsList } from "@/modules/relationship-history/components/relationship-pets-list"
import { RelationshipRequestsList } from "@/modules/relationship-history/components/relationship-requests-list"
import { RelationshipReviewsList } from "@/modules/relationship-history/components/relationship-reviews-list"
import { RelationshipTimeline } from "@/modules/relationship-history/components/relationship-timeline"

export const metadata: Metadata = {
  title: "Histórico do cliente",
}

type PageProps = {
  params: Promise<{ tutorId: string }>
}

export default async function ProfessionalClientHistoryPage({
  params,
}: PageProps) {
  const { tutorId } = await params
  const history = await getProfessionalClientHistoryAction(tutorId)

  const location = [history.tutor.city, history.tutor.neighborhood]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/professional/clients"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
        >
          <ArrowLeft className="size-4" />
          Clientes
        </Link>
      </div>

      <PageHeader
        title={history.tutor.displayName}
        description="Histórico completo do relacionamento com este tutor."
      />

      <RelationshipSummaryCard
        summary={history.summary}
        subjectLabel="Cliente"
        subjectName={history.tutor.displayName}
        subjectDetail={location || undefined}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RelationshipPetsList pets={history.pets} />
        <RelationshipReviewsList
          reviews={history.reviews}
          showAuthor
          emptyMessage="Nenhuma review recebida deste tutor ainda."
        />
      </div>

      <RelationshipRequestsList requests={history.requests} />

      <RelationshipTimeline
        summary={history.summary}
        requests={history.requests}
        reviews={history.reviews}
      />
    </div>
  )
}
