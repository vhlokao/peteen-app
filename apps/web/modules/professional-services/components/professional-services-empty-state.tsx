import { PackagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Props = {
  onCreateClick: () => void
}

export function ProfessionalServicesEmptyState({ onCreateClick }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <PackagePlus className="size-10 text-muted-foreground/60" aria-hidden />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Nenhum serviço cadastrado
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Adicione seu primeiro serviço para começar a receber solicitações.
          </p>
        </div>
        <Button type="button" onClick={onCreateClick}>
          Cadastrar serviço
        </Button>
      </CardContent>
    </Card>
  )
}
