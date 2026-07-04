import Link from "next/link"
import { Bell, CheckCircle2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { PartnerVerificationStatus } from "@/modules/partners/domain/types"

type PartnerAttentionCardProps = {
  verificationStatus: PartnerVerificationStatus
}

/**
 * Bloco principal da Home. Não existe fluxo de "recomendação pendente de
 * análise" no modelo (recomendações nascem ativas) — o sinal real de
 * atenção disponível hoje é o status de verificação da organização.
 */
export function PartnerAttentionCard({ verificationStatus }: PartnerAttentionCardProps) {
  if (verificationStatus === "PENDING_VERIFICATION") {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/[0.02] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Atenção agora
            </p>
            <p className="mt-0.5 text-base font-semibold text-foreground">
              Sua verificação está em análise
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A equipe Peteen está avaliando os dados da sua organização.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (verificationStatus === "NONE") {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/[0.02] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Atenção agora
            </p>
            <p className="mt-0.5 text-base font-semibold text-foreground">
              Sua organização ainda não é verificada
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Organizações verificadas transmitem mais confiança na rede.
            </p>
          </div>
        </div>
        <Link href="/partner/profile" className={buttonVariants({ size: "sm", className: "mt-4 w-full" })}>
          Solicitar verificação
        </Link>
      </section>
    )
  }

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CheckCircle2 className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Nenhuma pendência no momento.</p>
    </section>
  )
}
