import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalNextAction } from "../domain/types"

export function ProfessionalNextActions({
  actions,
}: {
  actions: ProfessionalNextAction[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">O que aumenta sua confiança</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            <Link
              href={action.href}
              className={buttonVariants({
                variant: action.variant,
                size: "sm",
                className: "gap-1 shrink-0",
              })}
            >
              Ir
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
