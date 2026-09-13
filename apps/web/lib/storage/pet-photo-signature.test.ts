/**
 * Testes focados — detecção de assinatura binária (magic bytes).
 *
 * A validação de upload (tamanho, tipo declarado × conteúdo, HEIC) migrou para
 * lib/image/process-image.server.test.ts — PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * Runner: node:test nativo (mesmo padrão de lib/date/agenda-temporal.test.ts).
 * Rodar: node --experimental-strip-types --test lib/storage/pet-photo-signature.test.ts
 *
 * Só função pura — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { detectImageTypeFromBytes } from "./pet-photo-signature.ts"

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
