import { TrendingUp } from "lucide-react"

export function PartnerMetricsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card p-10 text-center shadow-[var(--shadow-card)]">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <TrendingUp className="size-7" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">
          Seu impacto ainda está começando
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Recomende profissionais de confiança para fortalecer a rede.
        </p>
      </div>
    </div>
  )
}
