/**
 * Testes focados — validação de assinatura binária (magic bytes) do upload
 * de foto de pet.
 *
 * Runner: node:test nativo (mesmo padrão de lib/date/agenda-temporal.test.ts).
 * Rodar: node --experimental-strip-types --test lib/storage/pet-photo-signature.test.ts
 *
 * Só função pura — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  PetPhotoValidationError,
  detectImageTypeFromBytes,
  validatePetPhotoSignature,
} from "./pet-photo-signature.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — bytes mínimos reais de cada assinatura
// ─────────────────────────────────────────────────────────────────────────────

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // tamanho (irrelevante para a assinatura)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
])

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// ─────────────────────────────────────────────────────────────────────────────
// detectImageTypeFromBytes — detecção pura
// ─────────────────────────────────────────────────────────────────────────────

describe("detectImageTypeFromBytes", () => {
  it("reconhece JPEG pelos 3 primeiros bytes (FF D8 FF)", () => {
    assert.equal(detectImageTypeFromBytes(JPEG_HEADER), "image/jpeg")
  })

  it("reconhece PNG pelos 8 primeiros bytes", () => {
    assert.equal(detectImageTypeFromBytes(PNG_HEADER), "image/png")
  })

  it("reconhece WebP por RIFF....WEBP", () => {
    assert.equal(detectImageTypeFromBytes(WEBP_HEADER), "image/webp")
  })

  it("retorna null para conteúdo não reconhecido (SVG/texto)", () => {
    assert.equal(detectImageTypeFromBytes(textBytes("<svg xmlns=")), null)
  })

  it("retorna null para arquivo vazio", () => {
    assert.equal(detectImageTypeFromBytes(new Uint8Array(0)), null)
  })

  it("retorna null para arquivo truncado (menos bytes que a assinatura exige)", () => {
    assert.equal(detectImageTypeFromBytes(new Uint8Array([0xff, 0xd8])), null)
    assert.equal(detectImageTypeFromBytes(PNG_HEADER.slice(0, 4)), null)
    assert.equal(detectImageTypeFromBytes(WEBP_HEADER.slice(0, 8)), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validatePetPhotoSignature — validação completa (tipo + tamanho + bytes)
// ─────────────────────────────────────────────────────────────────────────────

describe("validatePetPhotoSignature", () => {
  it("aceita JPEG válido (declarado e conteúdo batem)", () => {
    const detected = validatePetPhotoSignature("image/jpeg", 1024, JPEG_HEADER)
    assert.equal(detected, "image/jpeg")
  })

  it("aceita PNG válido", () => {
    const detected = validatePetPhotoSignature("image/png", 1024, PNG_HEADER)
    assert.equal(detected, "image/png")
  })

  it("aceita WebP válido", () => {
    const detected = validatePetPhotoSignature("image/webp", 1024, WEBP_HEADER)
    assert.equal(detected, "image/webp")
  })

  it("rejeita SVG declarado como image/jpeg (MIME adulterado)", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/jpeg", 46, textBytes('<svg xmlns="x">')),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    )
  })

  it("rejeita HTML declarado como image/png (MIME adulterado)", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/png", 64, textBytes("<html><body>")),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    )
  })

  it("rejeita conteúdo aleatório declarado como image/webp", () => {
    const randomBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c])
    assert.throws(
      () => validatePetPhotoSignature("image/webp", 12, randomBytes),
      PetPhotoValidationError
    )
  })

  it("rejeita JPEG real com MIME declarado image/png (tipo e conteúdo divergem)", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/png", 1024, JPEG_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    )
  })

  it("rejeita arquivo truncado (assinatura incompleta)", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/png", 4, PNG_HEADER.slice(0, 4)),
      PetPhotoValidationError
    )
  })

  it("rejeita arquivo vazio", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/jpeg", 0, new Uint8Array(0)),
      PetPhotoValidationError
    )
  })

  it("rejeita tipo declarado fora da allowlist antes mesmo de olhar os bytes", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/gif", 1024, JPEG_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP."
    )
  })

  it("rejeita arquivo acima de 5MB mesmo com assinatura válida", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/jpeg", 6 * 1024 * 1024, JPEG_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Esta foto é muito grande. Escolha outra imagem ou tente reduzir o tamanho."
    )
  })

  it("nunca expõe bytes ou detalhe técnico na mensagem de erro", () => {
    try {
      validatePetPhotoSignature("image/jpeg", 46, textBytes('<svg xmlns="x">'))
      assert.fail("deveria ter lançado")
    } catch (err) {
      assert.ok(err instanceof PetPhotoValidationError)
      assert.doesNotMatch((err as Error).message, /0x|byte|stack|Uint8Array/i)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Compatibilidade mobile — file.type vazio/genérico e HEIC/HEIF (Missão
// "PET PHOTO UPLOAD MOBILE COMPATIBILITY")
// ─────────────────────────────────────────────────────────────────────────────

describe("validatePetPhotoSignature — file.type sem informação real", () => {
  it("aceita JPEG real mesmo com file.type vazio (comum em galeria Android/content://)", () => {
    const detected = validatePetPhotoSignature("", 1024, JPEG_HEADER)
    assert.equal(detected, "image/jpeg")
  })

  it("aceita PNG real mesmo com file.type genérico 'application/octet-stream'", () => {
    const detected = validatePetPhotoSignature("application/octet-stream", 1024, PNG_HEADER)
    assert.equal(detected, "image/png")
  })

  it("aceita WebP real com file.type vazio", () => {
    const detected = validatePetPhotoSignature("", 1024, WEBP_HEADER)
    assert.equal(detected, "image/webp")
  })

  it("mesmo com file.type vazio, continua rejeitando conteúdo que não é imagem válida", () => {
    assert.throws(
      () => validatePetPhotoSignature("", 46, textBytes('<svg xmlns="x">')),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Este arquivo não parece ser uma imagem JPEG, PNG ou WebP válida."
    )
  })

  it("mesmo com file.type vazio, continua rejeitando acima de 5MB", () => {
    assert.throws(
      () => validatePetPhotoSignature("", 6 * 1024 * 1024, JPEG_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Esta foto é muito grande. Escolha outra imagem ou tente reduzir o tamanho."
    )
  })

  it("um tipo declarado específico e errado (não vazio/genérico) continua rejeitado sem depender dos bytes", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/gif", 1024, JPEG_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message === "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP."
    )
  })
})

describe("validatePetPhotoSignature — HEIC/HEIF", () => {
  const HEIC_HEADER = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, // box size
    0x66, 0x74, 0x79, 0x70, // "ftyp"
    0x68, 0x65, 0x69, 0x63, // brand "heic"
  ])

  it("rejeita HEIC declarado explicitamente (image/heic) com mensagem específica, sem checar bytes", () => {
    assert.throws(
      () => validatePetPhotoSignature("image/heic", 1024, HEIC_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message ===
          "Este formato de foto ainda não é compatível. Tente salvar ou compartilhar a imagem como JPEG."
    )
  })

  it("rejeita HEIC com file.type vazio, reconhecendo pelos bytes (ftyp/heic) — mensagem específica, não genérica", () => {
    assert.throws(
      () => validatePetPhotoSignature("", 1024, HEIC_HEADER),
      (err: unknown) =>
        err instanceof PetPhotoValidationError &&
        err.message ===
          "Este formato de foto ainda não é compatível. Tente salvar ou compartilhar a imagem como JPEG."
    )
  })
})
