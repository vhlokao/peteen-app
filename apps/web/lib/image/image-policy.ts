/**
 * Política ÚNICA de imagens enviadas por usuário — PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * Vale para as quatro superfícies de upload de imagem do produto: avatar de
 * Tutor, avatar de Profissional, foto de pet e fotos do Diário. Logo de
 * Parceiro continua sendo URL (decisão do orquestrador) e não passa por aqui.
 *
 * Módulo PURO (sem "@/", sem Next, sem DOM, sem sharp): importado pelo cliente
 * (preparo no navegador), pelo servidor (reprocessamento com sharp) e por
 * `node --test`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AS DUAS CAMADAS DE LIMITE
 *
 * 1. ENTRADA (o arquivo que a pessoa escolhe): até 25 MB e 100 MP. É o que o
 *    navegador aceita decodificar e reduzir. Foto de celular moderna (48–50 MP,
 *    6–15 MB) cabe com folga.
 * 2. TRANSPORTE / SAÍDA: o que atravessa a rede e o que fica gravado.
 *    - Server Action (avatar, pet): a Vercel limita o corpo de uma Function a
 *      4,5 MB. O arquivo preparado precisa caber em 3,5 MB por requisição
 *      completa — multipart incluído.
 *    - Upload direto ao Storage (Diário): o teto é o `file_size_limit` do bucket
 *      (5 MB), porque os bytes não passam pela Function.
 *    - Gravado: sempre JPEG, sem metadados, no maior lado da categoria.
 *
 * O cliente reduz para caber; o servidor NUNCA confia nisso e reprocessa.
 */

import {
  detectImageTypeFromBytes,
  HEIC_HEIF_BRANDS,
} from "../storage/pet-photo-signature.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Formato final
// ─────────────────────────────────────────────────────────────────────────────

export const IMAGE_OUTPUT_MIME = "image/jpeg" as const
export const IMAGE_OUTPUT_EXTENSION = "jpg" as const

/** Tipos cujo CONTEÚDO o servidor aceita como origem (magic bytes). */
export const IMAGE_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export type ImageSourceType = (typeof IMAGE_SOURCE_TYPES)[number]

/**
 * `accept` dos inputs de arquivo — o mesmo em todas as superfícies. HEIC não é
 * listado: no iPhone isso faz o sistema entregar a foto já convertida para JPEG
 * na maioria dos casos; se ainda assim chegar um HEIC, o cliente tenta
 * decodificar (ver `prepare-image.client.ts`).
 */
export const IMAGE_ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp"

// ─────────────────────────────────────────────────────────────────────────────
// Limites
// ─────────────────────────────────────────────────────────────────────────────

const MB = 1024 * 1024

/** Arquivo escolhido pela pessoa, antes de qualquer processamento. */
export const IMAGE_INPUT_MAX_BYTES = 25 * MB
/** Pixels decodificados (largura × altura). Protege contra bomba de pixels. */
export const IMAGE_INPUT_MAX_PIXELS = 100_000_000

/**
 * Orçamento de UMA requisição de Server Action com imagem (Vercel: 4,5 MB de
 * corpo). O arquivo preparado precisa ficar abaixo disto descontando o
 * envelope multipart e os demais campos do FormData.
 */
export const SERVER_ACTION_REQUEST_BUDGET_BYTES = 3.5 * MB
/** Folga reservada ao envelope multipart + campos do FormData. */
export const MULTIPART_OVERHEAD_RESERVE_BYTES = 64 * 1024
/** Maior arquivo que o servidor aceita receber por Server Action (avatar, pet). */
export const SERVER_ACTION_IMAGE_MAX_BYTES =
  SERVER_ACTION_REQUEST_BUDGET_BYTES - MULTIPART_OVERHEAD_RESERVE_BYTES

/** Maior arquivo enviado direto ao bucket do Diário (= `file_size_limit` de `care-media`). */
export const DIRECT_UPLOAD_IMAGE_MAX_BYTES = 5 * MB

export type ImageCategory = "AVATAR" | "PET" | "CARE_PHOTO"

