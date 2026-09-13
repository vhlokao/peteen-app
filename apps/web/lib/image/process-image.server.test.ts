/**
 * Reprocessamento no servidor — PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * Fixtures geradas na hora com o sharp instalado. Cada fixture com metadado
 * prova primeiro que TEM o metadado, senão "a saída não tem GPS" passaria por
 * construção.
 *
 * Rodar: npm run test:image
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import zlib from "node:zlib"
import sharp from "sharp"

import { processImageForStorage, type ProcessedImage } from "./process-image.server.ts"
import { IMAGE_CATEGORY_POLICY, IMAGE_MESSAGES, type ImageCategory } from "./image-policy.ts"

const MB = 1024 * 1024

const EXIF_COM_GPS = {
  IFD0: { Make: "PeteenFixture", Model: "UploadGate" },
  IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 32/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" },
}

/** Só para o bloco EXIF isolado da FIXTURE (curto): ponteiro do IFD de GPS (0x8825). */
function temPonteiroGps(exif: Uint8Array): boolean {
  const b = Buffer.from(exif)
  return b.includes(Buffer.from([0x25, 0x88])) || b.includes(Buffer.from([0x88, 0x25]))
}

/**
 * Arquivo FINAL sem nenhum bloco de metadados: sem segmento APP1 "Exif", sem
 * XMP, sem a marca da câmera da fixture. (Procurar bytes soltos do ponteiro
 * GPS num JPEG inteiro dá falso positivo — é dado comprimido.)
 */
function arquivoSemMetadados(buf: Uint8Array): boolean {
  const b = Buffer.from(buf)
  return (
    !b.includes(Buffer.from("Exif\0\0")) &&
    !b.includes(Buffer.from("http://ns.adobe.com/xap")) &&
    !b.includes(Buffer.from("PeteenFixture"))
  )
}

async function comMetadados(fmt: "jpeg" | "png" | "webp", w = 1200, h = 600): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#c33" } })
    [fmt]()
    .withMetadata({ orientation: 6 })
    .withExif(EXIF_COM_GPS)
    .toBuffer()
}

function ok(r: Awaited<ReturnType<typeof processImageForStorage>>): ProcessedImage {
  assert.equal(r.ok, true, r.ok ? "" : `recusado: ${(r as { message: string }).message}`)
  return r as ProcessedImage
}

describe("JPEG/PNG/WebP válidos → JPEG final limpo e em pé", () => {
  for (const fmt of ["jpeg", "png", "webp"] as const) {
    it(`${fmt}`, async () => {
      const entrada = await comMetadados(fmt)
      const m0 = await sharp(entrada).metadata()
      assert.ok(m0.exif && temPonteiroGps(m0.exif), "fixture sem GPS")
      assert.equal(m0.orientation, 6)

      const r = ok(await processImageForStorage({ bytes: entrada, declaredType: `image/${fmt}`, category: "PET" }))
      const m = await sharp(r.bytes).metadata()

      assert.equal(m.format, "jpeg")
      assert.equal(r.mimeType, "image/jpeg")
      assert.equal(m.exif, undefined, "EXIF sobreviveu")
      assert.equal(m.xmp, undefined)
      assert.equal(m.iptc, undefined)
      assert.equal(m.icc, undefined)
      assert.equal(m.orientation, undefined, "tag de orientação sobreviveu")
      assert.equal(arquivoSemMetadados(r.bytes), true)
      // 1200×600 com orientação 6 → 600×1200 em pé; cabe em 1600, não amplia.
      assert.equal(m.width, 600)
      assert.equal(m.height, 1200)
      assert.equal(r.width, 600)
      assert.equal(r.height, 1200)
      assert.equal(r.sizeBytes, r.bytes.byteLength)
    })
  }

  it("MIME vazio/genérico: o conteúdo decide", async () => {
    const entrada = await comMetadados("png", 40, 20)
    for (const declaredType of ["", "application/octet-stream"]) {
      ok(await processImageForStorage({ bytes: entrada, declaredType, category: "AVATAR" }))
    }
  })

  it("transparência vira fundo branco (JPEG não tem alfa)", async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const r = ok(await processImageForStorage({ bytes: png, declaredType: "image/png", category: "AVATAR" }))
    const { data } = await sharp(r.bytes).raw().toBuffer({ resolveWithObject: true })
    assert.ok(data[0]! > 240 && data[1]! > 240 && data[2]! > 240, "pixel transparente deveria virar branco")
    assert.equal((await sharp(r.bytes).metadata()).hasAlpha, false)
  })
})

