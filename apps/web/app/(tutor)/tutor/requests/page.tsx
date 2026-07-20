import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, Search } from "lucide-react"
import { redirect } from "next/navigation"

import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { getMyRequestsAsTutorAction } from "@/modules/service-request/application/actions"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { TutorRequestCard } from "@/modules/tutor-portal/components/tutor-request-card"
import { TutorRequestsTabs } from "@/modules/tutor-portal/components/TutorRequestsTabs"
import { isActiveRequestStatus } from "@/modules/tutor-portal/domain/request-status-display"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Seus pedidos",
}

function groupRequests(requests: ServiceRequestWithParticipants[]) {
  return {
    active: requests.filter((r) => isActiveRequestStatus(r.status)),
    previous: requests.filter((r) => !isActiveRequestStatus(r.status)),
  }
}

/**
 * /tutor/requests — Lista de solicitações do tutor (UX 3.7 mobile-first).
 *
 * Classificação Ativos/Anteriores reaproveita a mesma regra da versão
 * anterior (isActiveRequestStatus, ver modules/tutor-portal/domain/
 * request-status-display.ts) — PENDING/ACCEPTED/IN_PROGRESS ativos;
 * COMPLETED/CANCELLED (tutor ou profissional)/DISPUTED/EXPIRED anteriores, como já
 * era feito pelos sets OPEN/TERMINAL do código original.
 */
export default async function TutorRequestsPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const result = await getMyRequestsAsTutorAction({ limit: 50 })
  const requests = result.success ? result.data : []
  const { active, previous } = groupRequests(requests)

  const activeSubtitle =
    active.length === 0
      ? "Nenhum atendimento ativo"
      : `${active.length} atendimento${active.length > 1 ? "s" : ""} ativo${active.length > 1 ? "s" : ""}`

  return (
    <div className="page-container space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">{activeSubtitle}</p>
        </div>
        <Link href="/discover" className={buttonVariants({ size: "sm" })}>
          Nova solicitação
        </Link>
      </header>

      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" />}
          title="Nenhuma solicitação enviada"
          description="Encontre um profissional confiável e faça sua primeira solicitação."
          action={{ label: "Descobrir profissionais", href: "/discover" }}
        />
      ) : (
        <TutorRequestsTabs
          activeCount={active.length}
          previousCount={previous.length}
          activeContent={
            active.length > 0 ? (
              <div className="flex flex-col gap-3">
                {active.map((req) => (
                  <TutorRequestCard key={req.id} request={req} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Search className="size-7" />}
                title="Nenhum atendimento ativo"
                description="Quando você solicitar um atendimento, ele aparece aqui."
                action={{ label: "Encontrar profissional", href: "/discover" }}
              />
            )
          }
          previousContent={
            previous.length > 0 ? (
              <div className="flex flex-col gap-3">
                {previous.map((req) => (
                  <TutorRequestCard key={req.id} request={req} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ClipboardList className="size-7" />}
                title="Nada por aqui ainda"
                description="Seus atendimentos anteriores vão ficar guardados aqui."
              />
            )
          }
        />
      )}
    </div>
  )
}