export type ImageCategoryPolicy = {
  /** Maior lado da imagem gravada, em px. Redimensiona "inside": nunca corta, nunca amplia. */
  maxLongSide: number
  /** Qualidades JPEG tentadas em ordem até caber em `outputMaxBytes`. */
  qualityLadder: readonly number[]
  /** Teto do arquivo FINAL gravado. */
  outputMaxBytes: number
  /** Teto do arquivo que chega ao servidor, conforme o transporte da superfície. */
  transportMaxBytes: number
}

export const IMAGE_CATEGORY_POLICY: Readonly<Record<ImageCategory, ImageCategoryPolicy>> = {
  AVATAR: {
    maxLongSide: 1024,
    qualityLadder: [82, 76, 70, 62],
    outputMaxBytes: 1.5 * MB,
    transportMaxBytes: SERVER_ACTION_IMAGE_MAX_BYTES,
  },
  PET: {
    maxLongSide: 1600,
    qualityLadder: [82, 76, 70, 62],
    outputMaxBytes: 2.5 * MB,
    transportMaxBytes: SERVER_ACTION_IMAGE_MAX_BYTES,
  },
  CARE_PHOTO: {
    maxLongSide: 2560,
    qualityLadder: [85, 78, 70, 62],
    outputMaxBytes: 4 * MB,
    transportMaxBytes: DIRECT_UPLOAD_IMAGE_MAX_BYTES,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensagens — fonte única para cliente e servidor
// ─────────────────────────────────────────────────────────────────────────────

export type ImageErrorCode =
  | "TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "HEIC_UNSUPPORTED"
  | "INVALID_IMAGE"
  | "PROCESSING_FAILED"
  | "UPLOAD_FAILED"

export const IMAGE_MESSAGES: Readonly<Record<ImageErrorCode, string>> = {
  TOO_LARGE: "Esta foto é grande demais. Escolha uma imagem de até 25 MB.",
  UNSUPPORTED_FORMAT: "Formato não suportado. Envie uma imagem JPEG, PNG ou WebP.",
  HEIC_UNSUPPORTED:
    "Este aparelho não conseguiu abrir a foto em HEIC. Salve ou compartilhe a imagem como JPEG e tente de novo.",
  INVALID_IMAGE: "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida.",
  PROCESSING_FAILED: "Não foi possível preparar esta foto. Tente outra imagem.",
  UPLOAD_FAILED: "Não foi possível enviar a foto. Verifique sua conexão e tente novamente.",
}

export type ImageFailure = { ok: false; code: ImageErrorCode; message: string }

export function imageFailure(code: ImageErrorCode): ImageFailure {
  return { ok: false, code, message: IMAGE_MESSAGES[code] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detecção pelo conteúdo
// ─────────────────────────────────────────────────────────────────────────────

export type SniffedImageKind = ImageSourceType | "heic" | "gif" | "svg" | "unknown"

/** Bytes suficientes para reconhecer JPEG/PNG/WebP/HEIC/GIF/SVG. */
export const IMAGE_SNIFF_BYTES = 256

/** Classifica o conteúdo real. Nunca olha nome, extensão ou `file.type`. */
export function sniffImageKind(bytes: Uint8Array): SniffedImageKind {
  const tipo = detectImageTypeFromBytes(bytes)
  if (tipo) return tipo
  if (bytes.length >= 12) {
    const isFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
    if (isFtyp && HEIC_HEIF_BRANDS.has(String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!))) {
      return "heic"
    }
  }
  if (bytes.length >= 6) {
    const cab = String.fromCharCode(...bytes.slice(0, 6))
    if (cab === "GIF87a" || cab === "GIF89a") return "gif"
  }
  const texto = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, IMAGE_SNIFF_BYTES)))
    .trimStart()
    .toLowerCase()
  if (texto.startsWith("<svg") || (texto.startsWith("<?xml") && texto.includes("<svg"))) return "svg"
  return "unknown"
}

/** `file.type` que não informa nada — comum em galerias Android. */
export function isUninformativeDeclaredType(declared: string): boolean {
  return declared === "" || declared === "application/octet-stream"
}

export function isHeicDeclaredType(declared: string): boolean {
  const t = declared.toLowerCase()
  return t === "image/heic" || t === "image/heif" || t === "image/heic-sequence" || t === "image/heif-sequence"
}

