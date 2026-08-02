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

// Bytes suficientes para reconhecer as 3 assinaturas aceitas (WebP precisa
// dos 12 primeiros: "RIFF" + 4 bytes de tamanho + "WEBP") e também a
// assinatura HEIC/HEIF (caixa ISOBMFF "ftyp" nos bytes 4–11), reconhecida
// só para dar uma mensagem específica — nunca para aceitar o arquivo.
export const SIGNATURE_READ_LENGTH = 12

/**
 * "file.type" que não carrega nenhuma informação real do conteúdo —
 * observado em fotos vindas de certos apps de galeria/content provider no
 * Android, que devolvem o MIME vazio ou o genérico "binário desconhecido"
 * para uma foto JPEG/PNG/WEBP perfeitamente válida. Nestes casos (só
 * nestes), a decisão final é 100% dos magic bytes — nunca do file.type.
 * Qualquer outro valor declarado (ex.: "image/gif", "image/heic") continua
 * rejeitado antes mesmo de olhar os bytes, como sempre foi.
 */
const UNINFORMATIVE_DECLARED_TYPES = new Set(["", "application/octet-stream"])

// Brands ISOBMFF que identificam HEIC/HEIF — só para mensagem específica.
const HEIC_HEIF_BRANDS = new Set([
  "heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1",
])

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
 * true quando os bytes são de um container HEIC/HEIF — nunca usado para
 * aceitar o arquivo, só para trocar a mensagem genérica de "não parece ser
 * uma imagem válida" por uma que explica o motivo real (formato ainda não
 * suportado, não arquivo corrompido).
 */
function isHeicHeifByBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const isFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  if (!isFtyp) return false
  const brand = new TextDecoder().decode(bytes.slice(8, 12))
  return HEIC_HEIF_BRANDS.has(brand)
}

const UNSUPPORTED_FORMAT_MESSAGE =
  "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP."
const HEIC_MESSAGE =
  "Este formato de foto ainda não é compatível. Tente salvar ou compartilhar a imagem como JPEG."
const TOO_LARGE_MESSAGE =
  "Esta foto é muito grande. Escolha outra imagem ou tente reduzir o tamanho."
const INVALID_CONTENT_MESSAGE =
  "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."

/**
 * Mensagem para qualquer falha de upload após a validação passar (rede,
 * Storage, etc.) — nunca expõe detalhe de Supabase, bucket, policy, MIME ou
 * stack. Única fonte para esta string (server e cliente importam daqui, ou
 * replicam literalmente) — nunca a mensagem antiga "Tente novamente." sem
 * explicar que pode ser conexão.
 */
export const PET_PHOTO_UPLOAD_FAILURE_MESSAGE =
  "Não foi possível enviar a foto. Verifique sua conexão e tente novamente."

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
  const declaredIsUninformative = UNINFORMATIVE_DECLARED_TYPES.has(declaredType)

  // Um tipo declarado específico e errado (ex.: "image/gif", "image/heic")
  // continua rejeitado sem nem olhar os bytes — comportamento inalterado.
  // Só o caso "sem informação real" (vazio ou genérico) passa adiante para
  // deixar os magic bytes decidirem.
  if (
    !declaredIsUninformative &&
    !PET_PHOTO_ALLOWED_TYPES.includes(declaredType as (typeof PET_PHOTO_ALLOWED_TYPES)[number])
  ) {
    if (declaredType === "image/heic" || declaredType === "image/heif") {
      throw new PetPhotoValidationError(HEIC_MESSAGE)
    }
    throw new PetPhotoValidationError(UNSUPPORTED_FORMAT_MESSAGE)
  }

  if (size > PET_PHOTO_MAX_BYTES) {
    throw new PetPhotoValidationError(TOO_LARGE_MESSAGE)
  }

  const detectedType = detectImageTypeFromBytes(header)
  if (!detectedType) {
    if (isHeicHeifByBytes(header)) {
      throw new PetPhotoValidationError(HEIC_MESSAGE)
    }
    throw new PetPhotoValidationError(INVALID_CONTENT_MESSAGE)
  }

  // Quando o declarado é específico (não vazio/genérico), ele precisa bater
  // com o conteúdo real — mesma defesa contra MIME adulterado de sempre.
  if (!declaredIsUninformative && detectedType !== declaredType) {
    throw new PetPhotoValidationError(INVALID_CONTENT_MESSAGE)
  }

  return detectedType
}
