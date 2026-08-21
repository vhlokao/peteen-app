"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

const CORAL = "#E07A5F"

type UploadState = "idle" | "uploading" | "success" | "error"

/** Formato mínimo comum a `ActionResult<{avatarUrl}>` de qualquer módulo. */
type AvatarUploadResult =
  | { success: true; data: { avatarUrl: string } }
  | { success: false; error: string }

type AvatarUploadButtonProps = {
  profileId: string
  /**
   * A Server Action que faz o upload de fato — `uploadProfessionalAvatarAction`
   * ou `uploadTutorAvatarAction`. Este componente não sabe (nem precisa
   * saber) qual papel está chamando: ownership, path e persistência são
   * responsabilidade da action, cada uma com sua própria checagem de sessão.
   */
  uploadAction: (profileId: string, formData: FormData) => Promise<AvatarUploadResult>
  onUploadComplete?: (url: string) => void
  className?: string
}

/**
 * Botão de upload de foto de perfil — círculo com ícone de câmera sobreposto
 * ao avatar. Compartilhado entre Tutor e Profissional: a UI, a validação de
 * arquivo e o storage são os MESMOS para os dois papéis (ver
 * lib/storage/avatar-photo.ts); só a Server Action muda, porque só ela sabe
 * qual tabela (TutorProfile/ProfessionalProfile) atualizar e como checar
 * ownership daquele perfil especificamente.
 *
 * Extraído de modules/professional/components/AvatarUploadButton.tsx
 * (TUTOR AVATAR / IDENTITY COMPLETENESS) — antes vivia dentro do módulo
 * `professional` e recebia a action hardcoded, o que exigiria copiar o
 * componente inteiro para o tutor usar a mesma experiência.
 */
export function AvatarUploadButton({
  profileId,
  uploadAction,
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

    const result = await uploadAction(profileId, formData)

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
        // O <input> continua tecnicamente no DOM (sr-only, não display:none)
        // para que rótulo/foco/erro de validação nativa não fiquem invisíveis
        // a tecnologia assistiva — só o botão de câmera é o gatilho visual.
        className="sr-only"
        aria-label="Alterar foto de perfil"
        onChange={handleFileChange}
      />
      {/*
        Alvo de toque de 44px (--touch-target-min) SEM inflar o círculo
        visual: um avatar de 64px com um botão de 44px sobreposto ficaria
        visualmente quebrado. O <button> é o tamanho real de toque
        (transparente, sem borda própria); o círculo coral é um `span`
        absolutamente centrado dentro dele, no tamanho visual pequeno de
        sempre. A área clicável cresce; o desenho não muda.
      */}
      <button
        type="button"
        aria-label="Alterar foto de perfil"
        aria-busy={state === "uploading"}
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        className="touch-target relative grid place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full border-2 border-white text-white"
          style={{ background: CORAL }}
        >
          {state === "uploading" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
        </span>
      </button>

      {state === "error" && error ? (
        <p
          role="alert"
          className="absolute top-full mt-1 w-max max-w-[160px] text-[11px] font-medium leading-tight"
          style={{ color: CORAL }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
