import { createSupabaseServerClient } from "@/lib/supabase/server"
import { IMAGE_MESSAGES } from "@/lib/image/image-policy"
import { PetPhotoValidationError } from "./pet-photo-signature"
import { processPublicPhotoFile } from "./public-photo"

/**
 * Upload/remoção de foto de pet — bucket "pets" (Supabase Storage).
 *
 * Bucket público, com RLS ownership-scoped (INSERT/UPDATE/DELETE/SELECT
 * exigem `(storage.foldername(name))[1] = auth.uid()`) e limite de 5MB.
 *
 * IMAGEM (PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001): o arquivo passa
 * por `processPublicPhotoFile` (política única) — conteúdo real validado,
 * ≤ 100 MP, orientação aplicada, sem metadados, maior lado 1600 px e SEMPRE
 * JPEG, com extensão e `contentType` coerentes.
 */

export const PET_PHOTO_BUCKET = "pets"
export { PetPhotoValidationError }
export const PET_PHOTO_UPLOAD_FAILURE_MESSAGE = IMAGE_MESSAGES.UPLOAD_FAILED

/** Prefixo público do bucket "pets" — usado para reconhecer/validar URLs. */
function petPhotoPublicPrefix(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/${PET_PHOTO_BUCKET}/`
}

/** Verdadeiro apenas para URLs que apontam para o nosso bucket "pets". */
export function isPetPhotoUrl(url: string | null | undefined): url is string {
  if (!url) return false
  return url.startsWith(petPhotoPublicPrefix())
}

function pathFromPetPhotoUrl(url: string): string {
  return url.slice(petPhotoPublicPrefix().length)
}

/**
 * Envia a foto para `${authId}/${uuid}.jpg` dentro do bucket "pets".
 * `authId` vem de `session.authId` (Supabase `auth.users.id`) — nunca de
 * input do cliente — para casar com `auth.uid()` na policy de RLS.
 */
export async function uploadPetPhoto(file: File, authId: string): Promise<string> {
  const foto = await processPublicPhotoFile(file, "PET")

  const extension = foto.extension
  const path = `${authId}/${crypto.randomUUID()}.${extension}`

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(PET_PHOTO_BUCKET).upload(path, foto.body, {
    upsert: false,
    contentType: foto.contentType,
  })

  if (error) {
    throw new Error(PET_PHOTO_UPLOAD_FAILURE_MESSAGE)
  }

  const { data } = supabase.storage.from(PET_PHOTO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Remove um arquivo do bucket "pets" a partir da URL pública salva no Pet.
 * Best-effort: nunca lança — falha de limpeza não pode quebrar o fluxo
 * principal (criação/atualização do pet já foi concluída com sucesso).
 */
export async function deletePetPhotoByUrl(url: string): Promise<void> {
  if (!isPetPhotoUrl(url)) return
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.storage.from(PET_PHOTO_BUCKET).remove([pathFromPetPhotoUrl(url)])
  } catch (err) {
    console.error("[deletePetPhotoByUrl]", err)
  }
}
