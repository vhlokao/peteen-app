"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cancelServiceRequestAction } from "@/modules/service-request/application/actions"
import { useSuspendAutoRefreshWhileEditing } from "@/modules/service-request/components/ActiveRequestAutoRefresh"
import type { RequestStatus } from "@/modules/service-request/domain/types"

const CORAL = "#E07A5F"

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

  // Uma mutação em voo (o cancelamento chamando o servidor) não pode disputar
  // com um router.refresh() automático disparado no meio do caminho — os dois
  // acabariam competindo pelo mesmo ciclo de render.
  useSuspendAutoRefreshWhileEditing(isPending)

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
      className="w-full gap-2"
      style={{ borderColor: `${CORAL}66`, color: CORAL }}
      onClick={handleCancel}
      disabled={isPending}
      pending={isPending}
      pendingText="Cancelando…"
    >
      <XCircle />
      Cancelar solicitação
    </Button>
  )
}
