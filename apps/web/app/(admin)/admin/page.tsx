import type { Metadata } from "next"
import Link from "next/link"
import {
  Users, ShieldCheck, Briefcase, PawPrint,
  ClipboardList, Star, TrendingUp, Repeat2,
  AlertCircle, Flag, MessageSquareWarning, EyeOff,
  ShieldAlert, Handshake, Network,
} from "lucide-react"

import { getAdminDashboardAction } from "@/modules/backoffice/application/actions"
import { AdminMetricCard } from "@/components/admin/AdminMetricCard"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

export const metadata: Metadata = { title: "Admin — Visão geral" }

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardAction()

  return (
    <div>
      <AdminPageHeader
        title="Visão geral"
        description="Métricas operacionais em tempo real do Peteen."
      />

      {/* Linha 1: Usuários e personas */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Usuários
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/users">
            <AdminMetricCard
              label="Usuários totais"
              value={metrics.totalUsers}
              icon={<Users className="size-5" />}
            />
          </Link>
          <Link href="/admin/tutors">
            <AdminMetricCard
              label="Tutores"
              value={metrics.totalTutors}
              icon={<ShieldCheck className="size-5" />}
            />
          </Link>
          <Link href="/admin/professionals">
            <AdminMetricCard
              label="Profissionais"
              value={metrics.totalProfessionals}
              icon={<Briefcase className="size-5" />}
            />
          </Link>
          <AdminMetricCard
            label="Pets cadastrados"
            value={metrics.totalPets}
            icon={<PawPrint className="size-5" />}
          />
        </div>
      </section>

      {/* Linha 2: Operacional */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Operacional
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/requests">
            <AdminMetricCard
              label="Solicitações totais"
              value={metrics.totalRequests}
              icon={<ClipboardList className="size-5" />}
            />
          </Link>
          <Link href="/admin/requests?status=PENDING">
            <AdminMetricCard
              label="Pendentes"
              value={metrics.pendingRequests}
              variant={metrics.pendingRequests > 20 ? "warning" : "default"}
              icon={<ClipboardList className="size-5" />}
            />
          </Link>
          <Link href="/admin/requests?status=COMPLETED">
            <AdminMetricCard
              label="Concluídos"
              value={metrics.completedRequests}
              variant="success"
              icon={<ClipboardList className="size-5" />}
            />
          </Link>
          <Link href="/admin/reviews">
            <AdminMetricCard
              label="Avaliações"
              value={metrics.totalReviews}
              icon={<Star className="size-5" />}
            />
          </Link>
        </div>
      </section>

      {/* Linha 3: Confiança e Recorrência */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Confiança e Recorrência
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/trust">
            <AdminMetricCard
              label="Índice de Confiança médio"
              value={`${metrics.averageTrustScore} pts`}
              description="Média entre todos os profissionais"
              icon={<TrendingUp className="size-5" />}
            />
          </Link>
          <Link href="/admin/trust">
            <AdminMetricCard
              label="Score desatualizado"
              value={metrics.professionalsWithStaleScore}
              description="Profissionais sem recálculo nas últimas 24h"
              variant={metrics.professionalsWithStaleScore > 0 ? "warning" : "success"}
              icon={<AlertCircle className="size-5" />}
            />
          </Link>
          <Link href="/admin/relationships">
            <AdminMetricCard
              label="Relacionamentos recorrentes"
              value={metrics.recurringRelationships}
              description="Nível RECURRING, TRUSTED ou PARTNER"
              variant="success"
              icon={<Repeat2 className="size-5" />}
            />
          </Link>
          <Link href="/admin/trust-graph">
            <AdminMetricCard
              label="Conexões de Confiança"
              value={metrics.activeTrustConnections}
              description="Conexões de confiança ativas na rede"
              variant={metrics.activeTrustConnections > 0 ? "success" : "default"}
              icon={<Handshake className="size-5" />}
            />
          </Link>
        </div>
      </section>

      {/* Linha 3b: Parceiros — Etapa 5.9 */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Parceiros
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/admin/partners">
            <AdminMetricCard
              label="Parceiros ativos"
              value={metrics.activePartners}
              icon={<Handshake className="size-5" />}
            />
          </Link>
          <Link href="/admin/partners">
            <AdminMetricCard
              label="Parceiros verificados"
              value={metrics.verifiedPartners}
              variant="success"
              icon={<Handshake className="size-5" />}
            />
          </Link>
          <Link href="/admin/trust-graph">
            <AdminMetricCard
              label="Prof. recomendados por parceiros"
              value={metrics.professionalsRecommendedByPartners}
              description="Profissionais com ≥1 conexão de parceiro"
              icon={<Network className="size-5" />}
            />
          </Link>
        </div>
      </section>

      {/* Linha 4: Moderação & Segurança — Etapa 5.5 */}
      <section className="mt-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Moderação & Segurança
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/flags?status=OPEN">
            <AdminMetricCard
              label="Flags abertas"
              value={metrics.openFlags}
              variant={metrics.openFlags > 0 ? "destructive" : "success"}
              description="Sinais operacionais em aberto"
              icon={<Flag className="size-5" />}
            />
          </Link>
          <Link href="/admin/disputes?status=OPEN">
            <AdminMetricCard
              label="Disputas abertas"
              value={metrics.openDisputes}
              variant={metrics.openDisputes > 0 ? "warning" : "success"}
              description="Disputas aguardando resolução"
              icon={<MessageSquareWarning className="size-5" />}
            />
          </Link>
          <Link href="/admin/reviews">
            <AdminMetricCard
              label="Avaliações ocultadas"
              value={metrics.hiddenReviews}
              variant={metrics.hiddenReviews > 0 ? "warning" : "default"}
              description="Ocultadas por moderação admin"
              icon={<EyeOff className="size-5" />}
            />
          </Link>
          <Link href="/admin/risk">
            <AdminMetricCard
              label="Índice de Risco"
              value="Ver ranking"
              description="Profissionais ordenados por risco"
              icon={<ShieldAlert className="size-5" />}
            />
          </Link>
        </div>
      </section>
    </div>
  )
}
