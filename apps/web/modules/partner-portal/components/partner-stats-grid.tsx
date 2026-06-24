import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Users,
  ThumbsUp,
  ShieldCheck,
  Link2,
  Network,
  BadgeCheck,
} from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { PARTNER_VERIFICATION_STATUS_LABELS } from "@/modules/partners/domain/constants"
import type { PartnerDashboardStats } from "../domain/types"

type StatCard = {
  key: keyof PartnerDashboardStats | "verificationLabel"
  label: string
  icon: LucideIcon
  href: string
  format?: (stats: PartnerDashboardStats) => string
}

const STAT_CARDS: StatCard[] = [
  {
    key: "recommendedProfessionals",
    label: "Profissionais recomendados",
    icon: Users,
    href: "/partner/recommendations",
  },
  {
    key: "activeRecommendations",
    label: "Recomendações ativas",
    icon: ThumbsUp,
    href: "/partner/recommendations",
  },
  {
    key: "verifiedRecommended",
    label: "Profissionais verificados indicados",
    icon: ShieldCheck,
    href: "/partner/recommendations",
  },
  {
    key: "activeConnections",
    label: "Conexões ativas",
    icon: Link2,
    href: "/partner/metrics",
  },
  {
    key: "trustConnectionsGenerated",
    label: "Conexões de Confiança geradas",
    icon: Network,
    href: "/partner/metrics",
  },
  {
    key: "verificationLabel",
    label: "Status da verificação",
    icon: BadgeCheck,
    href: "/partner/profile",
    format: (stats) =>
      PARTNER_VERIFICATION_STATUS_LABELS[stats.verificationStatus],
  },
]

export function PartnerStatsGrid({ stats }: { stats: PartnerDashboardStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STAT_CARDS.map(({ key, label, icon: Icon, href, format }) => {
        const value =
          key === "verificationLabel"
            ? format!(stats)
            : String(stats[key as keyof PartnerDashboardStats])

        return (
          <Link key={key} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/30 hover:bg-muted/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="size-4 text-muted-foreground group-hover:text-primary" />
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {value}
                  </span>
                </div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
