import type { UseFormRegister, FieldErrors } from "react-hook-form"
import { CalendarDays, Info } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { RequestFormValues } from "./RequestServiceSheet"

type RequestScheduleStepProps = {
  register: UseFormRegister<RequestFormValues>
  errors: FieldErrors<RequestFormValues>
  todayStr: string
}

/**
 * Etapa 3 — data e observações. Mesmos campos reais de sempre
 * (scheduledAt como input type="date", notes opcional) — só o visual mudou.
 * Não adiciona horário: a lógica atual só suporta data (ver auditoria).
 */
export function RequestScheduleStep({ register, errors, todayStr }: RequestScheduleStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt" className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          Data desejada
        </Label>
        <input
          id="scheduledAt"
          type="date"
          min={todayStr}
          className={cn(
            "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm shadow-xs",
            "focus:outline-none focus:ring-2 focus:ring-ring/40",
            errors.scheduledAt && "border-destructive focus:ring-destructive/30"
          )}
          {...register("scheduledAt")}
        />
        {errors.scheduledAt && (
          <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Necessidades especiais, horário preferido, instruções do pet..."
          rows={4}
          className="rounded-xl"
          {...register("notes")}
        />
        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>A disponibilidade será confirmada pelo profissional.</span>
      </div>
    </div>
  )
}
