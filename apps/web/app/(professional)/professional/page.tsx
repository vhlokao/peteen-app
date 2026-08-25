import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, Bell, Eye } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { RequestListAutoRefresh } from "@/modules/service-request/components/ActiveRequestAutoRefresh"
import { buildRequestListSyncToken } from "@/modules/service-request/domain/active-request-sync"
import { getProfessionalRequestListSyncSnapshot } from "@/modules/service-request/infrastructure/sync-snapshot"
import { ErrorState } from "@/components/shared/feedback/ErrorState"

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

  // PRE-PILOT POLISH — CRITICAL FLOW PERFORMANCE & RESILIENCE: o snapshot do
  // probe de lista não depende de nenhum dos outros cinco — antes rodava
  // isolado, DEPOIS deste Promise.all, uma waterfall evitável.
  const [requestsResult, trustSummary, stats, recentActivity, services, syncSnapshot] =
    await Promise.all([
      getMyRequestsAsProfessionalAction({ limit: 50 }),
      getProfessionalTrustSummary(profile.id),
      getProfessionalDashboardStats(profile.id, profile.trustScore),
      findRecentProfessionalActivity(
        profile.id,
        { isVerified: profile.isVerified, verifiedIdentity: profile.verifiedIdentity },
        3
      ),
      getProfessionalServices(profile.id),
      getProfessionalRequestListSyncSnapshot(profile.id),
    ])

  // CRITICAL FLOW PERFORMANCE — FINAL CLOSURE: falha real de busca NÃO é
  // "nenhuma solicitação". Antes, `success ? data : []` colapsava os dois, e o
  // profissional via "Nenhuma solicitação nova" mesmo com pedidos reais
  // esperando resposta — o pior caso possível nesta tela. As demais seções
  // (reputação, métricas de histórico, atividade, confiança) vêm de outras
  // queries e seguem renderizando normalmente.
  const requestsFailed = !requestsResult.success
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

  const initialSyncToken = buildRequestListSyncToken(syncSnapshot)

  return (
    <RequestListAutoRefresh role="professional" initialToken={initialSyncToken}>
    <div className="page-container max-w-4xl space-y-6 pb-4">
      <section
        className="relative overflow-hidden rounded-[24px] p-5"
        style={{ background: NAVY }}
      >
        <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-white/[.08]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 shrink-0 rounded-xl bg-white">
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />}
              <AvatarFallback className="rounded-xl bg-white text-sm font-extrabold" style={{ color: NAVY }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-white/70">Olá,</p>
              <h1 className="text-lg font-extrabold text-white">{firstName}</h1>
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
          {/* Os dois cards vêm da MESMA busca — um único ErrorState no lugar
              dos dois, com um só "Tentar novamente", em vez de repetir o
              mesmo aviso e o mesmo botão duas vezes seguidas. */}
          {requestsFailed ? (
            <ErrorState
              compact
              title="Não deu para carregar suas solicitações"
              description="Algo falhou ao buscar seus pedidos e atendimentos. Tente novamente em alguns instantes."
            />
          ) : (
            <>
              <ProfessionalAttentionCard pendingRequests={pendingRequests} />
              <ProfessionalNextAppointmentCard appointment={nextAppointment} />
            </>
          )}

          <div className="lg:hidden">
            <ProfessionalQuickActions
              professionalId={profile.id}
              professionalName={profile.displayName}
            />
          </div>

          {/* Confiança ANTES de clientes/métricas/atividade no mobile.
              A coluna da direita só existe a partir de `lg`; abaixo disso o
              grid vira uma coluna só e a ordem do DOM é a ordem da tela — com
              o card na direita, ele caía depois de métricas e atividade
              recente, ou seja, "como está minha confiança?" ficava atrás de
              números secundários. Renderizado aqui, aparece logo após as ações
              rápidas. Em `lg` o bloco é ocultado e reaparece na direita, onde
              a diagramação de duas colunas já funcionava. */}
          {trustSummary && (
            <div className="lg:hidden">
              <ProfessionalTrustOverview
                trustScore={trustSummary.trustScore}
                trustLevel={profile.trustLevel}
              />
            </div>
          )}

          <ProfessionalClientsSummary
            uniqueClients={stats.uniqueClients}
            recurringClients={trustSummary?.recurringClientsCount ?? 0}
            completedServices={stats.completedServices}
          />

          {/* "Ativas" é a ÚNICA das três métricas que depende da busca de
              requests (soma pendentes a `stats.inProgressRequests`). Com a
              busca falha o total sairia subcontado e pareceria definitivo —
              então vira "—". `averageRating` (trustSummary) e
              `completedServices` (stats) vêm de outras queries e continuam
              exibindo seus números normalmente. A definição funcional de
              "Ativas" não mudou. */}
          <ProfessionalMetricsRow
            activeRequests={
              requestsFailed ? null : stats.inProgressRequests + pendingRequests.length
            }
            averageRating={trustSummary?.averageRating ?? null}
            completedServices={stats.completedServices}
          />

          <ProfessionalRecentActivity items={recentActivity} />
        </div>

        <div className="flex flex-col gap-5">
          <div className="hidden lg:block">
            <ProfessionalQuickActions
              professionalId={profile.id}
              professionalName={profile.displayName}
            />
          </div>

          {/* Par do bloco `lg:hidden` na coluna esquerda — o mesmo card, uma
              única instância visível por vez. */}
          {trustSummary && (
            <div className="hidden lg:block">
              <ProfessionalTrustOverview
                trustScore={trustSummary.trustScore}
                trustLevel={profile.trustLevel}
              />
            </div>
          )}

          <ProfessionalPublicProfileCTA professionalId={profile.id} />
        </div>
      </div>
    </div>
    </RequestListAutoRefresh>
  )
}
