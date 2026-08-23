/**
 * Validação de CONTEÚDO de mídia do Diário — pura, sem rede e sem Storage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA CAMADA EXISTE
 *
 * O bucket recusa Content-Type fora da allowlist, mas confere apenas o tipo
 * DECLARADO pelo cliente. A auditoria de R1 comprovou, no Storage real, que
 * `<?php system($_GET['c']); ?>` declarado como `image/png` é aceito e
 * armazenado com `mimetype: image/png`.
 *
 * Logo: UPLOAD ≠ MÍDIA CONFIÁVEL. Depois do upload o objeto é dado hostil até
 * que os BYTES digam o contrário.
 *
 * O detector é importado de pet-photo-signature.ts — o mesmo mecanismo já em
 * produção para foto de pet, com testes próprios. Reimplementar a leitura de
 * assinatura aqui criaria duas versões da mesma regra, livres para divergir.
 * O que NÃO é reaproveitado são as mensagens daquele módulo, que falam de
 * "foto do pet" e apareceriam fora de contexto no Diário.
 */

// Extensão .ts explícita nos imports de RUNTIME: é o que permite este módulo
// ser carregado direto por `node --experimental-strip-types --test`, sem
// bundler. Mesmo padrão já usado em produção neste projeto (ver
// modules/location/domain/normalize.ts e trust-engine/domain/scoring.ts) e
// habilitado por `allowImportingTsExtensions` no tsconfig. Sem isso, a lógica
// mais sensível desta feature ficaria sem teste unitário.
import { detectImageTypeFromBytes } from "./pet-photo-signature.ts"
import { detectVideoTypeFromBytes } from "./care-video-signature.ts"
import {
  CARE_MEDIA_MAX_BYTES,
  careMediaKindFromMimeType,
  maxBytesForCareMediaKind,
  type CareAnyMimeType,
  type CareMediaMimeType,
} from "./care-media-path.ts"

export type CareMediaRejectionReason =
  /** Bytes não são JPEG/PNG/WebP — inclui HEIC, GIF, PDF, script, tudo. */
  | "CONTENT_NOT_ALLOWED_IMAGE"
  /** Bytes não são MP4/QuickTime — inclui WebM, HEIC, qualquer outro container. */
  | "CONTENT_NOT_ALLOWED_VIDEO"
  /** Bytes são de mídia válida, mas de tipo diferente do declarado no ticket. */
  | "CONTENT_TYPE_MISMATCH"
  /** Excede o teto do TIPO (5 MB foto, 50 MB vídeo). */
  | "TOO_LARGE"
  /** Arquivo vazio ou pequeno demais para conter assinatura. */
  | "EMPTY"

export type CareMediaValidationResult =
  | { ok: true; mimeType: CareMediaMimeType; sizeBytes: number }
  | { ok: false; reason: CareMediaRejectionReason }

export type CareAnyValidationResult =
  | { ok: true; mimeType: CareAnyMimeType; kind: "PHOTO" | "VIDEO"; sizeBytes: number }
  | { ok: false; reason: CareMediaRejectionReason }

/** Bytes suficientes para as 3 assinaturas aceitas (WebP precisa de 12). */
export const CARE_MEDIA_SIGNATURE_READ_LENGTH = 12

/**
 * Decide se um objeto já enviado pode virar `CareMedia`.
 *
 * CONTRATO DE INCOMPATIBILIDADE — DECISÃO EXPLÍCITA:
 * conteúdo JPEG enviado sob declaração `image/png` é REJEITADO, não
 * canonicalizado silenciosamente. Duas razões:
 *
 *   1. O tipo declarado no ticket é o que gerou a EXTENSÃO do path (server-side)
 *      e o que o Storage gravou como Content-Type do objeto. Aceitar a
 *      divergência deixaria os três em desacordo permanente — path diz .png,
 *      Storage serve image/png, banco diria image/jpeg.
 *   2. É exatamente a regra de `validatePetPhotoSignature`, já em produção:
 *      declarado específico que não bate com o detectado é recusado. Divergir
 *      aqui criaria duas políticas para o mesmo problema.
 *
 * Um cliente honesto nunca cai nesse caso: ele declara o que vai enviar.
 */
