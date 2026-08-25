"use client"

import { Check, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useShareProfile } from "./use-share-profile"

/**
 * "Compartilhar meu perfil" — ação do profissional para convidar tutores.
 *
 * Esta é a forma BOTÃO, usada na página de perfil. A Home usa a forma CARD
 * (`ShareProfileAction`), para caber entre as Ações rápidas. As duas
 * compartilham a mecânica via `useShareProfile` — a apresentação muda, a
 * decisão de o que é compartilhado não.
 */
export function ShareProfileButton({
  professionalId,
  className,
}: {
  professionalId: string
  className?: string
}) {
  const { copiado, compartilhar } = useShareProfile(professionalId)

  return (
    <Button
      type="button"
      variant="outline"
      className={`touch-target gap-2 ${className ?? ""}`}
      onClick={compartilhar}
    >
      {copiado ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Share2 className="size-4" aria-hidden="true" />
      )}
      {copiado ? "Link copiado" : "Compartilhar meu perfil"}
    </Button>
  )
}
