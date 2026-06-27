"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus } from "lucide-react"

import type { ProfessionalServiceRow } from "../domain/types"
import { Button } from "@/components/ui/button"
import { ProfessionalServiceCard } from "./professional-service-card"
import { ProfessionalServiceForm } from "./professional-service-form"
import {
  ProfessionalServicesEmptyState,
} from "./professional-services-empty-state"

type Props = {
  services: ProfessionalServiceRow[]
}

export function ProfessionalServicesList({ services }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  function refresh() {
    router.refresh()
  }

  if (services.length === 0 && !creating) {
    return (
      <ProfessionalServicesEmptyState onCreateClick={() => setCreating(true)} />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {services.length} serviço{services.length !== 1 ? "s" : ""} cadastrado
          {services.length !== 1 ? "s" : ""}
        </p>
        {!creating && (
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Adicionar serviço
          </Button>
        )}
      </div>

      {creating && (
        <ProfessionalServiceForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}

      <div className="space-y-3">
        {services.map((service) => (
          <ProfessionalServiceCard key={service.id} service={service} onEditDone={refresh} />
        ))}
      </div>
    </div>
  )
}
