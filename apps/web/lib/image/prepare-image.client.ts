"use client"

/**
 * Preparo da imagem NO NAVEGADOR, antes de qualquer Server Action ou upload.
 *
 * PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001. Foto de celular moderna
 * (48–50 MP, 6–15 MB) não cabe no corpo de uma Function da Vercel (4,5 MB) nem
 * no bucket (5 MB). Aqui ela vira um JPEG no maior lado da categoria:
 *
 *   1. entrada: ≤ 25 MB, conteúdo JPEG/PNG/WebP (ou HEIC, que só é TENTADO);
 *   2. dimensões pelo cabeçalho, ≤ 100 MP, antes de gastar memória decodificando;
 *   3. decodifica com a orientação da câmera aplicada (`imageOrientation:
 *      "from-image"`; no fallback, `<img>`, que também aplica);
 *   4. desenha "inside" no canvas sobre fundo branco — sem cortar, sem ampliar;
 *   5. `toBlob("image/jpeg")` com escada de qualidade até caber no transporte.
 *      Canvas NUNCA carrega EXIF/GPS: o arquivo gerado sai sem metadados.
 *
 * Isto é UX e economia de banda. A garantia é o servidor
 * (`lib/image/process-image.server.ts`), que reprocessa tudo.
 *
 * FALLBACK: se o navegador não conseguir decodificar um JPEG/PNG/WebP que já
 * cabe no transporte, o original segue e o servidor faz o trabalho. HEIC que
 * não decodifica recebe mensagem própria — o servidor também não decodifica.
 */

import {
  checkImageInput,
  exceedsInputPixels,
  fitInside,
  IMAGE_CATEGORY_POLICY,
  IMAGE_HEADER_READ_BYTES,
  IMAGE_INPUT_MAX_PIXELS,
  IMAGE_OUTPUT_MIME,
  imageFailure,
  preparedImageFileName,
  readImageDimensions,
  type ImageCategory,
  type ImageFailure,
} from "./image-policy"

export type PreparedImage = {
  ok: true
  file: File
  /** true = o original seguiu sem processamento local (o servidor processa). */
  passthrough: boolean
  width: number | null
  height: number | null
  elapsedMs: number
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

async function decode(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // cai para <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) {
      URL.revokeObjectURL(url)
      return null
    }
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), IMAGE_OUTPUT_MIME, quality / 100)
    } catch {
      resolve(null)
    }
  })
}

export async function prepareImageForUpload(
  file: File,
  category: ImageCategory
): Promise<PreparedImage | ImageFailure> {
  const inicio = performance.now()
  const policy = IMAGE_CATEGORY_POLICY[category]

  let head: Uint8Array
  try {
    head = new Uint8Array(await file.slice(0, IMAGE_HEADER_READ_BYTES).arrayBuffer())
  } catch {
    return imageFailure("PROCESSING_FAILED")
  }

  const entrada = checkImageInput(file, head)
  if (!entrada.ok) return entrada

  const dimCabecalho = entrada.kind === "heic" ? null : readImageDimensions(head)
  if (exceedsInputPixels(dimCabecalho)) return imageFailure("TOO_LARGE")

  const decodificada = await decode(file)
  if (!decodificada) {
    if (entrada.kind === "heic") return imageFailure("HEIC_UNSUPPORTED")
    if (file.size <= policy.transportMaxBytes) {
      return {
        ok: true,
        file,
        passthrough: true,
        width: dimCabecalho?.width ?? null,
        height: dimCabecalho?.height ?? null,
        elapsedMs: Math.round(performance.now() - inicio),
      }
    }
    return imageFailure("PROCESSING_FAILED")
  }

  try {
    if (decodificada.width * decodificada.height > IMAGE_INPUT_MAX_PIXELS) {
      return imageFailure("TOO_LARGE")
    }

    const alvo = fitInside(decodificada.width, decodificada.height, policy.maxLongSide)
    const canvas = document.createElement("canvas")
    canvas.width = alvo.width
    canvas.height = alvo.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return imageFailure("PROCESSING_FAILED")

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, alvo.width, alvo.height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(decodificada.source, 0, 0, alvo.width, alvo.height)

    const limite = Math.min(policy.transportMaxBytes, policy.outputMaxBytes)
    for (const quality of policy.qualityLadder) {
      const blob = await toJpegBlob(canvas, quality)
      if (!blob) return imageFailure("PROCESSING_FAILED")
      if (blob.size <= limite) {
        canvas.width = 0
        canvas.height = 0
        return {
          ok: true,
          file: new File([blob], preparedImageFileName(file.name), { type: IMAGE_OUTPUT_MIME }),
          passthrough: false,
          width: alvo.width,
          height: alvo.height,
          elapsedMs: Math.round(performance.now() - inicio),
        }
      }
    }
    return imageFailure("TOO_LARGE")
  } catch {
    return imageFailure("PROCESSING_FAILED")
  } finally {
    decodificada.release()
  }
}
