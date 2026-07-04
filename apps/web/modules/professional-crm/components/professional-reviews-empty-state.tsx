import { MessageSquareHeart } from "lucide-react"

export function ProfessionalReviewsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card p-10 text-center shadow-[var(--shadow-card)]">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessageSquareHeart className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Suas avaliações aparecerão aqui
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Depois de concluir atendimentos, os tutores poderão compartilhar como foi a experiência.
        </p>
      </div>
    </div>
  )
}
