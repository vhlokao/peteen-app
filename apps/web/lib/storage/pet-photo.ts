import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  PET_PHOTO_ALLOWED_TYPES,
  PET_PHOTO_MAX_BYTES,
  EXTENSION_BY_TYPE,
  PetPhotoValidationError,
  SIGNATURE_READ_LENGTH,
  validatePetPhotoSignature,
} from "./pet-photo-signature"

/**
 * Upload/remoção de foto de pet — bucket "pets" (Supabase Storage).
 *
 * Bucket já existe, público, com RLS ownership-scoped (INSERT/UPDATE/DELETE
 * exigem `(storage.foldername(name))[1] = auth.uid()`) e limite de 5MB —
 * validado aqui no servidor com o MESMO limite para não divergir do que o
 * Storage de fato aceita.
 */

export const PET_PHOTO_BUCKET = "pets"
export { PET_PHOTO_ALLOWED_TYPES, PET_PHOTO_MAX_BYTES, PetPhotoValidationError }

/**
 * Valida tipo declarado, tamanho e conteúdo real (magic bytes) — nunca
 * confia isoladamente em `file.type` nem no nome do arquivo. Retorna o tipo
 * detectado, que é o que decide a extensão final do path no Storage.
 */
export async function validatePetPhotoFile(
  file: File
): Promise<(typeof PET_PHOTO_ALLOWED_TYPES)[number]> {
  const header = new Uint8Array(await file.slice(0, SIGNATURE_READ_LENGTH).arrayBuffer())
  return validatePetPhotoSignature(file.type, file.size, header)
}

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
 * Envia a foto para `${authId}/${uuid}.${ext}` dentro do bucket "pets".
 * `authId` vem de `session.authId` (Supabase `auth.users.id`) — nunca de
 * input do cliente — para casar com `auth.uid()` na policy de RLS.
 */
export async function uploadPetPhoto(file: File, authId: string): Promise<string> {
  const detectedType = await validatePetPhotoFile(file)

  const extension = EXTENSION_BY_TYPE[detectedType]
  const path = `${authId}/${crypto.randomUUID()}.${extension}`

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(PET_PHOTO_BUCKET).upload(path, file, {
    upsert: false,
  })

  if (error) {
    throw new Error("Não foi possível enviar a foto. Tente novamente.")
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