describe("dimensões e tamanho final por categoria", () => {
  const casos: Array<[ImageCategory, number]> = [["AVATAR", 1024], ["PET", 1600], ["CARE_PHOTO", 2560]]
  for (const [categoria, max] of casos) {
    it(`${categoria}: maior lado ≤ ${max}, proporção preservada, ≤ teto de saída`, async () => {
      const entrada = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#456" } }).jpeg().toBuffer()
      const r = ok(await processImageForStorage({ bytes: entrada, declaredType: "image/jpeg", category: categoria }))
      assert.equal(Math.max(r.width, r.height), max)
      assert.equal(Math.round((r.width / r.height) * 100), Math.round((4000 / 3000) * 100))
      assert.ok(r.sizeBytes <= IMAGE_CATEGORY_POLICY[categoria].outputMaxBytes)
    })
  }

  it("imagem menor que o limite não é ampliada", async () => {
    const entrada = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#789" } }).jpeg().toBuffer()
    const r = ok(await processImageForStorage({ bytes: entrada, declaredType: "image/jpeg", category: "CARE_PHOTO" }))
    assert.deepEqual([r.width, r.height], [300, 200])
  })
})

describe("recusas", () => {
  it("arquivo corrompido com assinatura JPEG válida → inválida", async () => {
    const lixo = new Uint8Array(4096)
    lixo.set([0xff, 0xd8, 0xff, 0xe0])
    const r = await processImageForStorage({ bytes: lixo, declaredType: "image/jpeg", category: "PET" })
    assert.deepEqual(r, { ok: false, code: "INVALID_IMAGE", message: IMAGE_MESSAGES.INVALID_IMAGE })
  })

  it("JPEG truncado pela metade → inválida (nunca grava parcial)", async () => {
    const inteiro = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#abc" } }).jpeg().toBuffer()
    const r = await processImageForStorage({ bytes: inteiro.subarray(0, 200), declaredType: "image/jpeg", category: "PET" })
    assert.equal(r.ok, false)
  })

  it("MIME declarado incompatível com o conteúdo (JPEG declarado PNG) → inválida", async () => {
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).jpeg().toBuffer()
    const r = await processImageForStorage({ bytes: jpeg, declaredType: "image/png", category: "AVATAR" })
    assert.equal(r.ok === false && r.code, "INVALID_IMAGE")
  })

  it("não-imagem (PHP disfarçado, PDF) → inválida", async () => {
    for (const texto of ["<?php system($_GET['c']); ?>", "%PDF-1.7\n..."]) {
      const r = await processImageForStorage({ bytes: new TextEncoder().encode(texto), declaredType: "image/png", category: "PET" })
      assert.equal(r.ok === false && r.code, "INVALID_IMAGE", texto)
    }
  })

  it("SVG e GIF → formato não suportado", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#0f0" } }).gif().toBuffer()
    assert.equal((await processImageForStorage({ bytes: svg, declaredType: "", category: "AVATAR" })).ok === false, true)
    const rs = await processImageForStorage({ bytes: svg, declaredType: "", category: "AVATAR" })
    const rg = await processImageForStorage({ bytes: gif, declaredType: "", category: "AVATAR" })
    assert.equal(rs.ok === false && rs.code, "UNSUPPORTED_FORMAT")
    assert.equal(rg.ok === false && rg.code, "UNSUPPORTED_FORMAT")
  })

  it("HEIC → mensagem própria (o sharp instalado não decodifica HEVC)", async () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic"), ...new Uint8Array(20)])
    const r1 = await processImageForStorage({ bytes: heic, declaredType: "", category: "CARE_PHOTO" })
    const r2 = await processImageForStorage({ bytes: new Uint8Array(40), declaredType: "image/heic", category: "CARE_PHOTO" })
    assert.equal(r1.ok === false && r1.code, "HEIC_UNSUPPORTED")
    assert.equal(r2.ok === false && r2.code, "HEIC_UNSUPPORTED")
  })

  it("acima do teto de transporte da categoria → muito grande, sem decodificar", async () => {
    const grande = new Uint8Array(IMAGE_CATEGORY_POLICY.AVATAR.transportMaxBytes + 1)
    grande.set([0xff, 0xd8, 0xff, 0xe0])
    const r = await processImageForStorage({ bytes: grande, declaredType: "image/jpeg", category: "AVATAR" })
    assert.equal(r.ok === false && r.code, "TOO_LARGE")
  })

  it("bomba de pixels (PNG de 74 bytes declarando 30000×30000) → muito grande, rápido", async () => {
    const crc = (b: Buffer) => zlib.crc32(b) >>> 0
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
      const td = Buffer.concat([Buffer.from(type), data])
      const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
      return Buffer.concat([len, td, c])
    }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(30000, 0); ihdr.writeUInt32BE(30000, 4); ihdr[8] = 8; ihdr[9] = 2
    const bomba = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(Buffer.alloc(64))),
      chunk("IEND", Buffer.alloc(0)),
    ])
    const t0 = Date.now()
    const r = await processImageForStorage({ bytes: bomba, declaredType: "image/png", category: "CARE_PHOTO" })
    assert.equal(r.ok === false && r.code, "TOO_LARGE")
    assert.ok(Date.now() - t0 < 500, "a recusa não pode depender de decodificar")
  })

  it("vazio → inválida", async () => {
    const r = await processImageForStorage({ bytes: new Uint8Array(0), declaredType: "image/jpeg", category: "PET" })
    assert.equal(r.ok === false && r.code, "INVALID_IMAGE")
  })
})

