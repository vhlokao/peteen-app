import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, History, RotateCcw } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import type { HiredProfessionalSummary } from "../domain/types"

export function HiredProfessionalsBlock({
  professionals,
}: {
  professionals: HiredProfessionalSummary[]
}) {
  return (
    <Card id="profissionais">
      <CardHeader>
        <CardTitle className="text-base">
          Profissionais que você já contratou
        </CardTitle>
      </CardHeader>
      <CardContent>
        {professionals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Quando concluir um atendimento, o profissional aparecerá aqui para
            recontratação rápida.
          </p>
        ) : (
          <ul className="space-y-3">
            {professionals.map((pro) => (
              <li
                key={pro.professionalId}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar size="lg">
                    {pro.avatarUrl ? (
                      <AvatarImage src={pro.avatarUrl} alt={pro.displayName} />
                    ) : null}
                    <AvatarFallback>
                      {pro.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {pro.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">{pro.city}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SERVICE_TYPE_LABELS[pro.lastServiceType]} ·{" "}
                      {pro.totalServices} atendimento
                      {pro.totalServices !== 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      Última:{" "}
                      {format(pro.lastHiredAt, "d MMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/tutor/professionals/${pro.professionalId}`}
                    className={buttonVariants({ size: "sm", className: "gap-1" })}
                  >
                    <History className="size-3.5" />
                    Ver histórico
                  </Link>
                  <Link
                    href={`/discover/${pro.professionalId}`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    Ver perfil público
                  </Link>
                  <Link
                    href={`/discover/${pro.professionalId}`}
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                      className: "gap-1",
                    })}
                  >
                    <RotateCcw className="size-3.5" />
                    Contratar novamente
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
