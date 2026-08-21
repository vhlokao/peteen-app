"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { uploadProfessionalAvatarAction } from "@/modules/professional/application/actions"

const CORAL = "#E07A5F"

type UploadState = "idle" | "uploading" | "success" | "error"

type AvatarUploadButtonProps = {
  professionalId: string
  onUploadComplete?: (url: string) => void
  className?: string
}

/**
 * Botão de upload de foto de perfil — mesmo visual do antigo botão de
 * câmera decorativo (círculo sobre o avatar), funcional: abre o file picker
 * e envia via `uploadProfessionalAvatarAction` (Server Action).
 *
 * P1 SECURITY — AVATAR STORAGE OWNERSHIP: antes o upload ia direto do
 * browser para o Supabase Storage, com o path montado a partir de um
 * `userId` recebido como prop — controlável pelo cliente e, por causa de
 * duas policies de RLS permissivas então existentes, suficiente para
 * sobrescrever o avatar de QUALQUER outro profissional (bucket público).
 * Agora o upload é uma Server Action: o path usa `session.authId`, resolvido
 * no servidor a partir da sessão real, e a ownership do perfil é checada
 * antes de qualquer escrita no Storage. Ver lib/storage/avatar-photo.ts e
 * uploadProfessionalAvatarAction.
 */
export function AvatarUploadButton({
  professionalId,
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

    const formData = new FormData()
    formData.set("file", file)

    const result = await uploadProfessionalAvatarAction(professionalId, formData)

    if (!result.success) {
      setState("error")
      setError(result.error || "Não foi possível enviar a foto. Tente novamente.")
      return
    }

    setState("success")
    onUploadComplete?.(result.data.avatarUrl)
    toast.success("Foto atualizada com sucesso.")
    router.refresh()
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
