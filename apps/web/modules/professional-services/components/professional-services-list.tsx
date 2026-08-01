"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Loader2, Plus } from "lucide-react"

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

/**
 * Janela de coalescência do refresh (ms).
 *
 * Por quê: cada ProfessionalServiceCard mantém sua própria transição e chama
 * refresh() de forma independente quando sua própria mutação resolve. Se o
 * tutor dispara várias mutações quase juntas (ex.: pausar 2-3 serviços em
 * sequência rápida), cada uma chamaria router.refresh() por conta própria.
 * Debouncing para uma única chamada evita esse desperdício de round-trips —
 * só relevante para cliques em rajada verdadeira (mesmo tick/poucos ms).
 *
 * Causa raiz real do sintoma investigado ("card não aparece imediatamente"):
 * NÃO é uma corrida entre múltiplos payloads do Router Cache. É latência de
 * rede real até o Postgres (medido neste ambiente: ~200-900ms por round-trip
 * ao pooler do Supabase), e cada Server Action + o auto re-render que o
 * Next.js anexa à resposta fazem várias queries SEQUENCIAIS — a soma pode
 * chegar a alguns segundos. Isso não é "corrigível" no código (é a rede),
 * mas o sintoma reportado — usuário achando que "nada aconteceu" — é
 * resolvido comunicando claramente que a lista ainda está sincronizando via
 * `isRefreshing` abaixo, ao invés de deixar o usuário sem nenhum sinal
 * depois que o formulário fecha e o toast de sucesso já sumiu.
 */
const REFRESH_COALESCE_MS = 150

export function ProfessionalServicesList({ services }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])

  function refresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      startRefresh(() => {
        router.refresh()
      })
    }, REFRESH_COALESCE_MS)
  }

  if (services.length === 0 && !creating) {
    return (
      <ProfessionalServicesEmptyState onCreateClick={() => setCreating(true)} />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <ProfessionalServicesSummary services={services} />
        {/* Sinaliza que a lista ainda está sincronizando com o servidor —
            evita a impressão de "nada aconteceu" enquanto o refresh (que
            pode levar alguns segundos sob latência de rede real) resolve. */}
        {isRefreshing && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Atualizando…
          </span>
        )}
      </div>

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

      <div className="grid gap-3 sm:grid-cols-2" style={isRefreshing ? { opacity: 0.7 } : undefined}>
        {services.map((service) => (
          <ProfessionalServiceCard key={service.id} service={service} onEditDone={refresh} />
        ))}
      </div>
    </div>
  )
}
