/**
 * Detecção pura de assinatura de imagem (magic bytes) — sem rede, sem
 * Storage, sem Next.js.
 *
 * PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001: a VALIDAÇÃO de upload
 * (tamanho, tipo declarado × conteúdo, HEIC, mensagens) saiu daqui e vive na
 * política única `lib/image/image-policy.ts` + `lib/image/process-image.server.ts`.
 * Este arquivo ficou só com o que é detecção de formato, usado pela política,
 * pela validação de mídia do Diário e pelo detector de vídeo.
 */

/** Formatos de imagem reconhecidos pelos magic bytes. */
export const PET_PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

/** Erro de validação com mensagem já humanizada (vinda da política única). */
export class PetPhotoValidationError extends Error {}

/**
 * Brands ISOBMFF que identificam HEIC/HEIF.
 *
 * EXPORTADO porque o detector de VÍDEO (care-video-signature.ts) precisa da
 * MESMA lista para o efeito oposto: HEIC e MP4/MOV compartilham a estrutura de
 * caixa `ftyp`, então um HEIC passaria pela checagem de container de vídeo se
 * não fosse recusado explicitamente pelo brand. Duas listas separadas
 * divergiriam no dia em que um brand novo fosse acrescentado a uma só — e o
 * sintoma seria um HEIC aceito como vídeo.
 */
export const HEIC_HEIF_BRANDS = new Set([
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
