/**
 * Política única de imagens — PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * Rodar: npm run test:image
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"

import {
  checkImageInput,
  DIRECT_UPLOAD_IMAGE_MAX_BYTES,
  exceedsInputPixels,
  fitInside,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_CATEGORY_POLICY,
  IMAGE_INPUT_MAX_BYTES,
  IMAGE_INPUT_MAX_PIXELS,
  IMAGE_MESSAGES,
  IMAGE_OUTPUT_EXTENSION,
  IMAGE_OUTPUT_MIME,
  preparedImageFileName,
  readImageDimensions,
  SERVER_ACTION_IMAGE_MAX_BYTES,
  SERVER_ACTION_REQUEST_BUDGET_BYTES,
  sniffImageKind,
} from "./image-policy.ts"

const MB = 1024 * 1024
const VERCEL_FUNCTION_BODY_LIMIT = 4.5 * MB

const HEIC_HEAD = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0])
const GIF_HEAD = new TextEncoder().encode("GIF89a\x01\x00")
const SVG_HEAD = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg">')
const PHP_HEAD = new TextEncoder().encode("<?php system($_GET['c']); ?>")

async function amostra(fmt: "jpeg" | "png" | "webp", w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#3a6" } })[fmt]().toBuffer()
}

describe("constantes — decisões do orquestrador", () => {
  it("entrada até 25 MB e 100 MP", () => {
    assert.equal(IMAGE_INPUT_MAX_BYTES, 25 * MB)
    assert.equal(IMAGE_INPUT_MAX_PIXELS, 100_000_000)
  })

  it("saída sempre JPEG (.jpg / image/jpeg)", () => {
    assert.equal(IMAGE_OUTPUT_MIME, "image/jpeg")
    assert.equal(IMAGE_OUTPUT_EXTENSION, "jpg")
  })

  it("dimensões máximas: avatar 1024, pet 1600, diário 2560", () => {
    assert.equal(IMAGE_CATEGORY_POLICY.AVATAR.maxLongSide, 1024)
    assert.equal(IMAGE_CATEGORY_POLICY.PET.maxLongSide, 1600)
    assert.equal(IMAGE_CATEGORY_POLICY.CARE_PHOTO.maxLongSide, 2560)
  })

  it("requisição de Server Action ≤ 3,5 MB, com margem sob os 4,5 MB da Vercel", () => {
    assert.ok(SERVER_ACTION_REQUEST_BUDGET_BYTES <= 3.5 * MB)
    assert.ok(SERVER_ACTION_IMAGE_MAX_BYTES < SERVER_ACTION_REQUEST_BUDGET_BYTES)
    assert.ok(SERVER_ACTION_REQUEST_BUDGET_BYTES < VERCEL_FUNCTION_BODY_LIMIT)
    assert.equal(IMAGE_CATEGORY_POLICY.AVATAR.transportMaxBytes, SERVER_ACTION_IMAGE_MAX_BYTES)
    assert.equal(IMAGE_CATEGORY_POLICY.PET.transportMaxBytes, SERVER_ACTION_IMAGE_MAX_BYTES)
  })

  it("diário: transporte = teto do bucket (5 MB) e saída cabe nele", () => {
    assert.equal(IMAGE_CATEGORY_POLICY.CARE_PHOTO.transportMaxBytes, DIRECT_UPLOAD_IMAGE_MAX_BYTES)
    assert.equal(DIRECT_UPLOAD_IMAGE_MAX_BYTES, 5 * MB)
    for (const p of Object.values(IMAGE_CATEGORY_POLICY)) {
      assert.ok(p.outputMaxBytes <= 5 * MB, "saída precisa caber no file_size_limit dos buckets")
      assert.deepEqual([...p.qualityLadder], [...p.qualityLadder].sort((a, b) => b - a))
    }
  })

  it("accept não oferece GIF/SVG", () => {
    assert.equal(IMAGE_ACCEPT_ATTRIBUTE, "image/jpeg,image/png,image/webp")
  })

  it("mensagens padronizadas e distintas por causa", () => {
    const valores = Object.values(IMAGE_MESSAGES)
    assert.equal(new Set(valores).size, valores.length)
    assert.match(IMAGE_MESSAGES.TOO_LARGE, /25 MB/)
    assert.match(IMAGE_MESSAGES.HEIC_UNSUPPORTED, /HEIC/)
    assert.match(IMAGE_MESSAGES.UNSUPPORTED_FORMAT, /JPEG, PNG ou WebP/)
  })
})

describe("sniffImageKind — pelo conteúdo, nunca pelo nome", () => {
  it("JPEG, PNG e WebP reais", async () => {
    assert.equal(sniffImageKind(await amostra("jpeg", 4, 4)), "image/jpeg")
    assert.equal(sniffImageKind(await amostra("png", 4, 4)), "image/png")
    assert.equal(sniffImageKind(await amostra("webp", 4, 4)), "image/webp")
  })

  it("HEIC, GIF, SVG e não-imagem", () => {
    assert.equal(sniffImageKind(HEIC_HEAD), "heic")
    assert.equal(sniffImageKind(GIF_HEAD), "gif")
    assert.equal(sniffImageKind(SVG_HEAD), "svg")
    assert.equal(sniffImageKind(PHP_HEAD), "unknown")
    assert.equal(sniffImageKind(new Uint8Array(0)), "unknown")
  })
})

describe("checkImageInput — porta de entrada no cliente", () => {
  it("aceita JPEG/PNG/WebP até 25 MB, inclusive com MIME vazio ou extensão/MIME trocados", async () => {
    const jpeg = await amostra("jpeg", 4, 4)
    for (const type of ["image/jpeg", "", "application/octet-stream", "image/png"]) {
      const r = checkImageInput({ size: IMAGE_INPUT_MAX_BYTES, type }, jpeg)
      assert.deepEqual(r, { ok: true, kind: "image/jpeg" }, type)
    }
  })

  it("imagem acima de 25 MB → TOO_LARGE", async () => {
    const r = checkImageInput({ size: IMAGE_INPUT_MAX_BYTES + 1, type: "image/jpeg" }, await amostra("jpeg", 4, 4))
    assert.deepEqual(r, { ok: false, code: "TOO_LARGE", message: IMAGE_MESSAGES.TOO_LARGE })
  })

  it("HEIC é TENTADO (pelo conteúdo ou pelo tipo declarado)", () => {
    assert.deepEqual(checkImageInput({ size: 3 * MB, type: "" }, HEIC_HEAD), { ok: true, kind: "heic" })
    assert.deepEqual(checkImageInput({ size: 3 * MB, type: "image/heic" }, new Uint8Array(12)), { ok: true, kind: "heic" })
  })

  it("GIF e SVG → formato não suportado; conteúdo que não é imagem → inválida", () => {
    assert.equal((checkImageInput({ size: 10, type: "image/gif" }, GIF_HEAD) as { code: string }).code, "UNSUPPORTED_FORMAT")
    assert.equal((checkImageInput({ size: 10, type: "image/png" }, SVG_HEAD) as { code: string }).code, "UNSUPPORTED_FORMAT")
    assert.equal((checkImageInput({ size: 10, type: "image/png" }, PHP_HEAD) as { code: string }).code, "INVALID_IMAGE")
  })
})

describe("readImageDimensions — cabeçalho, sem decodificar", () => {
  for (const fmt of ["jpeg", "png", "webp"] as const) {
    it(`${fmt}: largura e altura corretas`, async () => {
      assert.deepEqual(readImageDimensions(await amostra(fmt, 123, 45)), { width: 123, height: 45 })
    })
  }

  it("JPEG com bloco EXIF grande antes do SOF", async () => {
    const buf = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#123" } })
      .jpeg()
      .withExif({ IFD0: { ImageDescription: "x".repeat(40_000), Make: "Fixture" } })
      .toBuffer()
    assert.deepEqual(readImageDimensions(buf), { width: 640, height: 480 })
  })

  it("WebP sem perdas (VP8L)", async () => {
    const buf = await sharp({ create: { width: 77, height: 33, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } })
      .webp({ lossless: true })
      .toBuffer()
    assert.deepEqual(readImageDimensions(buf), { width: 77, height: 33 })
  })

  it("conteúdo desconhecido ou truncado → null", () => {
    assert.equal(readImageDimensions(PHP_HEAD), null)
    assert.equal(readImageDimensions(new Uint8Array([0xff, 0xd8, 0xff])), null)
  })

  it("bomba de pixels detectável pelo cabeçalho", () => {
    assert.equal(exceedsInputPixels({ width: 30000, height: 30000 }), true)
    assert.equal(exceedsInputPixels({ width: 8160, height: 6120 }), false)
    assert.equal(exceedsInputPixels(null), false)
  })
})

describe("fitInside — sem corte, sem ampliação, proporção preservada", () => {
  it("48 MP paisagem e retrato", () => {
    assert.deepEqual(fitInside(8000, 6000, 2560), { width: 2560, height: 1920 })
    assert.deepEqual(fitInside(6000, 8000, 1024), { width: 768, height: 1024 })
  })

  it("menor que o limite fica como está", () => {
    assert.deepEqual(fitInside(800, 600, 1600), { width: 800, height: 600 })
  })

  it("panorama extremo não zera a dimensão curta", () => {
    const r = fitInside(20000, 10, 1024)
    assert.equal(r.width, 1024)
    assert.ok(r.height >= 1)
  })
})

describe("preparedImageFileName", () => {
  it("troca a extensão por .jpg e sanitiza", () => {
    assert.equal(preparedImageFileName("IMG_0001.HEIC"), "IMG_0001.jpg")
    assert.equal(preparedImageFileName("foto do dog (1).png"), "foto-do-dog-1-.jpg")
    assert.equal(preparedImageFileName(".png"), "foto.jpg")
  })
})
