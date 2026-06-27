"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createDisputeForRequestAction } from "../application/actions"
import {
  DISPUTE_REASON_OPTIONS,
  type DisputeReason,
} from "../domain/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  requestId: string
  onSuccess: () => void
  onCancel: () => void
}

export function DisputeForm({ requestId, onSuccess, onCancel }: Props) {
  const [reason, setReason] = useState<DisputeReason>(DISPUTE_REASON_OPTIONS[0])
  const [description, setDescription] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      const result = await createDisputeForRequestAction(requestId, {
        reason,
        description: description.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.error ?? "Erro ao abrir disputa.")
        return
      }

      toast.success("Disputa aberta com sucesso.")
      toast.message("Sua solicitação foi enviada para análise.")
      onSuccess()
    })
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reportar problema</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Motivo</Label>
            <select
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isPending}
            >
              {DISPUTE_REASON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispute-description">Descrição</Label>
            <Textarea
              id="dispute-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que aconteceu com o máximo de detalhes possível."
              rows={4}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar disputa
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type ReportButtonProps = {
  requestId: string
}

export function DisputeReportSection({ requestId }: ReportButtonProps) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <DisputeForm
        requestId={requestId}
        onCancel={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
      />
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Problemas com o atendimento
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Se algo não saiu como esperado, você pode reportar para análise da equipe Peteen.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Reportar problema
      </Button>
    </section>
  )
}
