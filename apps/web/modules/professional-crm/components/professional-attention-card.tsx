import Link from "next/link"
import { Bell, PawPrint } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { SPECIES_LABELS } from "@/modules/tutor/domain/types"
import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"

type ProfessionalAttentionCardProps = {
  pendingRequests: ServiceRequestWithParticipants[]
}

/**
 * Bloco principal da Home — o que precisa da atenção do profissional agora.
 * Só reflete PENDING reais (nenhuma action de aceitar/recusar aqui, isso
 * já existe em /requests e não é duplicado nesta tela).
 */
export function ProfessionalAttentionCard({ pendingRequests }: ProfessionalAttentionCardProps) {
  const count = pendingRequests.length

  if (count === 0) {
    return (
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Nenhuma solicitação aguardando resposta.
          </p>
        </div>
      </section>
    )
  }

  const first = pendingRequests[0]!
  const serviceLabel = SERVICE_TYPE_LABELS[first.serviceType as ServiceType]

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
            {count === 1 ? "Você tem 1 nova solicitação" : `Você tem ${count} novas solicitações`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <PawPrint className="size-3.5 shrink-0" />
            <span className="truncate">
              {serviceLabel} · {first.tutor.displayName}
              {first.pet ? ` · ${first.pet.name} (${SPECIES_LABELS[first.pet.species]})` : ""}
            </span>
          </p>
        </div>
      </div>
      <Link
        href="/requests"
        className={buttonVariants({ size: "sm", className: "mt-4 w-full" })}
      >
        Ver solicitações
      </Link>
    </section>
  )
}
