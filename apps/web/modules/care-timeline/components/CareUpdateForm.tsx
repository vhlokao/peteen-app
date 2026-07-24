"use client"

/**
 * CareUpdateForm — publicação de uma atualização de cuidado (só profissional).
 *
 * occurredAt usa <input type="datetime-local"> (horário local do profissional);
 * convertido para ISO UTC antes de enviar à Server Action. Após sucesso,
 * router.refresh() re-renderiza o Server Component e a nova atualização aparece
 * na CareTimeline abaixo.
 */

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { publishCareUpdateAction } from "../application/actions"
import {
  CARE_UPDATE_CATEGORIES,
  CARE_CATEGORY_LABELS,
  CARE_UPDATE_CONTENT_MIN,
  CARE_UPDATE_CONTENT_MAX,
  type CareUpdateCategory,
} from "../domain/types"

/** Date → "YYYY-MM-DDTHH:mm" no fuso local (formato do input datetime-local). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CareUpdateForm({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [category, setCategory] = useState<CareUpdateCategory>("CHECK_IN")
  const [content, setContent] = useState("")
  const [occurredAtLocal, setOccurredAtLocal] = useState(() => toLocalInputValue(new Date()))
  const [formError, setFormError] = useState<string | null>(null)
  // Guard síncrono contra duplo-submit (duplo clique / Enter+clique): `isPending`
  // só chega ao `disabled` após um re-render, deixando uma janela de corrida.
  const submitLockRef = useRef(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (submitLockRef.current) return

    const trimmed = content.trim()
    if (trimmed.length < CARE_UPDATE_CONTENT_MIN) {
      setFormError(`Escreva pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres.`)
      return
    }

    // datetime-local é horário local — converte para o instante UTC correto.
    const occurredAtIso = new Date(occurredAtLocal).toISOString()
    setFormError(null)
    submitLockRef.current = true

    startTransition(async () => {
      try {
        const result = await publishCareUpdateAction({
          requestId,
          category,
          content: trimmed,
          occurredAt: occurredAtIso,
        })

        if (!result.success) {
          setFormError(result.error)
          return
        }

        toast.success("Atualização publicada.")
        setContent("")
        setOccurredAtLocal(toLocalInputValue(new Date()))
        router.refresh()
      } finally {
        submitLockRef.current = false
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-category">Categoria</Label>
        <select
          id="care-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as CareUpdateCategory)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {CARE_UPDATE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CARE_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-content">O que aconteceu?</Label>
        <Textarea
          id="care-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (formError) setFormError(null)
          }}
          rows={3}
          maxLength={CARE_UPDATE_CONTENT_MAX}
          placeholder="Ex: Rex almoçou bem e ficou tranquilo depois do passeio."
          disabled={isPending}
        />
        <span className="self-end text-xs text-muted-foreground">
          {content.trim().length}/{CARE_UPDATE_CONTENT_MAX}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="care-occurred-at">Quando</Label>
        <input
          id="care-occurred-at"
          type="datetime-local"
          value={occurredAtLocal}
          onChange={(e) => setOccurredAtLocal(e.target.value)}
          disabled={isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {formError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      <Button type="submit" className="w-full gap-2" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Publicando...
          </>
        ) : (
          <>
            <Send className="size-4" />
            Publicar atualização
          </>
        )}
      </Button>
    </form>
  )
}
