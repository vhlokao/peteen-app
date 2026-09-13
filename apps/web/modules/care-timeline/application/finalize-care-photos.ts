/**
 * Fotos do Diário: do objeto ENVIADO pelo cliente ao objeto PUBLICADO.
 *
 * PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001. O upload do Diário é
 * direto ao bucket (3 fotos não cabem numa Server Action), então o servidor só
 * vê os bytes na publicação. Aqui, para CADA foto da tentativa:
 *
 *   1. baixa o objeto enviado;
 *   2. reprocessa com a política única (`processImageForStorage`, categoria
 *      CARE_PHOTO): conteúdo real, ≤ 100 MP, orientação aplicada, sem EXIF/GPS,
 *      maior lado 2560 px, JPEG;
 *   3. grava o resultado numa CHAVE NOVA, gerada no servidor.
 *
 * O arquivo publicado é SEMPRE a saída do passo 2. O original enviado nunca vira
 * `CareMedia` — e é descartado depois que a publicação é confirmada.
 *
 * POR QUE CHAVE NOVA E NÃO SOBRESCREVER
 * A documentação do Supabase Storage desaconselha sobrescrever o mesmo path: a
 * CDN pode continuar servindo a versão anterior por um tempo. Com chave nova,
 * nenhuma URL já emitida aponta para conteúdo trocado.
 *
 * ATOMICIDADE
 * - Qualquer foto recusada ou falha no meio → todos os objetos FINAIS já criados
 *   nesta tentativa são removidos antes de devolver o erro. Nada é publicado.
 * - Conteúdo recusado (não é imagem, HEIC, grande demais, corrompido) → o
 *   ORIGINAL daquela foto também é apagado (mesma regra de antes: reprovado não
 *   fica no bucket). Falha de rede/Storage NÃO apaga o original: a pessoa pode
 *   tentar publicar de novo com as fotos que já enviou.
 * - Depois da transação, quem chama decide: publicou → descarta ORIGINAIS;
 *   não publicou → descarta FINAIS (`discardCarePhotoObjects`).
 *
 * Módulo sem "@/", sem Next e sem Storage real: as operações de I/O entram por
 * `deps`, o que permite testar falha parcial com dublês em `node --test`.
 */

import type { ImageFailure } from "../../../lib/image/image-policy.ts"

export type ProcessedPhoto = {
  ok: true
  bytes: Uint8Array
  mimeType: "image/jpeg"
  sizeBytes: number
}

export type CarePhotoDeps = {
  /** Bytes do objeto enviado; `null` = não existe ou Storage indisponível. */
  download: (path: string) => Promise<Uint8Array | null>
  /** Reprocessa. Nunca lança. */
  process: (bytes: Uint8Array, declaredType: string) => Promise<ProcessedPhoto | ImageFailure>
  /** Grava o JPEG final numa chave NOVA e devolve o path; `null` = falhou. */
  uploadFinal: (bytes: Uint8Array) => Promise<string | null>
  /** Remove um objeto. Best-effort; nunca lança. */
  remove: (path: string) => Promise<boolean>
  /** Tipo declarado pela extensão do path gerado no ticket. */
  declaredTypeOf: (path: string) => string | null
}

export type FinalizedCarePhoto = {
  originalPath: string
  finalPath: string
  mimeType: "image/jpeg"
  sizeBytes: number
}

export type FinalizeCarePhotosResult =
  | { ok: true; photos: FinalizedCarePhoto[] }
  | { ok: false; error: string }

export const CARE_PHOTO_NOT_CONFIRMED =
  "Não foi possível confirmar o envio de um dos arquivos."
export const CARE_PHOTO_PUBLISH_FAILED =
  "Não foi possível preparar uma das fotos para publicação. Tente novamente."

/** Remove objetos em paralelo, best-effort. */
export async function discardCarePhotoObjects(
  paths: readonly string[],
  remove: CarePhotoDeps["remove"]
): Promise<void> {
  await Promise.all(paths.map((p) => remove(p).catch(() => false)))
}

export async function finalizeCarePhotos(params: {
  paths: readonly string[]
  deps: CarePhotoDeps
}): Promise<FinalizeCarePhotosResult> {
  const { paths, deps } = params
  const criados: FinalizedCarePhoto[] = []

  const falhar = async (error: string): Promise<FinalizeCarePhotosResult> => {
    await discardCarePhotoObjects(
      criados.map((c) => c.finalPath),
      deps.remove
    )
    return { ok: false, error }
  }

  for (const originalPath of paths) {
    const declarado = deps.declaredTypeOf(originalPath)
    if (!declarado) return falhar("Um dos arquivos não pôde ser verificado.")

    let original: Uint8Array | null
    try {
      original = await deps.download(originalPath)
    } catch {
      original = null
    }
    if (!original) return falhar(CARE_PHOTO_NOT_CONFIRMED)

    const processada = await deps.process(original, declarado)
    if (!processada.ok) {
      // Conteúdo reprovado não pode sobreviver no bucket.
      await deps.remove(originalPath).catch(() => false)
      return falhar(processada.message)
    }

    let finalPath: string | null
    try {
      finalPath = await deps.uploadFinal(processada.bytes)
    } catch {
      finalPath = null
    }
    if (!finalPath) return falhar(CARE_PHOTO_PUBLISH_FAILED)

    criados.push({
      originalPath,
      finalPath,
      mimeType: processada.mimeType,
      sizeBytes: processada.sizeBytes,
    })
  }

  return { ok: true, photos: criados }
}
