import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, Bell, Eye } from "lucide-react"

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import {
  getProfessionalDashboardStats,
  findRecentProfessionalActivity,
} from "@/modules/professional-crm/infrastructure/queries"
import { getProfessionalTrustSummary } from "@/modules/reputation-badges/application/get-reputation"
import { getMyRequestsAsProfessionalAction } from "@/modules/service-request/application/actions"
import { getProfessionalServices } from "@/modules/professional-services/infrastructure/queries"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"
import { ProfessionalAttentionCard } from "@/modules/professional-crm/components/professional-attention-card"
import { ProfessionalNextAppointmentCard } from "@/modules/professional-crm/components/professional-next-appointment-card"
import { ProfessionalQuickActions } from "@/modules/professional-crm/components/professional-quick-actions"
import { ProfessionalClientsSummary } from "@/modules/professional-crm/components/professional-clients-summary"
import { ProfessionalTrustOverview } from "@/modules/professional-crm/components/professional-trust-overview"
import { ProfessionalMetricsRow } from "@/modules/professional-crm/components/professional-metrics-row"
import { ProfessionalRecentActivity } from "@/modules/professional-crm/components/professional-recent-activity"
import { ProfessionalPublicProfileCTA } from "@/modules/professional-crm/components/professional-public-profile-cta"

export const metadata: Metadata = {
  title: "Portal do profissional",
}

const NAVY = "#1D2F6F"

const OPEN_APPOINTMENT_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS"])

function pickNextAppointment(
  requests: ServiceRequestWithParticipants[]
): ServiceRequestWithParticipants | null {
  const open = requests.filter((r) => OPEN_APPOINTMENT_STATUSES.has(r.status))
  if (open.length === 0) return null

  const sorted = open.sort((a, b) => {
    if (!a.scheduledAt) return 1
    if (!b.scheduledAt) return -1
    return a.scheduledAt.getTime() - b.scheduledAt.getTime()
  })

  return sorted[0] ?? null
}

/**
 * /professional — hub operacional mobile-first (UX 3.8A).
 *
 * Ordem mental: atenção agora -> próximo compromisso -> ações rápidas ->
 * clientes/recorrência -> confiança -> métricas -> atividade -> perfil
 * público. Toda a lógica de negócio (status, trust score, recorrência)
 * é lida de queries/actions já existentes — nada foi recalculado aqui.
 */
export default async function ProfessionalHomePage() {
  const { profile } = await requireProfessionalContext()

  const [requestsResult, trustSummary, stats, recentActivity, services] = await Promise.all([
    getMyRequestsAsProfessionalAction({ limit: 50 }),
    getProfessionalTrustSummary(profile.id),
    getProfessionalDashboardStats(profile.id, profile.trustScore),
    findRecentProfessionalActivity(
      profile.id,
      { isVerified: profile.isVerified, verifiedIdentity: profile.verifiedIdentity },
      3
    ),
    getProfessionalServices(profile.id),
  ])

  const requests = requestsResult.success ? requestsResult.data : []
  const pendingRequests = requests.filter((r) => r.status === "PENDING")
  const nextAppointment = pickNextAppointment(requests)
  const isVisibleInDiscovery = services.some((s) => s.isActive)

  const firstName = profile.displayName.split(" ")[0] || profile.displayName
  const initials = profile.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="page-container max-w-4xl space-y-6 pb-4">
      <section
        className="relative overflow-hidden rounded-[24px] p-5"
        style={{ background: NAVY }}
      >
        <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/[.08]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-sm font-extrabold" style={{ color: NAVY }}>
              {initials}
            </span>
            <div>
              <p className="text-xs text-white/70">Olá,</p>
              <p className="text-lg font-extrabold text-white">{firstName}</p>
            </div>
          </div>
          <Link
            href="/professional/notifications"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.12] text-white transition-colors hover:bg-white/[.18]"
          >
            <Bell className="size-5" />
          </Link>
        </div>
      </section>

      {isVisibleInDiscovery ? (
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#E7F1EC" }}>
          <Eye className="size-5 shrink-0" style={{ color: "#2F6B4F" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2F6B4F" }}>
              Seu perfil está visível no Discovery
            </p>
            <p className="text-xs" style={{ color: "#2F6B4F" }}>
              Tutores podem encontrar você nas buscas.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#FBEDE8" }}>
          <AlertCircle className="size-5 shrink-0" style={{ color: "#B4523F" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "#B4523F" }}>
              Seu perfil está invisível
            </p>
            <p className="text-xs" style={{ color: "#B4523F" }}>
              Ative pelo menos um serviço para aparecer nas buscas.
            </p>
            <Link
              href="/professional/services"
              className="mt-1 inline-block text-xs font-bold underline"
              style={{ color: "#B4523F" }}
            >
              Ir para serviços
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <ProfessionalAttentionCard pendingRequests={pendingRequests} />
          <ProfessionalNextAppointmentCard appointment={nextAppointment} />

          <div className="lg:hidden">
            <ProfessionalQuickActions />
          </div>

          <ProfessionalClientsSummary
            uniqueClients={stats.uniqueClients}
            recurringClients={trustSummary?.recurringClientsCount ?? 0}
            completedServices={stats.completedServices}
          />

          <ProfessionalMetricsRow
            activeRequests={stats.inProgressRequests + pendingRequests.length}
            averageRating={trustSummary?.averageRating ?? null}
            completedServices={stats.completedServices}
          />

          <ProfessionalRecentActivity items={recentActivity} />
        </div>

        <div className="flex flex-col gap-5">
          <div className="hidden lg:block">
            <ProfessionalQuickActions />
          </div>

          {trustSummary && (
            <ProfessionalTrustOverview
              trustScore={trustSummary.trustScore}
              trustLevel={profile.trustLevel}
            />
          )}

          <ProfessionalPublicProfileCTA professionalId={profile.id} />
        </div>
      </div>
    </div>
  )
}