/**
 * Checagem de ENTRADA no cliente, antes de gastar memória decodificando.
 * Não decide se o navegador consegue abrir — só recusa o que é certamente
 * recusável: tamanho acima de 25 MB e conteúdo que não é imagem aceitável.
 * HEIC passa (o navegador vai tentar).
 */
export function checkImageInput(file: { size: number; type: string }, head: Uint8Array): ImageFailure | { ok: true; kind: ImageSourceType | "heic" } {
  const kind = sniffImageKind(head)
  if (kind === "heic" || (kind === "unknown" && isHeicDeclaredType(file.type))) {
    if (file.size > IMAGE_INPUT_MAX_BYTES) return imageFailure("TOO_LARGE")
    return { ok: true, kind: "heic" }
  }
  if (kind === "gif" || kind === "svg") return imageFailure("UNSUPPORTED_FORMAT")
  if (kind === "unknown") return imageFailure("INVALID_IMAGE")
  if (file.size > IMAGE_INPUT_MAX_BYTES) return imageFailure("TOO_LARGE")
  return { ok: true, kind }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimensões pelo cabeçalho (sem decodificar)
// ─────────────────────────────────────────────────────────────────────────────

/** Bytes lidos do início do arquivo para achar as dimensões (JPEG com EXIF grande incluso). */
export const IMAGE_HEADER_READ_BYTES = 512 * 1024

/**
 * Largura e altura declaradas no cabeçalho de JPEG, PNG ou WebP, sem
 * decodificar pixels. `null` quando não dá para ler com segurança — quem chama
 * trata como "desconhecido" e segue para o decodificador, que tem o próprio
 * teto de pixels.
 */
export function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const kind = detectImageTypeFromBytes(bytes)
  const u16be = (o: number) => (bytes[o]! << 8) | bytes[o + 1]!
  const u32be = (o: number) => ((bytes[o]! << 24) >>> 0) + (bytes[o + 1]! << 16) + (bytes[o + 2]! << 8) + bytes[o + 3]!
  const u16le = (o: number) => bytes[o]! | (bytes[o + 1]! << 8)
  const u24le = (o: number) => bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16)

  if (kind === "image/png") {
    if (bytes.length < 24) return null
    return { width: u32be(16), height: u32be(20) }
  }

  if (kind === "image/jpeg") {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null
      const marker = bytes[i + 1]!
      if (marker === 0xff) { i++; continue }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const len = u16be(i + 2)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) return { width: u16be(i + 7), height: u16be(i + 5) }
      if (len < 2) return null
      i += 2 + len
    }
    return null
  }

  if (kind === "image/webp") {
    if (bytes.length < 30) return null
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!)
    if (chunk === "VP8X") return { width: u24le(24) + 1, height: u24le(27) + 1 }
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff }
    if (chunk === "VP8L") {
      const b = (o: number) => bytes[21 + o]!
      const width = 1 + (b(0) | ((b(1) & 0x3f) << 8))
      const height = 1 + (((b(1) & 0xc0) >> 6) | (b(2) << 2) | ((b(3) & 0x0f) << 10))
      return { width, height }
    }
    return null
  }

  return null
}

export function exceedsInputPixels(dim: { width: number; height: number } | null): boolean {
  return dim !== null && dim.width * dim.height > IMAGE_INPUT_MAX_PIXELS
}

/**
 * Tamanho de saída "inside": o maior lado vira no máximo `maxLongSide`,
 * proporção preservada, nunca amplia, nunca corta. Arredonda para inteiro ≥ 1.
 */
export function fitInside(
  width: number,
  height: number,
  maxLongSide: number
): { width: number; height: number } {
  const longSide = Math.max(width, height)
  if (longSide <= maxLongSide) return { width, height }
  const scale = maxLongSide / longSide
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Nome do arquivo preparado: base original sanitizada + `.jpg`. */
export function preparedImageFileName(original: string): string {
  const base = original.replace(/\.[^./\\]*$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60)
  return `${base || "foto"}.${IMAGE_OUTPUT_EXTENSION}`
}
