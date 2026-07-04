import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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
      <Link
        href="/professional/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar aos clientes
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {history.tutor.displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Histórico completo do relacionamento com este tutor.
        </p>
      </header>

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
          emptyMessage="Nenhuma avaliação recebida deste tutor ainda."
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
