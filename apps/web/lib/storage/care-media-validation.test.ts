/**
 * Testes da fronteira de confiança de conteúdo (magic bytes).
 *
 * Cobrem os casos adversariais E–I da missão R2A que NÃO dependem de banco nem
 * de Storage. Os que dependem (autorização, cota sob concorrência,
 * idempotência, signed read) são exercitados contra o ambiente real e
 * reportados à parte.
 *
 * Rodar: npm run test:care-media
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  validateCareMediaContent,
  careMediaRejectionMessage,
} from "./care-media-validation.ts"
import { CARE_MEDIA_MAX_BYTES } from "./care-media-path.ts"

// Assinaturas reais dos formatos aceitos.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])

// Formatos que o contrato V0 recusa.
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00])
// HEIC: caixa ISOBMFF "ftyp" + brand "heic" nos bytes 4-11.
const HEIC = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x00, 0x00])
// O caso comprovado na auditoria do R1: script aceito pelo bucket como image/png.
const PHP = new TextEncoder().encode("<?php system($")
const SVG = new TextEncoder().encode("<svg xmlns=\"htt")

describe("validateCareMediaContent — formatos aceitos", () => {
  it("aceita JPEG/PNG/WebP quando o conteúdo bate com o declarado", () => {
    for (const [declarado, bytes] of [
      ["image/jpeg", JPEG],
      ["image/png", PNG],
      ["image/webp", WEBP],
    ] as const) {
      const r = validateCareMediaContent({
        declaredMimeType: declarado,
        header: bytes,
        sizeBytes: 1024,
      })
      assert.equal(r.ok, true, `deveria aceitar ${declarado}`)
      if (r.ok) {
        // O tipo persistido é o DETECTADO, não o declarado.
        assert.equal(r.mimeType, declarado)
        assert.equal(r.sizeBytes, 1024)
      }
    }
  })
})

describe("validateCareMediaContent — recusas por conteúdo (F, G, H)", () => {
  it("recusa GIF mesmo declarado como png", () => {
    const r = validateCareMediaContent({
      declaredMimeType: "image/png",
      header: GIF,
      sizeBytes: 1024,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, "CONTENT_NOT_ALLOWED_IMAGE")
  })

  it("recusa HEIC mesmo declarado como jpeg", () => {
    const r = validateCareMediaContent({
      declaredMimeType: "image/jpeg",
      header: HEIC,
      sizeBytes: 1024,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, "CONTENT_NOT_ALLOWED_IMAGE")
  })

  it("recusa PHP declarado como image/png — o bypass comprovado no R1", () => {
    const r = validateCareMediaContent({
      declaredMimeType: "image/png",
      header: PHP,
      sizeBytes: 92,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, "CONTENT_NOT_ALLOWED_IMAGE")
  })

  it("recusa PDF e SVG declarados como imagem", () => {
    for (const bytes of [PDF, SVG]) {
      const r = validateCareMediaContent({
        declaredMimeType: "image/png",
        header: bytes,
        sizeBytes: 1024,
      })
      assert.equal(r.ok, false)
    }
  })
})

describe("validateCareMediaContent — divergência declarado x real (I)", () => {
  it("RECUSA conteúdo JPEG declarado como PNG — contrato explícito, não canonicaliza", () => {
    // Decisão de contrato: o tipo declarado gerou a extensão do path (gerada no
    // servidor) e o Content-Type gravado no Storage. Aceitar a divergência
    // deixaria path, Storage e banco em desacordo permanente.
    const r = validateCareMediaContent({
      declaredMimeType: "image/png",
      header: JPEG,
      sizeBytes: 1024,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, "CONTENT_TYPE_MISMATCH")
  })

  it("recusa em todas as combinações cruzadas de tipos válidos", () => {
    const tipos = [
      ["image/jpeg", JPEG],
      ["image/png", PNG],
      ["image/webp", WEBP],
    ] as const
    for (const [declarado] of tipos) {
      for (const [real, bytes] of tipos) {
        const r = validateCareMediaContent({
          declaredMimeType: declarado,
          header: bytes,
          sizeBytes: 1024,
        })
        if (declarado === real) {
          assert.equal(r.ok, true)
        } else {
          assert.equal(r.ok, false, `${real} declarado como ${declarado} deveria falhar`)
          if (!r.ok) assert.equal(r.reason, "CONTENT_TYPE_MISMATCH")
        }
      }
    }
  })
})

describe("validateCareMediaContent — tamanho (E)", () => {
  it("aceita exatamente no limite de 5 MB", () => {
    const r = validateCareMediaContent({
      declaredMimeType: "image/png",
      header: PNG,
      sizeBytes: CARE_MEDIA_MAX_BYTES,
    })
    assert.equal(r.ok, true)
  })

  it("recusa 1 byte acima do limite", () => {
    const r = validateCareMediaContent({
      declaredMimeType: "image/png",
      header: PNG,
      sizeBytes: CARE_MEDIA_MAX_BYTES + 1,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.reason, "TOO_LARGE")
  })

  it("recusa objeto vazio", () => {
    assert.equal(
      validateCareMediaContent({
        declaredMimeType: "image/png",
        header: new Uint8Array([]),
        sizeBytes: 0,
      }).ok,
      false
    )
  })
})

describe("mensagens de recusa", () => {
  it("nunca vazam bucket, path, policy ou detalhe de Storage", () => {
    const proibidos = /bucket|care-media|storage|supabase|policy|path|requests\//i
    for (const reason of [
      "CONTENT_NOT_ALLOWED_IMAGE",
      "CONTENT_TYPE_MISMATCH",
      "TOO_LARGE",
      "EMPTY",
    ] as const) {
      const msg = careMediaRejectionMessage(reason)
      assert.ok(msg.length > 0, "toda recusa precisa de mensagem")
      assert.ok(!proibidos.test(msg), `mensagem vaza detalhe interno: ${msg}`)
    }
  })
})
