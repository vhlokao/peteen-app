"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { uploadAvatar } from "@/lib/storage/upload-avatar"
import { updateProfessionalProfileAction } from "@/modules/professional/application/actions"

const CORAL = "#E07A5F"

type UploadState = "idle" | "uploading" | "success" | "error"

type AvatarUploadButtonProps = {
  professionalId: string
  userId: string
  onUploadComplete?: (url: string) => void
  className?: string
}

/**
 * Botão de upload de foto de perfil — mesmo visual do antigo botão de
 * câmera decorativo (círculo sobre o avatar), agora funcional: abre o
 * file picker, valida + envia via uploadAvatar (client-side, bucket
 * "avatars"), salva a URL pública através da mesma
 * updateProfessionalProfileAction já usada pelo form de edição (nenhuma
 * Server Action nova), e dá refresh na página pra refletir a foto nova.
 */
export function AvatarUploadButton({
  professionalId,
  userId,
  onUploadComplete,
  className,
}: AvatarUploadButtonProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setState("uploading")
    setError(null)

    try {
      const url = await uploadAvatar(file, userId)

      const result = await updateProfessionalProfileAction(professionalId, {
        avatarUrl: url,
      })

      if (!result.success) {
        throw new Error(result.error || "Foto enviada, mas não foi possível salvar no perfil.")
      }

      setState("success")
      onUploadComplete?.(url)
      toast.success("Foto atualizada com sucesso.")
      router.refresh()
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Não foi possível enviar a foto. Tente novamente.")
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        aria-label="Alterar foto"
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        className="grid size-6 place-items-center rounded-full border-2 border-white text-white disabled:cursor-not-allowed disabled:opacity-70"
        style={{ background: CORAL }}
      >
        {state === "uploading" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Camera className="size-3" />
        )}
      </button>

      {state === "error" && error ? (
        <p
          className="absolute top-full mt-1 w-max max-w-[160px] text-[11px] font-medium leading-tight"
          style={{ color: CORAL }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
