"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cancelServiceRequestAction } from "@/modules/service-request/application/actions"
import type { RequestStatus } from "@/modules/service-request/domain/types"

type TutorRequestActionsProps = {
  requestId: string
  currentStatus: RequestStatus
}

const CANCELLABLE: RequestStatus[] = ["PENDING", "ACCEPTED"]

export function TutorRequestActions({
  requestId,
  currentStatus,
}: TutorRequestActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (!CANCELLABLE.includes(currentStatus)) {
    return null
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelServiceRequestAction(requestId)
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível cancelar.")
        return
      }
      toast.success("Solicitação cancelada.")
      router.refresh()
    })
  }

  return (
    <Button
      variant="outline"
      className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
      onClick={handleCancel}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <XCircle className="size-4" />
      )}
      Cancelar solicitação
    </Button>
  )
}
