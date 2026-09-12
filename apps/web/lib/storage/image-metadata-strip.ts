/**
 * Re-encode server-side de foto pública (avatar e pet) SEM metadados.
 *
 * POR QUE (SEAL-P2-01)
 * `avatars` e `pets` são buckets públicos: quem tem a URL vê o arquivo. O
 * upload gravava os BYTES ORIGINAIS, com EXIF inteiro — modelo do aparelho,
 * data/hora e, quando a câmera registra, GPS. Uma foto de pet tirada em casa
 * publicaria onde o tutor mora, o que a LOCATION_PRIVACY_POLICY proíbe.
 * Validar magic bytes não resolve: o metadado mora DENTRO de uma imagem válida.
 *
 * O QUE FAZ
 * Decodifica e codifica de novo no MESMO formato detectado. O sharp não copia
 * metadado para a saída a menos que isso seja pedido (`keepMetadata`/
 * `withMetadata`) — e aqui nunca é. Sai só pixel: sem EXIF, GPS, XMP, IPTC
 * nem comentário.
 *
 * ORIENTAÇÃO
 * Tirar o EXIF também tira a tag Orientation, e uma foto de celular em retrato
 * costuma estar gravada "deitada" com a rotação só na tag. `.rotate()` sem
 * argumento aplica essa rotação nos PIXELS antes de descartar o metadado — a
 * foto continua em pé.
 *
 * TAMANHO
 * A entrada já passou pelo teto de 5 MB (validatePetPhotoSignature). Re-encode
 * com perdas pode, raramente, sair maior que a entrada; o bucket recusaria acima
 * de 5 MB. Para JPEG/WebP tenta qualidades decrescentes; PNG é sem perdas e tem
 * uma tentativa só. Se nada couber, recusa com a mesma mensagem de "muito
 * grande" que o usuário já conhece — nunca grava acima do limite.
 *
 * DEFESA
 * - `limitInputPixels`: um PNG de poucos KB pode declarar dimensões enormes e
 *   estourar memória na decodificação. O teto cobre câmeras de celular atuais
 *   (50 MP ≈ 8160×6120) com folga.
 * - `failOn: "error"`: JPEG de celular com aviso menor (marcador truncado) ainda
 *   decodifica, como decodificava no navegador; arquivo realmente inválido é
 *   recusado com a mesma mensagem de conteúdo inválido de sempre.
 * - `animated: false`: WebP animado vira o primeiro quadro.
 *
 * Módulo puro (sem "@/", sem next/*) para ser testável com `node --test`.
 */

import sharp from "sharp"

import {
  detectImageTypeFromBytes,
  INVALID_CONTENT_MESSAGE,
  PET_PHOTO_MAX_BYTES,
  PetPhotoValidationError,
  TOO_LARGE_MESSAGE,
  type PET_PHOTO_ALLOWED_TYPES,
} from "./pet-photo-signature.ts"

type AllowedImageType = (typeof PET_PHOTO_ALLOWED_TYPES)[number]

export const REENCODE_MAX_INPUT_PIXELS = 100_000_000

/** Qualidades tentadas, em ordem, para formatos com perdas. */
export const LOSSY_QUALITY_LADDER = [90, 80, 70] as const

function encoder(type: AllowedImageType, quality: number) {
  return (pipeline: sharp.Sharp): sharp.Sharp => {
    switch (type) {
      case "image/jpeg":
        return pipeline.jpeg({ quality })
      case "image/webp":
        return pipeline.webp({ quality })
      case "image/png":
        return pipeline.png({ compressionLevel: 9 })
    }
  }
}

/**
 * Devolve os bytes da imagem re-codificada no mesmo formato, sem metadados e
 * com a orientação aplicada nos pixels. Lança `PetPhotoValidationError` quando
 * a imagem não decodifica ou não cabe no limite.
 */
export async function reencodeWithoutMetadata(
  input: Uint8Array,
  type: AllowedImageType
): Promise<Uint8Array<ArrayBuffer>> {
  const qualidades = type === "image/png" ? [100] : LOSSY_QUALITY_LADDER

  for (const quality of qualidades) {
    let output: Buffer
    try {
      const pipeline = sharp(input, {
        limitInputPixels: REENCODE_MAX_INPUT_PIXELS,
        failOn: "error",
        animated: false,
      }).rotate()
      output = await encoder(type, quality)(pipeline).toBuffer()
    } catch {
      throw new PetPhotoValidationError(INVALID_CONTENT_MESSAGE)
    }

    // Sanidade: a saída tem de continuar sendo do tipo que o path e o
    // Content-Type vão declarar.
    if (detectImageTypeFromBytes(output) !== type) {
      throw new PetPhotoValidationError(INVALID_CONTENT_MESSAGE)
    }

    if (output.byteLength <= PET_PHOTO_MAX_BYTES) {
      return new Uint8Array(output)
    }
  }

  throw new PetPhotoValidationError(TOO_LARGE_MESSAGE)
}
