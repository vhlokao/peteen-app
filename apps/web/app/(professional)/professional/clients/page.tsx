import type { Metadata } from "next"
import { Users } from "lucide-react"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import {
  findProfessionalClients,
  getProfessionalDashboardStats,
} from "@/modules/professional-crm/infrastructure/queries"
import { EmptyState } from "@/components/shared/feedback/EmptyState"
import { ProfessionalClientsList } from "@/modules/professional-crm/components/professional-clients-list"
import { ProfessionalClientsOverview } from "@/modules/professional-crm/components/professional-clients-overview"

export const metadata: Metadata = {
  title: "Clientes",
}

const RECURRING_LEVELS = new Set(["RECURRING", "TRUSTED", "PARTNER"])

/**
 * /professional/clients — relações com tutores (UX 3.8C mobile-first).
 *
 * Dados: findProfessionalClients (já existente) para a lista, e
 * getProfessionalDashboardStats (já existente, reaproveitado da Home) só
 * para uniqueClients/petsAttended do resumo. "Clientes recorrentes" é
 * derivado da própria lista já buscada (relationshipLevel >= RECURRING,
 * mesmo threshold central de RELATIONSHIP_LEVEL_THRESHOLDS) — nenhuma
 * query nova, nenhum cálculo de recorrência novo.
 */
export default async function ProfessionalClientsPage() {
  const { profile } = await requireProfessionalContext()

  const [clients, stats] = await Promise.all([
    findProfessionalClients(profile.id),
    getProfessionalDashboardStats(profile.id, profile.trustScore),
  ])

  const recurringClients = clients.filter((c) => RECURRING_LEVELS.has(c.relationshipLevel)).length

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Seus clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja tutores, pets e relações construídas ao longo do tempo.
        </p>
      </header>

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7" />}
          title="Seus clientes aparecerão aqui"
          description="Quando você concluir atendimentos, as relações construídas ficarão organizadas nesta área."
          action={{ label: "Ver solicitações", href: "/requests" }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <ProfessionalClientsOverview
            totalClients={stats.uniqueClients}
            recurringClients={recurringClients}
            petsAttended={stats.petsAttended}
          />
          <ProfessionalClientsList clients={clients} />
        </div>
      )}
    </div>
  )
}
