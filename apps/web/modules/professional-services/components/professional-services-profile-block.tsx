import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { countProfessionalServices } from "@/modules/professional-services/infrastructure/queries"

type Props = {
  professionalId: string
}

export async function ProfessionalServicesProfileBlock({ professionalId }: Props) {
  const count = await countProfessionalServices(professionalId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Serviços cadastrados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Serviços cadastrados:{" "}
          <span className="font-semibold text-foreground">{count}</span>
        </p>
        <Link
          href="/professional/services"
          className="inline-block font-medium text-primary hover:underline"
        >
          Gerenciar serviços →
        </Link>
      </CardContent>
    </Card>
  )
}
