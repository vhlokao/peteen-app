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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
          ? "Serviço desativado com sucesso."
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{service.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {SERVICE_TYPE_LABELS[service.serviceType]}
            </p>
          </div>
          <Badge variant={service.isActive ? "default" : "secondary"}>
            {service.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Preço base</span>
            <p className="font-medium tabular-nums">
              {formatServiceBasePrice(service)}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Descrição</span>
            <p className="text-muted-foreground">
              {summarizeDescription(service.description)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
            variant={service.isActive ? "secondary" : "default"}
            size="sm"
            className="gap-1.5"
            onClick={toggleActive}
            disabled={isPending}
          >
            {service.isActive ? (
              <>
                <PowerOff className="size-3.5" />
                Desativar
              </>
            ) : (
              <>
                <Power className="size-3.5" />
                Ativar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
