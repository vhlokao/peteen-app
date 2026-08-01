/**
 * Validação pura de assinatura de imagem (magic bytes) — sem rede, sem
 * Storage, sem Next.js. Existe separada de pet-photo.ts para ser testável
 * isoladamente (node:test não resolve o alias "@/..." usado pelo restante
 * do módulo, que depende de next/headers via createSupabaseServerClient).
 */

export const PET_PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const PET_PHOTO_MAX_BYTES = 5 * 1024 * 1024 // 5MB — igual ao file_size_limit do bucket

export const EXTENSION_BY_TYPE: Record<(typeof PET_PHOTO_ALLOWED_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export class PetPhotoValidationError extends Error {}

// Bytes suficientes para reconhecer as 3 assinaturas (WebP precisa dos 12
// primeiros: "RIFF" + 4 bytes de tamanho + "WEBP").
export const SIGNATURE_READ_LENGTH = 12

/** Detecta o tipo real da imagem pelos magic bytes — nunca confia em file.type. */
export function detectImageTypeFromBytes(
  bytes: Uint8Array
): (typeof PET_PHOTO_ALLOWED_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

/**
 * Valida tipo declarado, tamanho e conteúdo real (magic bytes). Retorna o
 * tipo detectado — é ele (não o nome do arquivo, nem o file.type isolado)
 * que decide a extensão final do path no Storage.
 */
export function validatePetPhotoSignature(
  declaredType: string,
  size: number,
  header: Uint8Array
): (typeof PET_PHOTO_ALLOWED_TYPES)[number] {
  if (!PET_PHOTO_ALLOWED_TYPES.includes(declaredType as (typeof PET_PHOTO_ALLOWED_TYPES)[number])) {
    throw new PetPhotoValidationError(
      "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP."
    )
  }
  if (size > PET_PHOTO_MAX_BYTES) {
    throw new PetPhotoValidationError("A imagem deve ter no máximo 5MB.")
  }

  const detectedType = detectImageTypeFromBytes(header)
  if (!detectedType || detectedType !== declaredType) {
    throw new PetPhotoValidationError(
      "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    )
  }

  return detectedType
}
