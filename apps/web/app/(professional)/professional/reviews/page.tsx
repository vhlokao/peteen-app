import type { Metadata } from "next"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import {
  findProfessionalClients,
  getProfessionalReviewsData,
} from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalReviewsSummary } from "@/modules/professional-crm/components/professional-reviews-summary"
import { ProfessionalReviewCard } from "@/modules/professional-crm/components/professional-review-card"
import { ProfessionalReviewsEmptyState } from "@/modules/professional-crm/components/professional-reviews-empty-state"

export const metadata: Metadata = {
  title: "Avaliações",
}

const RECURRING_LEVELS = new Set(["RECURRING", "TRUSTED", "PARTNER"])

/**
 * /professional/reviews — feedback e reputação (UX 3.8D2 mobile-first).
 *
 * Dados: getProfessionalReviewsData (já existente, só estendida com
 * serviceType/petName/tutorId — mesmas relações já ligadas ao Review,
 * nenhuma tabela nova) + findProfessionalClients (já existente, reaproveitada
 * da tela de Clientes) para o badge de relação por avaliação. Nenhuma
 * análise de sentimento, nenhuma tag inventada.
 */
export default async function ProfessionalReviewsPage() {
  const { profile } = await requireProfessionalContext()

  const [reviewsData, clients] = await Promise.all([
    getProfessionalReviewsData(profile.id),
    findProfessionalClients(profile.id),
  ])

  const clientByTutorId = new Map(clients.map((c) => [c.tutorId, c]))

  function relationshipBadgeFor(tutorId: string): string | null {
    const client = clientByTutorId.get(tutorId)
    if (!client) return null
    if (client.totalServices === 1) return "Primeiro atendimento"
    if (RECURRING_LEVELS.has(client.relationshipLevel)) return "Cliente recorrente"
    return null
  }

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Avaliações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja como os tutores perceberam seus atendimentos.
        </p>
      </header>

      {reviewsData.totalReviews === 0 ? (
        <ProfessionalReviewsEmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          <ProfessionalReviewsSummary data={reviewsData} />

          <p className="text-xs text-muted-foreground">
            Boas avaliações ajudam a construir confiança na rede Peteen.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {reviewsData.reviews.map((review) => (
              <ProfessionalReviewCard
                key={review.id}
                review={review}
                relationshipBadge={relationshipBadgeFor(review.tutorId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