export function validateCareMediaContent(params: {
  /** Tipo declarado no momento em que o ticket foi emitido. */
  declaredMimeType: CareMediaMimeType
  /** Primeiros bytes do objeto, lidos do Storage pelo servidor. */
  header: Uint8Array
  /** Tamanho real do objeto, lido do Storage — nunca informado pelo cliente. */
  sizeBytes: number
}): CareMediaValidationResult {
  const { declaredMimeType, header, sizeBytes } = params

  if (sizeBytes <= 0 || header.length === 0) {
    return { ok: false, reason: "EMPTY" }
  }
  if (sizeBytes > CARE_MEDIA_MAX_BYTES) {
    return { ok: false, reason: "TOO_LARGE" }
  }

  const detected = detectImageTypeFromBytes(header)
  if (!detected) {
    return { ok: false, reason: "CONTENT_NOT_ALLOWED_IMAGE" }
  }
  if (detected !== declaredMimeType) {
    return { ok: false, reason: "CONTENT_TYPE_MISMATCH" }
  }

  // `detected` vem do detector, restrito a jpeg/png/webp — os mesmos 3 do
  // contrato V0. O tipo persistido é este, o REAL, nunca o declarado.
  return { ok: true, mimeType: detected, sizeBytes }
}

/**
 * Valida QUALQUER mídia do Diário — foto ou vídeo — decidindo o ramo pelo tipo
 * DECLARADO no path (que o servidor gerou, ver `declaredMimeTypeFromCareMediaPath`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O TETO É DO TIPO, NUNCA COMPARTILHADO
 *
 * Um vídeo é medido contra 50 MB, uma foto contra 5 MB. Usar um teto único
 * (o maior) reabriria exatamente o buraco que os dois buckets fecham: foto de
 * 50 MB aceita. `maxBytesForCareMediaKind` é a fonte única dessa distinção.
 *
 * Mesma política de incompatibilidade das fotos: conteúdo que não bate com o
 * declarado é REJEITADO, nunca canonicalizado — porque o declarado gerou a
 * extensão do path e o Content-Type do objeto, e aceitar a divergência deixaria
 * os três em desacordo permanente.
 */
export function validateCareAnyMediaContent(params: {
  declaredMimeType: CareAnyMimeType
  header: Uint8Array
  sizeBytes: number
}): CareAnyValidationResult {
  const { declaredMimeType, header, sizeBytes } = params

  const kind = careMediaKindFromMimeType(declaredMimeType)
  if (!kind) return { ok: false, reason: "CONTENT_TYPE_MISMATCH" }

  if (sizeBytes <= 0 || header.length === 0) {
    return { ok: false, reason: "EMPTY" }
  }
  if (sizeBytes > maxBytesForCareMediaKind(kind)) {
    return { ok: false, reason: "TOO_LARGE" }
  }

  if (kind === "VIDEO") {
    const detectado = detectVideoTypeFromBytes(header)
    if (!detectado) return { ok: false, reason: "CONTENT_NOT_ALLOWED_VIDEO" }
    if (detectado !== declaredMimeType) return { ok: false, reason: "CONTENT_TYPE_MISMATCH" }
    return { ok: true, mimeType: detectado, kind: "VIDEO", sizeBytes }
  }

  const detectado = detectImageTypeFromBytes(header)
  if (!detectado) return { ok: false, reason: "CONTENT_NOT_ALLOWED_IMAGE" }
  if (detectado !== declaredMimeType) return { ok: false, reason: "CONTENT_TYPE_MISMATCH" }
  return { ok: true, mimeType: detectado, kind: "PHOTO", sizeBytes }
}

/** Mensagem para o usuário. Nunca revela path, bucket ou detalhe de Storage. */
export function careMediaRejectionMessage(reason: CareMediaRejectionReason): string {
  switch (reason) {
    case "CONTENT_NOT_ALLOWED_IMAGE":
      return "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    case "CONTENT_NOT_ALLOWED_VIDEO":
      return "Este arquivo não parece ser um vídeo MP4 ou MOV válido."
    case "CONTENT_TYPE_MISMATCH":
      return "O conteúdo do arquivo não corresponde ao formato informado. Envie novamente."
    case "TOO_LARGE":
      return "Este arquivo é muito grande. Escolha outro ou reduza o tamanho."
    case "EMPTY":
      return "O arquivo enviado está vazio. Tente enviar novamente."
  }
}
