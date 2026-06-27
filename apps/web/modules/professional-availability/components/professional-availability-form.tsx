"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CalendarClock, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { saveProfessionalAvailabilityAction } from "../application/actions"
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  WEEKDAY_DEFINITIONS,
} from "../domain/constants"
import type { WeeklyAvailabilityRow } from "../domain/types"
import { validateWeeklyAvailability } from "../domain/validation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type Props = {
  initialDays: WeeklyAvailabilityRow[]
  /** `agenda` = página /professional/agenda; `onboarding` = passo do cadastro */
  variant?: "agenda" | "onboarding"
  /** Destino após salvar ou pular (somente onboarding) */
  continueTo?: string
}

type DayState = WeeklyAvailabilityRow

function toDayState(row: WeeklyAvailabilityRow): DayState {
  return {
    weekday: row.weekday,
    isActive: row.isActive,
    startTime: row.startTime ?? DEFAULT_START_TIME,
    endTime: row.endTime ?? DEFAULT_END_TIME,
  }
}

export function ProfessionalAvailabilityForm({
  initialDays,
  variant = "agenda",
  continueTo = "/onboarding/professional/service",
}: Props) {
  const router = useRouter()
  const isOnboarding = variant === "onboarding"

  const [days, setDays] = useState<DayState[]>(() => initialDays.map(toDayState))
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasAnyActive = days.some((d) => d.isActive)

  function updateDay(weekday: number, patch: Partial<DayState>) {
    setFormError(null)
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d))
    )
  }

  function buildPayload() {
    return days.map((d) => ({
      weekday: d.weekday,
      isActive: d.isActive,
      startTime: d.isActive ? d.startTime : null,
      endTime: d.isActive ? d.endTime : null,
    }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (isOnboarding && !hasAnyActive) {
      setFormError("Ative ao menos um dia ou clique em Configurar depois.")
      return
    }

    const parsed = validateWeeklyAvailability(buildPayload())
    if (!parsed.valid) {
      setFormError(parsed.error)
      return
    }

    startTransition(async () => {
      const result = await saveProfessionalAvailabilityAction({ days: parsed.days })

      if (!result.success) {
        const message =
          result.error ?? "Confira os horários informados antes de salvar."
        if (isOnboarding) {
          setFormError(message)
        } else {
          toast.error(message)
        }
        return
      }

      if (result.data) {
        setDays(result.data.map(toDayState))
      }

      if (isOnboarding) {
        router.push(continueTo)
        return
      }

      toast.success("Disponibilidade salva com sucesso.")
    })
  }

  function handleSkip() {
    router.push(continueTo)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      {!hasAnyActive && !isOnboarding ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-6">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Nenhum dia configurado ainda
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ative os dias em que você costuma atender e informe os horários.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dias de atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {WEEKDAY_DEFINITIONS.map((def) => {
            const day = days.find((d) => d.weekday === def.weekday)!
            return (
              <div
                key={def.weekday}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      id={`day-${def.weekday}`}
                      type="checkbox"
                      checked={day.isActive}
                      onChange={(e) =>
                        updateDay(def.weekday, { isActive: e.target.checked })
                      }
                      disabled={isPending}
                      className="size-4 rounded border border-input accent-primary"
                    />
                    <Label
                      htmlFor={`day-${def.weekday}`}
                      className="text-sm font-medium"
                    >
                      {def.label}
                    </Label>
                  </div>
                  {!day.isActive ? (
                    <span className="text-sm text-muted-foreground">Indisponível</span>
                  ) : null}
                </div>

                {day.isActive ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`start-${def.weekday}`} className="text-xs">
                        Das
                      </Label>
                      <Input
                        id={`start-${def.weekday}`}
                        type="time"
                        value={day.startTime ?? DEFAULT_START_TIME}
                        onChange={(e) =>
                          updateDay(def.weekday, { startTime: e.target.value })
                        }
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`end-${def.weekday}`} className="text-xs">
                        Até
                      </Label>
                      <Input
                        id={`end-${def.weekday}`}
                        type="time"
                        value={day.endTime ?? DEFAULT_END_TIME}
                        onChange={(e) =>
                          updateDay(def.weekday, { endTime: e.target.value })
                        }
                        disabled={isPending}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {isOnboarding ? (
        <div className="space-y-2">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full gap-1.5"
            size="lg"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar e continuar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={isPending}
            onClick={handleSkip}
          >
            Configurar depois
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar disponibilidade
          </Button>
        </div>
      )}
    </form>
  )
}
