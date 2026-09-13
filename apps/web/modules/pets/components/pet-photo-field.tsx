"use client"

import { useRef, useState } from "react"
import { Camera, ImageOff, Loader2, X } from "lucide-react"

import { uploadPetPhotoAction } from "@/modules/pets/application/actions"
import { buildOptimizedImageUrl } from "@/lib/storage/optimized-image-url"
import { cn } from "@/lib/utils"
import { IMAGE_ACCEPT_ATTRIBUTE, IMAGE_MESSAGES } from "@/lib/image/image-policy"
import { prepareImageForUpload } from "@/lib/image/prepare-image.client"

/*
 * Tipos, limites e mensagens vêm da política única (lib/image/image-policy.ts).
 * Nenhuma regra de imagem é declarada neste componente.
 */

type Props = {
  /** Id do pet, quando em edição — usado só para checagem de posse no upload. */
  petId?: string
  /** URL salva atualmente (string vazia = sem foto). */
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  className?: string
}

export function PetPhotoField({ petId, value, onChange, disabled, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Único botão para "Adicionar foto"/"Trocar foto" — nunca desmonta (só o
  // texto muda), diferente do botão "Remover", que some quando a foto é
  // removida. É para cá que o foco precisa ir depois de remover, já que o
  // elemento que tinha foco (Remover) deixa de existir.
  const primaryButtonRef = useRef<HTMLButtonElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Anunciado via role="status" (polite) — o erro tem sua própria região
  // role="alert", então nunca os dois falam ao mesmo tempo pela mesma causa.
  const [statusMessage, setStatusMessage] = useState("")

  const displayUrl = preview ?? value
  // 128px é a maior largura válida do otimizador do Next para um box de
  // 80px. `preview` (blob: local, ainda não salvo) passa direto pelo helper
  // sem otimizar — ver lib/storage/optimized-image-url.ts.
  const optimizedDisplayUrl = buildOptimizedImageUrl(displayUrl, 128)

  function resetPreview() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setError(null)
    setStatusMessage("")
    setUploading(true)
    setStatusMessage("Preparando foto…")

    try {
      // Reduz para JPEG no navegador (validação de entrada, orientação, sem
      // metadados) ANTES de atravessar a Server Action. Recusas daqui já vêm
      // com a mensagem certa — formato, tamanho, HEIC ou falha de preparo —
      // em vez de caírem como "erro de conexão".
      const preparada = await prepareImageForUpload(file, "PET")
      if (!preparada.ok) {
        setStatusMessage("")
        setError(preparada.message)
        return
      }

      resetPreview()
      setPreview(URL.createObjectURL(preparada.file))
      setStatusMessage("Enviando foto…")

      const formData = new FormData()
      formData.append("file", preparada.file)
      if (petId) formData.append("petId", petId)

      const result = await uploadPetPhotoAction(formData)

      if (!result.success) {
        setStatusMessage("")
        setError(result.error)
        resetPreview()
        return
      }

      setStatusMessage("Foto enviada.")
      onChange(result.data.url)
    } catch {
      // Só chega aqui exceção de rede/plataforma na chamada da action.
      setStatusMessage("")
      setError(IMAGE_MESSAGES.UPLOAD_FAILED)
      resetPreview()
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    resetPreview()
    setError(null)
    setStatusMessage("Foto removida.")
    onChange("")
    // O botão "Remover" (que tinha o foco) some neste re-render — rAF espera
    // o navegador pintar o commit antes de mover o foco para o botão
    // principal, que continua montado (só troca de "Trocar foto" para
    // "Adicionar foto").
    requestAnimationFrame(() => {
      primaryButtonRef.current?.focus()
    })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-sm font-medium text-foreground">Foto do pet</span>
      <div className="flex items-center gap-4">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          {optimizedDisplayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={optimizedDisplayUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <Camera className="size-4" aria-hidden="true" />
              {displayUrl ? "Trocar foto" : "Adicionar foto"}
            </button>
            {displayUrl ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" />
                Remover
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP — até 25 MB. A foto é otimizada antes do envio.</p>
        </div>
      </div>

      {/*
        Fora da ordem de Tab e oculto de leitores de tela: o botão "Adicionar
        foto"/"Trocar foto" acima é o único controle focável para esta ação
        (aciona este input via inputRef.current?.click()). Ter os dois
        focáveis criava duas paradas de Tab anunciando a mesma coisa.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
