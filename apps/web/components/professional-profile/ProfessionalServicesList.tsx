import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"

type ServiceItem = {
  id: string
  name: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
}

/**
 * Lista de serviços reais do profissional. Preço sempre secundário
 * (texto pequeno e neutro) — confiança/contexto vêm antes na tela.
 * Nenhum serviço/preço inventado: `services` vem direto de
 * ProfessionalPublicProfile, sem transformação.
 */
export function ProfessionalServicesList({ services }: { services: ServiceItem[] }) {
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum serviço ativo no momento.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {services.map((service) => {
        const priceLabel = formatPublicServicePrice(service)
        return (
          <div
            key={service.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium leading-snug text-foreground">{service.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {SERVICE_TYPE_LABELS[service.serviceType]}
              </p>
            </div>
            {priceLabel && (
              <span className="shrink-0 text-xs text-muted-foreground">{priceLabel}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
