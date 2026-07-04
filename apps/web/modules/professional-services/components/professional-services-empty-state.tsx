import { PackagePlus } from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  onCreateClick: () => void
}

export function ProfessionalServicesEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card p-10 text-center shadow-[var(--shadow-card)]">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <PackagePlus className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Adicione seu primeiro serviço</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Mostre aos tutores como você pode cuidar dos pets deles.
        </p>
      </div>
      <Button type="button" onClick={onCreateClick}>
        Adicionar serviço
      </Button>
    </div>
  )
}
