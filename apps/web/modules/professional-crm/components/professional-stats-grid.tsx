import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Inbox,
  Clock,
  CheckCircle2,
  Users,
  PawPrint,
  Star,
  Shield,
} from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalDashboardStats } from "../domain/types"

type StatCard = {
  key: keyof ProfessionalDashboardStats
  label: string
  icon: LucideIcon
  href: string
  format?: (value: number) => string
}

const STAT_CARDS: StatCard[] = [
  {
    key: "receivedRequests",
    label: "Solicitações recebidas",
    icon: Inbox,
    href: "/requests",
  },
  {
    key: "inProgressRequests",
    label: "Solicitações em andamento",
    icon: Clock,
    href: "/requests",
  },
  {
    key: "completedServices",
    label: "Serviços concluídos",
    icon: CheckCircle2,
    href: "/requests",
  },
  {
    key: "uniqueClients",
    label: "Clientes únicos",
    icon: Users,
    href: "/professional/clients",
  },
  {
    key: "petsAttended",
    label: "Pets atendidos",
    icon: PawPrint,
    href: "/professional/pets",
  },
  {
    key: "reviewsReceived",
    label: "Reviews recebidas",
    icon: Star,
    href: "/professional/reviews",
  },
  {
    key: "trustScore",
    label: "Trust Score atual",
    icon: Shield,
    href: "/professional/metricas",
    format: (v) => Math.round(v).toString(),
  },
]

export function ProfessionalStatsGrid({
  stats,
}: {
  stats: ProfessionalDashboardStats
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {STAT_CARDS.map(({ key, label, icon: Icon, href, format }) => (
        <Link key={key} href={href} className="group block">
          <Card className="transition-colors hover:border-primary/30 hover:bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {format ? format(stats[key]) : stats[key]}
                </span>
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}
