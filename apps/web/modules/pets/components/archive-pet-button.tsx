"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { archivePetAction } from "@/modules/pets/application/actions"
import { Button } from "@/components/ui/button"

type ArchivePetButtonProps = {
  petId: string
  petName: string
}

export function ArchivePetButton({ petId, petName }: ArchivePetButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleArchive() {
    startTransition(async () => {
      const result = await archivePetAction(petId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${petName} foi arquivado.`)
      router.push("/me/pets")
      router.refresh()
    })
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
        disabled={isPending}
      >
        <Archive className="size-4" />
        Arquivar pet
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm text-muted-foreground">
        Arquivar <strong>{petName}</strong>? O histórico de solicitações é
        preservado.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleArchive}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Confirmar"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
