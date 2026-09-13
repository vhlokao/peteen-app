import "server-only"

/**
 * Ponto único entre o `File` recebido por Server Action e o Storage público
 * (`avatars`, `pets`). PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * O arquivo que chega aqui já deveria ser o JPEG reduzido pelo navegador
 * (`lib/image/prepare-image.client.ts`), mas isso não é premissa: os bytes
 * passam SEMPRE por `processImageForStorage`, que valida conteúdo, tamanho e
 * dimensões e grava um JPEG novo sem metadados. Só a saída dele sobe.
 */

import { processImageForStorage } from "@/lib/image/process-image.server"
import {
  IMAGE_CATEGORY_POLICY,
  IMAGE_MESSAGES,
  IMAGE_OUTPUT_EXTENSION,
  IMAGE_OUTPUT_MIME,
} from "@/lib/image/image-policy"
import { PetPhotoValidationError } from "./pet-photo-signature"

export type StoredPhoto = {
  body: Blob
  extension: typeof IMAGE_OUTPUT_EXTENSION
  contentType: typeof IMAGE_OUTPUT_MIME
}

/**
 * Processa o arquivo recebido. Lança `PetPhotoValidationError` (mensagem da
 * política única) quando a imagem é recusada — as actions já traduzem esse
 * erro para `{ success: false, error }`.
 */
export async function processPublicPhotoFile(
  file: File,
  category: "AVATAR" | "PET"
): Promise<StoredPhoto> {
  // Recusa antes de ler os bytes para a memória quando o tamanho já prova o excesso.
  if (file.size > IMAGE_CATEGORY_POLICY[category].transportMaxBytes) {
    throw new PetPhotoValidationError(IMAGE_MESSAGES.TOO_LARGE)
  }

  const resultado = await processImageForStorage({
    bytes: new Uint8Array(await file.arrayBuffer()),
    declaredType: file.type,
    category,
  })
  if (!resultado.ok) throw new PetPhotoValidationError(resultado.message)

  // O SDK do Storage serializa Blob como multipart e usa o tipo do PRÓPRIO Blob
  // na parte do arquivo — por isso o Blob nasce com o tipo final explícito.
  return {
    body: new Blob([resultado.bytes], { type: IMAGE_OUTPUT_MIME }),
    extension: IMAGE_OUTPUT_EXTENSION,
    contentType: IMAGE_OUTPUT_MIME,
  }
}
