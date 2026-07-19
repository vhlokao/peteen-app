import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"

const NAVY_SOFT = "#2C4893"

type ServiceItem = {
  id: string
  name: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
}

/** Ícone de pata — sem equivalente exato no lucide-react. */
function PawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="6.5" cy="11" r="2" />
      <circle cx="10.5" cy="7.5" r="2" />
      <circle cx="15" cy="7.5" r="2" />
      <circle cx="18.5" cy="11" r="2" />
      <path d="M12 12.5c-2.6 0-4.5 2.2-4.5 4.2 0 1.7 1.5 2.3 2.8 2.3.9 0 1.2-.35 1.7-.35s.8.35 1.7.35c1.3 0 2.8-.6 2.8-2.3 0-2-1.9-4.2-4.5-4.2Z" />
    </svg>
  )
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
            className="flex items-center justify-between gap-3 rounded-[15px] border border-border/70 bg-card p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "#E8EEF6", color: NAVY_SOFT }}
              >
                <PawIcon className="size-[22px]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-foreground">{service.name}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {SERVICE_TYPE_LABELS[service.serviceType]}
                </p>
              </div>
            </div>
            {priceLabel && (
              <span className="shrink-0 text-[13.5px] font-bold text-muted-foreground">
                {priceLabel}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
