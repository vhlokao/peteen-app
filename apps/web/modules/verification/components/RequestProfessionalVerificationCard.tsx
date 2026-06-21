"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { requestMyProfessionalVerificationAction } from "@/modules/verification/application/actions"
import type { ProfessionalVerificationStatus } from "@/modules/professional-crm/domain/types"
import { SUSPENDED_VERIFICATION_MESSAGE } from "@/modules/professional-crm/domain/verification-messages"

type Props = {
  verificationStatus: ProfessionalVerificationStatus
}

export function RequestProfessionalVerificationCard({
  verificationStatus,
}: Props) {
  const [isPending, setIsPending] = useState(false)
  const [requested, setRequested] = useState(verificationStatus === "pending")

  if (verificationStatus === "verified") {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <ShieldCheck className="size-4" />
        Perfil verificado
      </p>
    )
  }

  if (verificationStatus === "suspended") {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {SUSPENDED_VERIFICATION_MESSAGE}
      </p>
    )
  }

  if (verificationStatus === "pending" || requested) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Verificação em análise pela equipe Peteen.
      </p>
    )
  }

  async function handleRequest() {
    setIsPending(true)
    try {
      const res = await requestMyProfessionalVerificationAction()
      if (res.ok) {
        setRequested(true)
        toast.success("Solicitação enviada!")
      } else if (res.code === "already_verified") {
        toast.info(res.error)
      } else {
        toast.error(res.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => void handleRequest()}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      <ShieldCheck className="size-4" />
      {isPending ? "Enviando…" : "Solicitar verificação de perfil"}
    </button>
  )
}
