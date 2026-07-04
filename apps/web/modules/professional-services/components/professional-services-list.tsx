"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus } from "lucide-react"

import type { ProfessionalServiceRow } from "../domain/types"
import { Button } from "@/components/ui/button"
import { ProfessionalServiceCard } from "./professional-service-card"
import { ProfessionalServiceForm } from "./professional-service-form"
import { ProfessionalServicesSummary } from "./professional-services-summary"
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
    <div className="space-y-5">
      <ProfessionalServicesSummary services={services} />

      {!creating && (
        <Button type="button" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Adicionar serviço
        </Button>
      )}

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

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <ProfessionalServiceCard key={service.id} service={service} onEditDone={refresh} />
        ))}
      </div>
    </div>
  )
}
