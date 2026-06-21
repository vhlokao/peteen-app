import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Shield,
  Users,
  PawPrint,
  RefreshCw,
  Star,
  ThumbsUp,
  BadgeCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalMetricsData } from "../domain/types"
import { OPERATIONAL_VERIFICATION_LABELS } from "../domain/verification-messages"

type MetricItem = {
  label: string
  value: string | number
  icon: LucideIcon
  href?: string
}

export function ProfessionalMetricsGrid({
  data,
}: {
  data: ProfessionalMetricsData
}) {
  const { stats } = data

  const items: MetricItem[] = [
    {
      label: "Trust Score",
      value: Math.round(stats.trustScore),
      icon: Shield,
    },
    {
      label: "Nível de confiança",
      value: data.trustLevelLabel,
      icon: Shield,
    },
    {
      label: "Clientes únicos",
      value: stats.uniqueClients,
      icon: Users,
      href: "/professional/clients",
    },
    {
      label: "Pets atendidos",
      value: stats.petsAttended,
      icon: PawPrint,
      href: "/professional/pets",
    },
    {
      label: "Clientes recorrentes",
      value: stats.recurringClients,
      icon: RefreshCw,
      href: "/professional/clients",
    },
    {
      label: "Reviews recebidas",
      value: stats.reviewsReceived,
      icon: Star,
      href: "/professional/reviews",
    },
    {
      label: "Recomendações recebidas",
      value: stats.recommendationsReceived,
      icon: ThumbsUp,
    },
    {
      label: "Status da verificação",
      value: OPERATIONAL_VERIFICATION_LABELS[stats.verificationStatus],
      icon: BadgeCheck,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, href }) => {
        const content = (
          <Card className="h-full transition-colors hover:border-primary/30 hover:bg-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-muted-foreground" />
                {label === "Trust Score" ? (
                  <Badge variant="trust" className="text-lg font-semibold tabular-nums">
                    {value}
                  </Badge>
                ) : (
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {value}
                  </span>
                )}
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
          </Card>
        )

        return href ? (
          <Link key={label} href={href} className="block">
            {content}
          </Link>
        ) : (
          <div key={label}>{content}</div>
        )
      })}
    </div>
  )
}
