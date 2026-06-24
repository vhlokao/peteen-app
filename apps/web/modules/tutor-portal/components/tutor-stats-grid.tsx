import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  PawPrint,
  Inbox,
  CheckCircle2,
  Users,
  Star,
} from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { TutorDashboardStats } from "../domain/types"

type StatCard = {
  key: keyof TutorDashboardStats
  label: string
  icon: LucideIcon
  href: string
}

const STAT_CARDS: StatCard[] = [
  { key: "activePets", label: "Pets ativos", icon: PawPrint, href: "/me/pets" },
  {
    key: "openRequests",
    label: "Solicitações abertas",
    icon: Inbox,
    href: "/tutor/requests",
  },
  {
    key: "completedRequests",
    label: "Solicitações concluídas",
    icon: CheckCircle2,
    href: "/tutor/requests",
  },
  {
    key: "hiredProfessionals",
    label: "Profissionais contratados",
    icon: Users,
    href: "/tutor#profissionais",
  },
  { key: "reviewsGiven", label: "Avaliações enviadas", icon: Star, href: "/tutor/requests" },
]

export function TutorStatsGrid({ stats }: { stats: TutorDashboardStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {STAT_CARDS.map(({ key, label, icon: Icon, href }) => (
        <Link key={key} href={href} className="group block">
          <Card className="transition-colors hover:border-primary/30 hover:bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {stats[key]}
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
