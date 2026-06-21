"use client"

import { useState, useTransition } from "react"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { requestMyProfessionalVerificationAction } from "@/modules/verification/application/actions"

type Props = {
  hasPendingRequest: boolean
  isVerified: boolean
}

export function RequestProfessionalVerificationCard({
  hasPendingRequest,
  isVerified,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [requested, setRequested] = useState(hasPendingRequest)

  if (isVerified) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ShieldCheck className="size-4" />
        Perfil verificado
      </p>
    )
  }

  if (requested || hasPendingRequest) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Verificação em análise pela equipe Peteen.
      </p>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await requestMyProfessionalVerificationAction()
          if (res.ok) {
            setRequested(true)
            toast.success("Solicitação enviada!")
          } else if (res.code === "already_verified") {
            toast.info(res.error)
          } else {
            toast.error(res.error)
          }
        })
      }
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      <ShieldCheck className="size-4" />
      {isPending ? "Enviando…" : "Solicitar verificação de perfil"}
    </button>
  )
}
