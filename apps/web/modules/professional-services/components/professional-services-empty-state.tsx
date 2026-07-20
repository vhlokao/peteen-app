import { PawPrint } from "lucide-react"

import { Button } from "@/components/ui/button"

const NAVY = "#1D2F6F"

type Props = {
  onCreateClick: () => void
}

export function ProfessionalServicesEmptyState({ onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card p-10 text-center shadow-[var(--shadow-card)]">
      <span
        className="flex size-14 items-center justify-center rounded-2xl"
        style={{ background: "#E8EEF6", color: NAVY }}
      >
        <PawPrint className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Nenhum serviço ainda</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Adicione pelo menos um serviço para aparecer nas buscas.
        </p>
      </div>
      <Button type="button" onClick={onCreateClick} style={{ background: NAVY }}>
        Adicionar serviço
      </Button>
    </div>
  )
}
