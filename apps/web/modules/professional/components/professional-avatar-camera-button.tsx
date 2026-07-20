"use client"

import { Camera } from "lucide-react"

const NAVY = "#1D2F6F"

/**
 * Botão de câmera sobre o avatar — decorativo (upload de foto é
 * funcionalidade futura). Extraído em Client Component porque
 * ProfessionalProfilePreview é Server Component e não pode receber
 * onClick inline (RSC boundary).
 */
export function ProfessionalAvatarCameraButton() {
  return (
    <button
      type="button"
      aria-label="Alterar foto"
      onClick={() => {}}
      className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-white text-white"
      style={{ background: NAVY }}
    >
      <Camera className="size-3" />
    </button>
  )
}
