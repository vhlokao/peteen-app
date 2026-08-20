"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Botão "Tentar novamente" de um ErrorState. `router.refresh()` re-executa
 * os Server Components da rota atual — o mesmo mecanismo que o auto-sync já
 * usa — sem navegação cheia nem perder a URL/params atuais.
 */
export function RetryLink() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={isPending}
      pending={isPending}
      pendingText="Tentando…"
      onClick={() => startTransition(() => router.refresh())}
    >
      <RotateCw className="size-4" />
      Tentar novamente
    </Button>
  )
}
