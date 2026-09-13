import { createSupabaseServerClient } from "@/lib/supabase/server"
import { IMAGE_MESSAGES } from "@/lib/image/image-policy"
import { PetPhotoValidationError } from "./pet-photo-signature"
import { processPublicPhotoFile } from "./public-photo"

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
 * IMAGEM (PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001)
 *
 * O arquivo passa por `processPublicPhotoFile` (política única de imagens):
 * conteúdo real validado, ≤ 100 MP, orientação aplicada, sem metadados,
 * maior lado 1024 px e SEMPRE JPEG — extensão `.jpg` e `contentType`
 * `image/jpeg` coerentes com os bytes gravados.
 */

export const AVATAR_BUCKET = "avatars"
export { PetPhotoValidationError as AvatarValidationError }

/**
 * Mensagem para qualquer falha de upload após a validação passar (rede,
 * Storage, etc.) — nunca expõe detalhe de Supabase, bucket, policy ou stack.
 */
export const AVATAR_UPLOAD_FAILURE_MESSAGE = IMAGE_MESSAGES.UPLOAD_FAILED

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
 * Envia o avatar para `${authId}/${uuid}.jpg` dentro do bucket "avatars".
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
  const foto = await processPublicPhotoFile(file, "AVATAR")

  const extension = foto.extension
  const path = `${authId}/${crypto.randomUUID()}.${extension}`

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, foto.body, {
    upsert: false,
    contentType: foto.contentType,
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
