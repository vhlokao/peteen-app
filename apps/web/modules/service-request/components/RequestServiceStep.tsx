import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"
import { cn } from "@/lib/utils"

type ServiceOption = {
  id: string
  name: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
}

type RequestServiceStepProps = {
  services: ServiceOption[]
  selectedServiceId: string
  onSelect: (serviceId: string) => void
  error?: string
}

/**
 * Etapa 2 — escolha do serviço. Só mostra serviços reais e ativos do
 * profissional (`professional.services`, já filtrado por isActive na query).
 * Preço aparece pequeno/secundário — nenhuma duração ou descrição é exibida
 * porque não existem nos dados atuais (não inventadas).
 */
export function RequestServiceStep({
  services,
  selectedServiceId,
  onSelect,
  error,
}: RequestServiceStepProps) {
  return (
    <div>
      <div className="flex flex-col gap-2.5">
        {services.map((service) => {
          const active = service.id === selectedServiceId
          const priceLabel = formatPublicServicePrice(service)
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all",
                active
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]"
                  : "border-border hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{service.name}</p>
                <span className="mt-1 inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  {SERVICE_TYPE_LABELS[service.serviceType]}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {priceLabel && (
                  <span className="text-xs text-muted-foreground">{priceLabel}</span>
                )}
                <div
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary bg-primary" : "border-border"
                  )}
                  aria-hidden
                >
                  {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
