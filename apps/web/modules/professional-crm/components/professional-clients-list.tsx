import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalClientRow } from "../domain/types"

export function ProfessionalClientsList({
  clients,
}: {
  clients: ProfessionalClientRow[]
}) {
  const fmt = (d: Date | null) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum cliente ainda. Clientes aparecem após o primeiro serviço concluído.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => (
        <Card key={client.tutorId}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{client.tutorName}</CardTitle>
              </div>
              <Badge variant="secondary">{client.relationshipLevelLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>{client.city}</span>
              <span>
                {client.totalServices} atendimento
                {client.totalServices !== 1 ? "s" : ""}
              </span>
              <span>Último: {fmt(client.lastServiceAt)}</span>
            </div>
            {client.petNames.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Pets: {client.petNames.join(", ")}
              </p>
            )}
            <Link
              href="/requests"
              className="inline-block text-xs font-medium text-primary hover:underline"
            >
              Ver histórico de solicitações →
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
