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
 * Upload/remoção de avatar de perfil — bucket "avatars" (Supabase Storage).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * P1 SECURITY — AVATAR STORAGE OWNERSHIP / RLS HARDENING
 *
 * Este módulo substitui `lib/storage/upload-avatar.ts` (removido), que fazia
 * upload DIRETO DO BROWSER para `professionals/<Prisma User.id>/...` — um
 * path cujo primeiro segmento nunca é `auth.uid()`, então a policy de RLS
 * ownership-scoped do bucket nunca casava, e só funcionava porque duas
 * policies permissivas (`bucket_id = 'avatars'`, sem checar dono algum)
 * aceitavam qualquer INSERT/UPDATE autenticado. Confirmado por auditoria:
 * qualquer usuário logado conseguia sobrescrever o avatar de qualquer outro,
 * num bucket público — defacement de identidade visível no Discovery.
 *
 * A correção tem DUAS metades, e as duas são necessárias:
 *   1. Path novo: `${authId}/${uuid}.${ext}` — mesmo formato do bucket
 *      "pets" (ver pet-photo.ts), que já casa com `auth.uid()`.
 *   2. `authId` vem de `session.authId` (Supabase `auth.users.id`),
 *      resolvido NO SERVIDOR pela Server Action que chama este módulo —
 *      nunca de um campo de formulário ou prop vinda do cliente. Um upload
 *      client-side não tem como garantir isso: o browser controla todo o
 *      payload que envia. Por isso o upload deixou de ser client-side.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REUSO DE lib/storage/pet-photo-signature.ts
 *
 * A validação por magic bytes (`detectImageTypeFromBytes`,
 * `validatePetPhotoSignature`) é genérica — nenhuma das mensagens ou da
 * lógica menciona pet. O nome do arquivo tem prefixo "pet" porque foi
 * escrito primeiro para aquele fluxo, não porque a lógica é específica dele.
 * Reexportar os mesmos símbolos aqui evita reimplementar detecção de
 * assinatura (JPEG/PNG/WEBP) pela segunda vez no projeto — se um dia isso
 * incomodar, o certo é RENOMEAR o módulo de origem para algo neutro
 * (ex.: image-signature.ts), não duplicá-lo.
 */

export const AVATAR_BUCKET = "avatars"
export { PET_PHOTO_ALLOWED_TYPES as AVATAR_ALLOWED_TYPES }
export { PET_PHOTO_MAX_BYTES as AVATAR_MAX_BYTES }
export { PetPhotoValidationError as AvatarValidationError }

/**
 * Mensagem para qualquer falha de upload após a validação passar (rede,
 * Storage, etc.) — nunca expõe detalhe de Supabase, bucket, policy ou stack.
 */
export const AVATAR_UPLOAD_FAILURE_MESSAGE =
  "Não foi possível enviar a foto. Verifique sua conexão e tente novamente."

/**
 * Valida tipo declarado, tamanho e conteúdo real (magic bytes) — nunca
 * confia isoladamente em `file.type`. Retorna o tipo detectado, que decide
 * a extensão final do path.
 */
export async function validateAvatarFile(
  file: File
): Promise<(typeof PET_PHOTO_ALLOWED_TYPES)[number]> {
  const header = new Uint8Array(await file.slice(0, SIGNATURE_READ_LENGTH).arrayBuffer())
  return validatePetPhotoSignature(file.type, file.size, header)
}

/** Prefixo público do bucket "avatars" — usado para reconhecer/validar URLs. */
function avatarPublicPrefix(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/`
}

/** Verdadeiro apenas para URLs que apontam para o nosso bucket "avatars". */
export function isAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false
  return url.startsWith(avatarPublicPrefix())
}

function pathFromAvatarUrl(url: string): string {
  return url.slice(avatarPublicPrefix().length)
}

/**
 * Envia o avatar para `${authId}/${uuid}.${ext}` dentro do bucket "avatars".
 *
 * `authId` precisa vir de `session.authId`, resolvido pela Server Action
 * chamadora via `requireAuth()` — nunca de um parâmetro controlável pelo
 * cliente. É essa garantia, e não a policy sozinha, que fecha o furo: a
 * policy só autoriza escrita dentro da pasta de `auth.uid()`, mas se este
 * módulo aceitasse um `authId` vindo do cliente, um cliente malicioso
 * simplesmente informaria o `authId` de outra pessoa — a policy casaria
 * porque o SERVIDOR estaria autenticado como o atacante mas escrevendo,
 * corretamente do ponto de vista do Storage, na própria pasta dele. O
 * ownership vem de quem CHAMA esta função, não do path em si.
 *
 * `upsert: false`: nunca sobrescreve um objeto existente — cada upload é um
 * arquivo novo (nome aleatório via `crypto.randomUUID()`), e o avatar
 * anterior é removido explicitamente por `deleteAvatarByUrl` só DEPOIS que
 * o registro no banco aponta para o novo, nunca antes.
 */
export async function uploadAvatarPhoto(file: File, authId: string): Promise<string> {
  const detectedType = await validateAvatarFile(file)

  const extension = EXTENSION_BY_TYPE[detectedType]
  const path = `${authId}/${crypto.randomUUID()}.${extension}`

  // Mesmo motivo documentado em pet-photo.ts: o SDK do Storage serializa
  // File/Blob como multipart, e o Content-Type de cada parte vem do MIME do
  // próprio Blob — reconstruir com o tipo REAL (detectado pelos magic bytes)
  // evita que um `file.type` vazio/genérico (comum em mobile) declare
  // "application/octet-stream" e seja rejeitado pelo bucket.
  const bytes = await file.arrayBuffer()
  const uploadBody = new Blob([bytes], { type: detectedType })

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, uploadBody, {
    upsert: false,
    contentType: detectedType,
  })

  if (error) {
    throw new Error(AVATAR_UPLOAD_FAILURE_MESSAGE)
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Remove um avatar do bucket a partir da URL pública salva no perfil.
 * Best-effort: nunca lança — falha de limpeza não pode quebrar o fluxo
 * principal (o novo avatar já foi salvo com sucesso quando isto é chamado).
 * Chamar SEMPRE depois de confirmar que o registro no banco já aponta para
 * o avatar novo — nunca antes, para não deixar o perfil sem nenhum avatar
 * válido caso a remoção do antigo aconteça e algo falhe em seguida.
 */
export async function deleteAvatarByUrl(url: string | null | undefined): Promise<void> {
  if (!isAvatarUrl(url)) return
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.storage.from(AVATAR_BUCKET).remove([pathFromAvatarUrl(url)])
  } catch (err) {
    console.error("[deleteAvatarByUrl]", err)
  }
}
