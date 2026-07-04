"use client"

import { useState, useTransition } from "react"
import { Pencil, Power, PowerOff } from "lucide-react"
import { toast } from "sonner"

import {
  activateProfessionalServiceAction,
  deactivateProfessionalServiceAction,
} from "../application/actions"
import {
  formatServiceBasePrice,
  summarizeDescription,
  type ProfessionalServiceRow,
} from "../domain/types"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import { Button } from "@/components/ui/button"
import { ProfessionalServiceForm } from "./professional-service-form"

type Props = {
  service: ProfessionalServiceRow
  onEditDone: () => void
}

export function ProfessionalServiceCard({ service, onEditDone }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggleActive() {
    startTransition(async () => {
      const result = service.isActive
        ? await deactivateProfessionalServiceAction(service.id)
        : await activateProfessionalServiceAction(service.id)

      if (!result.success) {
        toast.error(result.error ?? "Erro ao atualizar serviço.")
        return
      }

      toast.success(
        service.isActive
          ? "Serviço pausado com sucesso."
          : "Serviço ativado com sucesso."
      )
      onEditDone()
    })
  }

  if (editing) {
    return (
      <ProfessionalServiceForm
        mode="edit"
        service={service}
        onCancel={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false)
          onEditDone()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-foreground">{service.name}</p>
          <p className="text-xs text-muted-foreground">{SERVICE_TYPE_LABELS[service.serviceType]}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${
            service.isActive
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {service.isActive ? "Ativo" : "Pausado"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-xs text-muted-foreground">Preço base </span>
          <span className="font-medium tabular-nums text-foreground">
            {formatServiceBasePrice(service)}
          </span>
        </div>
      </div>

      {service.description && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {summarizeDescription(service.description)}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setEditing(true)}
          disabled={isPending}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        <Button
          type="button"
          variant={service.isActive ? "outline" : "default"}
          size="sm"
          className="gap-1.5"
          onClick={toggleActive}
          disabled={isPending}
        >
          {service.isActive ? (
            <>
              <PowerOff className="size-3.5" />
              Pausar
            </>
          ) : (
            <>
              <Power className="size-3.5" />
              Ativar
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
