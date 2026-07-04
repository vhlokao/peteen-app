import { Network } from "lucide-react"

type PartnerImpactCardProps = {
  activeRecommendations: number
  verifiedRecommended: number
}

/**
 * Impacto em linguagem humana — só aparece se houver dado real
 * (nenhuma recomendação ativa = nada a mostrar aqui ainda).
 */
export function PartnerImpactCard({
  activeRecommendations,
  verifiedRecommended,
}: PartnerImpactCardProps) {
  if (activeRecommendations === 0) return null

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Network className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Impacto na rede
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {activeRecommendations === 1
              ? "1 profissional recomendado por você está ativo na rede."
              : `${activeRecommendations} profissionais recomendados por você estão ativos na rede.`}
          </p>
        </div>
      </div>
      {verifiedRecommended > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {verifiedRecommended === 1
            ? "1 deles já é verificado pela equipe Peteen."
            : `${verifiedRecommended} deles já são verificados pela equipe Peteen.`}
        </p>
      )}
    </section>
  )
}
