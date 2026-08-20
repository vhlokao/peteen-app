"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { approveVerificationAction } from "@/modules/verification/application/actions"

type Props = {
  requestId: string
  entityName: string
}

export function ApproveVerificationButton({ requestId, entityName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    if (!window.confirm(`Aprovar verificação de "${entityName}"?`)) return

    startTransition(async () => {
      const res = await approveVerificationAction(requestId)
      if (res.ok) {
        toast.success("Verificação aprovada.")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    // Migrado de <button> cru (achado do polimento: sem active/focus-visible
    // consistentes, e "…" como texto de loading não dizia o que estava
    // acontecendo). O Button central resolve hover/press/foco/disabled de
    // graça; `pending` cobre o resto — aria-busy, spinner, texto contextual.
    <Button
      type="button"
      size="xs"
      variant="success"
      onClick={handleApprove}
      pending={isPending}
      pendingText="Aprovando…"
      className="gap-1"
    >
      <CheckCircle2 />
      Aprovar
    </Button>
  )
}
