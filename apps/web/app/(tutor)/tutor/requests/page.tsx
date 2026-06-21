import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { buttonVariants } from "@/components/ui/button"
import { getMyRequestsAsTutorAction } from "@/modules/service-request/application/actions"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { TutorRequestCard } from "@/modules/tutor-portal/components/tutor-request-card"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { requireAuth } from "@/modules/identity/application/get-session"

export const metadata: Metadata = {
  title: "Minhas solicitações",
}

const OPEN = new Set(["PENDING", "ACCEPTED", "IN_PROGRESS"])
const TERMINAL = new Set([
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "DISPUTED",
  "EXPIRED",
])

function groupRequests(requests: ServiceRequestWithParticipants[]) {
  return {
    open: requests.filter((r) => OPEN.has(r.status)),
    completed: requests.filter((r) => r.status === "COMPLETED"),
    terminal: requests.filter((r) => TERMINAL.has(r.status)),
  }
}

export default async function TutorRequestsPage() {
  const session = await requireAuth()
  const tutorProfile = await findTutorProfileByUserId(session.id)

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  const result = await getMyRequestsAsTutorAction({ limit: 50 })
  const requests = result.success ? result.data : []
  const groups = groupRequests(requests)

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title="Solicitações"
        description="Acompanhe pedidos enviados, em andamento e concluídos."
        action={
          <Link href="/discover" className={buttonVariants({ size: "sm" })}>
            Nova solicitação
          </Link>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" />}
          title="Nenhuma solicitação enviada"
          description="Encontre um profissional confiável e faça sua primeira solicitação."
          action={{ label: "Descobrir profissionais", href: "/discover" }}
        />
      ) : (
        <>
          {groups.open.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Em aberto ({groups.open.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.open.map((req) => (
                  <TutorRequestCard key={req.id} request={req} />
                ))}
              </div>
            </section>
          )}

          {groups.completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Concluídas ({groups.completed.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.completed.map((req) => (
                  <TutorRequestCard key={req.id} request={req} />
                ))}
              </div>
            </section>
          )}

          {groups.terminal.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                Encerradas ({groups.terminal.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.terminal.map((req) => (
                  <TutorRequestCard key={req.id} request={req} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
