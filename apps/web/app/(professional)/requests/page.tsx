import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Inbox, Search } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { resolveHomeForRoles } from "@/modules/identity/domain/role-routing"
import { getMyRequestsAsProfessionalAction } from "@/modules/service-request/application/actions"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { ProfessionalRequestCard } from "@/modules/professional-crm/components/professional-request-card"
import { ProfessionalRequestsTabs } from "@/modules/professional-crm/components/professional-requests-tabs"
import { PROFESSIONAL_REQUEST_GROUP } from "@/modules/professional-crm/domain/request-status-display"

export const metadata: Metadata = {
  title: "Solicitações",
}

function groupRequests(requests: ServiceRequestWithParticipants[]) {
  return {
    new: requests.filter((r) => PROFESSIONAL_REQUEST_GROUP[r.status] === "new"),
    ongoing: requests.filter((r) => PROFESSIONAL_REQUEST_GROUP[r.status] === "ongoing"),
    history: requests.filter((r) => PROFESSIONAL_REQUEST_GROUP[r.status] === "history"),
  }
}

/**
 * /requests — solicitações do profissional (UX 3.8B mobile-first).
 *
 * Classificação Novas/Em andamento/Histórico conferida contra o
 * comportamento real (ver PROFESSIONAL_REQUEST_GROUP): só PENDING/
 * ACCEPTED/IN_PROGRESS têm ação disponível hoje, por isso COMPLETED entra
 * em Histórico junto dos estados terminais, não em uma seção própria.
 *
 * Rota compartilhada com o fluxo do tutor no mesmo arquivo original — quem
 * não possui a role PROFESSIONAL é redirecionado antes de qualquer render
 * aqui, então esta página é, na prática, só a visão do profissional.
 *
 * Checagem por roles (não primaryRole): um usuário TUTOR+PROFESSIONAL deve
 * continuar acessando esta tela mesmo que a persona ativa seja outra —
 * primaryRole define preferência de destino, não permissão.
 */
export default async function RequestsPage() {
  const ctx = await getAuthContext()

  if (!ctx.authenticated) {
    redirect("/login")
  }

  const { roles, primaryRole } = ctx.user

  if (!roles.includes("PROFESSIONAL")) {
    if (roles.includes("TUTOR")) {
      redirect("/tutor/requests")
    }
    redirect(resolveHomeForRoles(roles, primaryRole))
  }

  const result = await getMyRequestsAsProfessionalAction({ limit: 50 })
  const requests: ServiceRequestWithParticipants[] = result.success ? result.data : []
  const { new: newRequests, ongoing, history } = groupRequests(requests)

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Solicitações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja o que precisa da sua atenção e acompanhe seus atendimentos.
        </p>
      </header>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="Aguardando solicitações"
          description="Quando um tutor solicitar seus serviços, o pedido aparecerá aqui."
        />
      ) : (
        <ProfessionalRequestsTabs
          newCount={newRequests.length}
          ongoingCount={ongoing.length}
          historyCount={history.length}
          newContent={
            newRequests.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {newRequests.map((req) => (
                  <ProfessionalRequestCard key={req.id} request={req} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Search className="size-7" />}
                title="Nenhuma solicitação nova aguardando resposta."
              />
            )
          }
          ongoingContent={
            ongoing.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {ongoing.map((req) => (
                  <ProfessionalRequestCard key={req.id} request={req} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Inbox className="size-7" />}
                title="Nenhum atendimento em andamento no momento."
              />
            )
          }
          historyContent={
            history.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {history.map((req) => (
                  <ProfessionalRequestCard key={req.id} request={req} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Inbox className="size-7" />}
                title="Seu histórico de atendimentos aparecerá aqui."
              />
            )
          }
        />
      )}
    </div>
  )
}
