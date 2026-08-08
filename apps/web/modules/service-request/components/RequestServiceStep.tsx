import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { formatPublicServicePrice } from "@/modules/professional/domain/format-service-price"
import { cn } from "@/lib/utils"
import { timedBookingBlockReason } from "../domain/service-duration"

type ServiceOption = {
  id: string
  name: string
  serviceType: ServiceType
  priceMin: number | null
  priceMax: number | null
  /** Ausente = sem duração conhecida → não elegível a agendamento com horário. */
  defaultDurationMin?: number | null
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
 * Preço aparece pequeno/secundário.
 *
 * Service Duration Integrity — todo pedido deste fluxo tem horário real, então
 * um serviço sem duração confiável não pode ser agendado aqui: a Agenda não
 * conseguiria decidir sobreposição parcial. Esses serviços aparecem
 * desabilitados COM o motivo, em vez de deixarem o tutor percorrer o fluxo
 * inteiro para levar erro no submit.
 *
 * A mensagem nunca culpa o profissional. Para hospedagem a limitação é do
 * produto (estadia multi-dia não é representável em minutos hoje), e o texto
 * diz isso — não "o profissional não configurou".
 *
 * O `disabled` aqui é UX, não segurança: o guard real está em
 * createServiceRequestAction.
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
          const blockReason = timedBookingBlockReason(service)
          const disponivel = blockReason === null
          const motivo =
            blockReason === "PRODUCT_LIMITATION"
              ? "Agendamento de hospedagem estará disponível em breve."
              : "Este profissional ainda não configurou a duração deste serviço para agendamentos com horário."
          return (
            <button
              key={service.id}
              type="button"
              disabled={!disponivel}
              aria-disabled={!disponivel}
              onClick={() => disponivel && onSelect(service.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all",
                !disponivel && "cursor-not-allowed opacity-60",
                active
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-card)]"
                  : disponivel
                    ? "border-border hover:border-primary/30 hover:bg-muted/40"
                    : "border-border"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{service.name}</p>
                <span className="mt-1 inline-flex w-fit items-center rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  {SERVICE_TYPE_LABELS[service.serviceType]}
                </span>
                {!disponivel && (
                  <p className="mt-1.5 text-[0.7rem] leading-snug text-muted-foreground">
                    {motivo}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {priceLabel && (
                  <span className="text-xs text-muted-foreground">{priceLabel}</span>
                )}
                {disponivel && (
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-border"
                    )}
                    aria-hidden
                  >
                    {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
