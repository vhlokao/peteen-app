import { createSupabaseBrowserClient } from "@/lib/supabase/client"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * uploadAvatar — envia a foto de perfil pro bucket "avatars" (Supabase
 * Storage, já criado/público, mesmos limites aqui validados client-side
 * antes do upload: jpeg/png/webp/gif, até 5MB).
 *
 * Path bucket-relative: professionals/[userId]/[timestamp].[ext] — o
 * bucket em si já é selecionado via .from("avatars"), então o path não
 * repete o nome do bucket.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato não suportado. Envie uma imagem JPEG, PNG, WEBP ou GIF.")
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("A imagem deve ter no máximo 5MB.")
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `professionals/${userId}/${Date.now()}.${extension}`

  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
  })

  if (error) {
    throw new Error("Não foi possível enviar a foto. Tente novamente.")
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return data.publicUrl
}
