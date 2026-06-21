import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PawPrint } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RelationshipPetRow } from "../domain/types"

export function RelationshipPetsList({ pets }: { pets: RelationshipPetRow[] }) {
  const fmt = (d: Date | null) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pets atendidos</CardTitle>
      </CardHeader>
      <CardContent>
        {pets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pet relacionado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pets.map((pet) => (
              <li
                key={pet.petId}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-2">
                  <PawPrint className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{pet.petName}</p>
                    <p className="text-xs text-muted-foreground">
                      {pet.attendanceCount} atendimento
                      {pet.attendanceCount !== 1 ? "s" : ""} · Último:{" "}
                      {fmt(pet.lastServiceAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{pet.species}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