describe("caso grande equivalente a 48 MP", () => {
  const W = 8000, H = 6000
  async function foto48mp(quality: number): Promise<Buffer> {
    const raw = Buffer.alloc(W * H * 3)
    let semente = 7
    for (let i = 0; i < raw.length; i += 3) {
      const x = (i / 3) % W
      semente = (semente * 1103515245 + 12345) & 0x7fffffff
      raw[i] = (x + (semente & 31)) & 255
      raw[i + 1] = ((x >> 2) + (semente & 15)) & 255
      raw[i + 2] = (((i / 3 / W) | 0) + (semente & 7)) & 255
    }
    return sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .jpeg({ quality })
      .withMetadata({ orientation: 6 })
      .withExif(EXIF_COM_GPS)
      .toBuffer()
  }

  it("48 MP que JÁ cabe no transporte do Diário (≤ 5 MB) → 2560 px, em pé, sem EXIF, no teto, custo medido", async () => {
    let entrada = await foto48mp(60)
    for (const q of [45, 30, 15]) {
      if (entrada.byteLength <= IMAGE_CATEGORY_POLICY.CARE_PHOTO.transportMaxBytes) break
      entrada = await foto48mp(q)
    }
    assert.ok(entrada.byteLength <= IMAGE_CATEGORY_POLICY.CARE_PHOTO.transportMaxBytes, "fixture precisa caber em 5 MB")
    const m0 = await sharp(entrada).metadata()
    assert.ok(m0.exif && temPonteiroGps(m0.exif), "fixture sem GPS")

    const t0 = Date.now()
    const r = ok(await processImageForStorage({ bytes: entrada, declaredType: "image/jpeg", category: "CARE_PHOTO" }))
    const ms = Date.now() - t0
    const m = await sharp(r.bytes).metadata()
    process.stdout.write(`# [48MP servidor] entrada ${(entrada.byteLength / MB).toFixed(2)} MB → saída ${(r.sizeBytes / 1024).toFixed(0)} KB ${r.width}x${r.height} q${r.quality} em ${ms} ms\n`)

    assert.equal(r.width, 1920)
    assert.equal(r.height, 2560)
    assert.equal(m.exif, undefined)
    assert.equal(m.orientation, undefined)
    assert.equal(arquivoSemMetadados(r.bytes), true)
    assert.ok(r.sizeBytes <= IMAGE_CATEGORY_POLICY.CARE_PHOTO.outputMaxBytes)
    assert.ok(ms < 15_000)
  })

  it("48 MP acima de 5 MB enviado DIRETO ao servidor → muito grande (quem reduz é o navegador)", async () => {
    const entrada = await foto48mp(95)
    assert.ok(entrada.byteLength > IMAGE_CATEGORY_POLICY.CARE_PHOTO.transportMaxBytes, "fixture precisa passar de 5 MB")
    process.stdout.write(`# [48MP sem preparo] ${(entrada.byteLength / MB).toFixed(2)} MB\n`)
    for (const categoria of ["AVATAR", "PET", "CARE_PHOTO"] as const) {
      const r = await processImageForStorage({ bytes: entrada, declaredType: "image/jpeg", category: categoria })
      assert.equal(r.ok === false && r.code, "TOO_LARGE", categoria)
    }
  })
})