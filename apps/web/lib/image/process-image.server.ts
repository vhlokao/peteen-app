/**
 * Reprocessamento de imagem no SERVIDOR — a garantia, independente do cliente.
 *
 * PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001. O navegador já entrega um
 * JPEG reduzido, mas nada do que chega por rede é prova: a Server Action pode
 * ser chamada direto, o upload ao bucket do Diário também. Esta função é o
 * único caminho de bytes de imagem até o Storage, e decide sozinha:
 *
 *   1. tamanho recebido ≤ teto do transporte da categoria;
 *   2. CONTEÚDO real é JPEG, PNG ou WebP (magic bytes), e bate com o tipo
 *      declarado quando o declarado informa algo;
 *   3. dimensões ≤ 100 MP (lidas do cabeçalho pelo sharp, antes de decodificar);
 *   4. decodifica e grava UM JPEG novo:
 *        rotate()   → aplica a orientação do EXIF nos pixels;
 *        flatten()  → transparência vira fundo branco (JPEG não tem alfa);
 *        resize()   → "inside" no maior lado da categoria, sem cortar/ampliar;
 *        jpeg()     → sem metadados (o sharp só copia metadado se pedido, e
 *                     aqui nunca é) — EXIF, GPS, XMP, IPTC e ICC ficam de fora;
 *   5. escada de qualidade até caber no teto de saída da categoria.
 *
 * Nunca lança: todo desfecho é `{ ok: true, … }` ou `{ ok: false, code, message }`
 * com a mensagem da política única.
 *
 * Sem `import "server-only"` de propósito: esse pacote lança fora do bundler e
 * impediria o `node --test`. O `sharp` é binário nativo e não compila para o
 * browser — importar este arquivo num Client Component quebra o build, que é a
 * barreira real (ver também o teste de contrato).
 *
 * HEIC/HEIF: o `sharp` 0.34.5 instalado lê HEIF apenas com AV1 (AVIF); HEVC não
 * tem decodificador. Por isso HEIC é recusado aqui com a mensagem própria — a
 * conversão só é possível no navegador que souber decodificar.
 */

import sharp from "sharp"

import {
  IMAGE_CATEGORY_POLICY,
  IMAGE_INPUT_MAX_PIXELS,
  IMAGE_OUTPUT_MIME,
  imageFailure,
  isHeicDeclaredType,
  isUninformativeDeclaredType,
  sniffImageKind,
  type ImageCategory,
  type ImageFailure,
} from "./image-policy.ts"

export type ProcessedImage = {
  ok: true
  bytes: Uint8Array<ArrayBuffer>
  mimeType: typeof IMAGE_OUTPUT_MIME
  width: number
  height: number
  sizeBytes: number
  /** Qualidade JPEG efetivamente usada. */
  quality: number
}

export async function processImageForStorage(params: {
  bytes: Uint8Array
  /** `file.type` ou tipo derivado do path. Vazio/genérico = só o conteúdo decide. */
  declaredType: string
  category: ImageCategory
}): Promise<ProcessedImage | ImageFailure> {
  const { bytes, declaredType, category } = params
  const policy = IMAGE_CATEGORY_POLICY[category]

  if (bytes.byteLength === 0) return imageFailure("INVALID_IMAGE")
  if (bytes.byteLength > policy.transportMaxBytes) return imageFailure("TOO_LARGE")

  // ── Conteúdo real ────────────────────────────────────────────────────────
  const kind = sniffImageKind(bytes.subarray(0, 256))
  if (kind === "heic" || (kind === "unknown" && isHeicDeclaredType(declaredType))) {
    return imageFailure("HEIC_UNSUPPORTED")
  }
  if (kind === "gif" || kind === "svg") return imageFailure("UNSUPPORTED_FORMAT")
  if (kind === "unknown") return imageFailure("INVALID_IMAGE")

  // Declarado específico e divergente do conteúdo = adulterado.
  if (!isUninformativeDeclaredType(declaredType) && declaredType !== kind) {
    return imageFailure("INVALID_IMAGE")
  }

  // ── Dimensões, sem decodificar ───────────────────────────────────────────
  let meta: sharp.Metadata
  try {
    meta = await sharp(bytes, { limitInputPixels: false }).metadata()
  } catch {
    return imageFailure("INVALID_IMAGE")
  }
  if (!meta.width || !meta.height) return imageFailure("INVALID_IMAGE")
  if (meta.width * meta.height > IMAGE_INPUT_MAX_PIXELS) return imageFailure("TOO_LARGE")

  // ── Decodifica e grava JPEG novo ─────────────────────────────────────────
  for (const quality of policy.qualityLadder) {
    let out: { data: Buffer; info: sharp.OutputInfo }
    try {
      out = await sharp(bytes, {
        limitInputPixels: IMAGE_INPUT_MAX_PIXELS,
        failOn: "error",
        animated: false,
      })
        .rotate()
        .flatten({ background: "#ffffff" })
        .resize({
          width: policy.maxLongSide,
          height: policy.maxLongSide,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
    } catch {
      return imageFailure("INVALID_IMAGE")
    }

    if (out.data.byteLength <= policy.outputMaxBytes) {
      return {
        ok: true,
        bytes: new Uint8Array(out.data),
        mimeType: IMAGE_OUTPUT_MIME,
        width: out.info.width,
        height: out.info.height,
        sizeBytes: out.data.byteLength,
        quality,
      }
    }
  }

  return imageFailure("TOO_LARGE")
}
