import type { UseFormRegister, FieldErrors } from "react-hook-form"
import { CalendarDays, Clock, Info } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { RequestFormValues } from "./RequestServiceSheet"

type RequestScheduleStepProps = {
  register: UseFormRegister<RequestFormValues>
  errors: FieldErrors<RequestFormValues>
  todayStr: string
  /**
   * Menor horário aceitável ("HH:mm"), já com a antecedência mínima aplicada.
   * Só vem preenchido quando a data escolhida é o dia do primeiro instante
   * válido; para dias seguintes fica indefinido e todo horário é oferecido.
   */
  minTimeStr?: string
}

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/40"

/**
 * Etapa 3 — data, horário e observações (Agenda Foundation V0.3).
 *
 * Data e horário são campos SEPARADOS (`type="date"` + `type="time"`), não um
 * `datetime-local`: os dois nativos têm melhor suporte e acessibilidade em
 * mobile, e o servidor recebe os componentes civis crus — nunca um instante
 * já convertido pelo fuso do dispositivo.
 */
export function RequestScheduleStep({
  register,
  errors,
  todayStr,
  minTimeStr,
}: RequestScheduleStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scheduledDate" className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            Data desejada
          </Label>
          <input
            id="scheduledDate"
            type="date"
            min={todayStr}
            className={cn(
              fieldClass,
              errors.scheduledDate && "border-destructive focus:ring-destructive/30"
            )}
            {...register("scheduledDate")}
          />
          {errors.scheduledDate && (
            <p className="text-xs text-destructive">{errors.scheduledDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scheduledTime" className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            Horário
          </Label>
          <input
            id="scheduledTime"
            type="time"
            step={300}
            min={minTimeStr}
            className={cn(
              fieldClass,
              errors.scheduledTime && "border-destructive focus:ring-destructive/30"
            )}
            {...register("scheduledTime")}
          />
          {errors.scheduledTime ? (
            <p className="text-xs text-destructive">{errors.scheduledTime.message}</p>
          ) : minTimeStr ? (
            // Só aparece quando a restrição está de fato em vigor (data = hoje).
            // `min` sozinho é silencioso em vários browsers: sem esta linha o
            // usuário não entende por que o horário que ele quer não é aceito.
            <p className="text-xs text-muted-foreground">
              Para hoje, a partir de {minTimeStr}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Necessidades especiais, instruções do pet..."
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
