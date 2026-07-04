import Link from "next/link"
import { ShieldCheck } from "lucide-react"

import { TRUST_LEVEL_LABELS, type TrustLevel } from "@/modules/professional/domain/types"

type ProfessionalTrustOverviewProps = {
  trustScore: number
  trustLevel: TrustLevel
}

const TRUST_LEVEL_CONTEXT: Record<TrustLevel, string> = {
  INITIAL:
    "Sua confiança está em construção. Ela avança conforme você conclui atendimentos, recebe avaliações e cria recorrência com tutores.",
  BUILDING:
    "Você já está construindo uma reputação sólida. Continue concluindo atendimentos com qualidade para evoluir de nível.",
  ESTABLISHED:
    "Seu perfil já é reconhecido como confiável na rede. Recorrência e boas avaliações continuam fortalecendo sua posição.",
  TRUSTED:
    "Você está entre os profissionais de destaque da rede. Sua reputação reflete um histórico consistente de bons atendimentos.",
  ELITE:
    "Você alcançou o nível mais alto de confiança da rede Peteen — resultado de um histórico consistente e recorrente.",
}

/**
 * Confiança apresentada com contexto humano — o número nunca aparece
 * isolado, sempre com o nível (TRUST_LEVEL_LABELS, já resolvido pelo
 * Trust Engine) e uma frase de orientação. Nenhum cálculo novo, nenhuma
 * fórmula exposta.
 */
export function ProfessionalTrustOverview({ trustScore, trustLevel }: ProfessionalTrustOverviewProps) {
  return (
    <Link
      href="/professional/metricas"
      className="block rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Confiança profissional
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              {TRUST_LEVEL_LABELS[trustLevel]}
            </span>
            <span className="text-xs text-muted-foreground">
              Índice de Confiança {trustScore.toFixed(1)}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {TRUST_LEVEL_CONTEXT[trustLevel]}
      </p>
    </Link>
  )
}
