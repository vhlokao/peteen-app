import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PawPrint } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProfessionalPetRow } from "../domain/types"

const SPECIES_LABELS: Record<string, string> = {
  DOG: "Cão",
  CAT: "Gato",
  BIRD: "Ave",
  RODENT: "Roedor",
  OTHER: "Outro",
}

export function ProfessionalPetsList({ pets }: { pets: ProfessionalPetRow[] }) {
  const fmt = (d: Date | null) =>
    d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—"

  if (pets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum pet atendido ainda. Pets aparecem após serviços concluídos.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {pets.map((pet) => (
        <Card key={pet.petId}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <PawPrint className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{pet.petName}</CardTitle>
              </div>
              <Badge variant="outline">
                {SPECIES_LABELS[pet.species] ?? pet.species}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>Tutor: {pet.tutorName}</span>
              <span>
                {pet.attendanceCount} atendimento
                {pet.attendanceCount !== 1 ? "s" : ""}
              </span>
              <span>Último: {fmt(pet.lastServiceAt)}</span>
            </div>
            {pet.attendanceCount >= 2 && (
              <p className="text-xs text-emerald-700">
                Cliente recorrente — histórico positivo para reputação.
              </p>
            )}
            <Link
              href="/requests"
              className="inline-block text-xs font-medium text-primary hover:underline"
            >
              Ver solicitações relacionadas →
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
