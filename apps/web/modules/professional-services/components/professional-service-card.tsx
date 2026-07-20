"use client"

import { useState, useTransition } from "react"
import {
  Pencil,
  Footprints,
  House,
  Building2,
  Scissors,
  GraduationCap,
  Stethoscope,
  Sun,
  HeartHandshake,
  PawPrint,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { Button } from "@/components/ui/button"
import { ProfessionalServiceForm } from "./professional-service-form"

const NAVY = "#1D2F6F"
const GREEN = "#40916C"
const GRAY = "#D6D3C9"

const SERVICE_TYPE_ICONS: Record<ServiceType, LucideIcon> = {
  DOG_WALK: Footprints,
  PET_SITTING: House,
  BOARDING: Building2,
  GROOMING: Scissors,
  TRAINING: GraduationCap,
  VET_ACCOMPANY: Stethoscope,
  DAY_CARE: Sun,
  HOME_CARE: HeartHandshake,
  OTHER: PawPrint,
}

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

  const Icon = SERVICE_TYPE_ICONS[service.serviceType]

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition-opacity"
      style={!service.isActive ? { opacity: 0.6 } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-xl"
            style={{ background: `${NAVY}14`, color: NAVY }}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">{service.name}</p>
            <p className="text-xs text-muted-foreground">{SERVICE_TYPE_LABELS[service.serviceType]}</p>
          </div>
        </div>
        {!service.isActive && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
            Pausado
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-xs text-muted-foreground">Preço </span>
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

      <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
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

        <button
          type="button"
          role="switch"
          aria-checked={service.isActive}
          aria-label={service.isActive ? "Pausar serviço" : "Ativar serviço"}
          onClick={toggleActive}
          disabled={isPending}
          className="relative shrink-0 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50"
          style={{
            width: 50,
            height: 28,
            background: service.isActive ? GREEN : GRAY,
          }}
        >
          <span
            className="absolute top-[3px] rounded-full bg-white shadow-sm transition-all"
            style={{
              width: 22,
              height: 22,
              left: service.isActive ? 25 : 3,
            }}
          />
        </button>
      </div>
    </div>
  )
}
