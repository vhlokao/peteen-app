"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Loader2, MessageSquare, PawPrint, User } from "lucide-react"

const NAVY = "#1D2F6F"

import { createReviewAction } from "@/modules/review/application/actions"
import { StarRatingInput } from "@/components/reviews/StarRatingInput"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// ─────────────────────────────────────────────────────────────────────────────
// Props — contexto para exibição (não enviado ao action, que busca do banco)
// ─────────────────────────────────────────────────────────────────────────────

type ReviewFormProps = {
  requestId: string
  professionalName: string
  serviceTypeLabel: string
  petName: string
  petSpeciesLabel: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewForm({
  requestId,
  professionalName,
  serviceTypeLabel,
  petName,
  petSpeciesLabel,
}: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const MAX_COMMENT = 1000

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (rating === 0) {
      setFormError("Selecione uma nota de 1 a 5 estrelas.")
      return
    }

    setFormError(null)

    startTransition(async () => {
      const result = await createReviewAction({
        requestId,
        rating,
        comment: comment.trim() || undefined,
      })

      if (!result.success) {
        setFormError(result.error ?? "Erro ao enviar avaliação. Tente novamente.")
        return
      }

      toast.success("Avaliação enviada!", {
        description: "Obrigado pelo feedback. Ele ajuda outros tutores.",
      })

      // Re-renderiza o Server Component — o formulário some e o card de review aparece
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Contexto do atendimento */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Você está avaliando
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <User className="size-3.5 shrink-0 text-muted-foreground" />
            <span>
              <strong>{professionalName}</strong>
              <span className="ml-1 text-muted-foreground">— {serviceTypeLabel}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PawPrint className="size-3.5 shrink-0" />
            <span>
              {petName}{" "}
              <span className="text-xs">({petSpeciesLabel})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Seleção de estrelas */}
      <div className="flex flex-col items-center gap-1 py-2">
        <p className="mb-3 text-sm font-medium text-foreground">
          Como foi sua experiência?
        </p>
        <StarRatingInput
          value={rating}
          onChange={(r) => {
            setRating(r)
            setFormError(null)
          }}
          size="lg"
          disabled={isPending}
        />
      </div>

      {/* Comentário */}
      <div className="space-y-1.5">
        <Label htmlFor="review-comment" className="flex items-center gap-1.5">
          <MessageSquare className="size-3.5 text-muted-foreground" />
          Comentário{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="review-comment"
          placeholder="O profissional foi pontual? Seu pet ficou confortável? Algum detalhe importante?"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          rows={3}
          disabled={isPending}
        />
        {comment.length > MAX_COMMENT * 0.8 && (
          <p className="text-right text-xs text-muted-foreground">
            {comment.length}/{MAX_COMMENT}
          </p>
        )}
      </div>

      {/* Erro */}
      {formError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        style={{ background: NAVY }}
        disabled={isPending || rating === 0}
      >
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {isPending ? "Enviando avaliação…" : "Enviar avaliação"}
      </Button>
    </form>
  )
}
