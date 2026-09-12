/**
 * SEAL-P2-01 — a foto pública gravada não pode carregar metadados.
 *
 * Fixtures geradas NA HORA com o próprio sharp: uma imagem com EXIF de GPS
 * (latitude/longitude reais no bloco GPS), marca/modelo, XMP e orientação 6
 * ("deitada", rotação só na tag). Cada teste primeiro prova que a FIXTURE tem
 * o metadado — sem isso, "a saída não tem GPS" passaria por construção.
 *
 * Rodar: npm run test:pet-photo
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

import {
  LOSSY_QUALITY_LADDER,
  REENCODE_MAX_INPUT_PIXELS,
  reencodeWithoutMetadata,
} from "./image-metadata-strip.ts"
import {
  detectImageTypeFromBytes,
  INVALID_CONTENT_MESSAGE,
  PET_PHOTO_MAX_BYTES,
  PetPhotoValidationError,
  TOO_LARGE_MESSAGE,
} from "./pet-photo-signature.ts"

const FORMATOS = [
  { type: "image/jpeg", enc: "jpeg" },
  { type: "image/png", enc: "png" },
  { type: "image/webp", enc: "webp" },
] as const

const EXIF_COM_GPS = {
  IFD0: { Make: "PeteenFixture", Model: "SealP201" },
  IFD3: {
    GPSLatitudeRef: "S",
    GPSLatitude: "23/1 32/1 0/1",
    GPSLongitudeRef: "W",
    GPSLongitude: "46/1 38/1 0/1",
  },
}

const XMP = `<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="23,32.0S"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`

/** Tag do ponteiro para o bloco GPS (0x8825), nas duas ordens de byte do TIFF. */
function temTagGps(buf: Uint8Array): boolean {
  const b = Buffer.from(buf)
  return b.includes(Buffer.from([0x25, 0x88])) || b.includes(Buffer.from([0x88, 0x25]))
}

async function fixture(enc: "jpeg" | "png" | "webp"): Promise<Buffer> {
  // Retângulo 40×20 com um canto marcado, para verificar a rotação pelos pixels.
  return sharp({ create: { width: 40, height: 20, channels: 3, background: "#c33" } })
    [enc]()
    .withMetadata({ orientation: 6 })
    .withExif(EXIF_COM_GPS)
    .withXmp(XMP)
    .toBuffer()
}

for (const { type, enc } of FORMATOS) {
  describe(`reencodeWithoutMetadata — ${type}`, () => {
    it("a fixture de fato carrega EXIF com GPS, XMP e orientação (senão o teste não prova nada)", async () => {
      const m = await sharp(await fixture(enc)).metadata()
      assert.ok(m.exif && m.exif.length > 0, "fixture sem EXIF")
      assert.ok(temTagGps(m.exif), "fixture sem bloco GPS")
      assert.equal(m.orientation, 6)
      if (enc !== "webp" || m.xmp) assert.ok(m.xmp && m.xmp.length > 0, "fixture sem XMP")
    })

    it("a saída NÃO tem EXIF, GPS, XMP, IPTC nem tag de orientação", async () => {
      const out = await reencodeWithoutMetadata(new Uint8Array(await fixture(enc)), type)
      const m = await sharp(out).metadata()
      assert.equal(m.exif, undefined, "EXIF sobreviveu")
      assert.equal(m.xmp, undefined, "XMP sobreviveu")
      assert.equal(m.iptc, undefined, "IPTC sobreviveu")
      assert.equal(m.orientation, undefined, "tag de orientação sobreviveu")
      // Varredura dos bytes crus, independente do parser do sharp.
      const bytes = Buffer.from(out)
      assert.equal(bytes.includes(Buffer.from("Exif\0\0")), false, "cabeçalho Exif nos bytes")
      assert.equal(bytes.includes(Buffer.from("PeteenFixture")), false, "marca da câmera nos bytes")
      assert.equal(bytes.includes(Buffer.from("GPSLatitude")), false, "XMP de GPS nos bytes")
      assert.equal(temTagGps(out), false, "ponteiro GPS nos bytes")
    })

    it("preserva o formato (magic bytes da saída = tipo declarado)", async () => {
      const out = await reencodeWithoutMetadata(new Uint8Array(await fixture(enc)), type)
      assert.equal(detectImageTypeFromBytes(out), type)
    })

    it("aplica a orientação nos pixels: 40×20 com orientação 6 sai 20×40 em pé", async () => {
      const out = await reencodeWithoutMetadata(new Uint8Array(await fixture(enc)), type)
      const m = await sharp(out).metadata()
      assert.equal(m.width, 20)
      assert.equal(m.height, 40)
    })

    it("a saída cabe no limite do bucket", async () => {
      const out = await reencodeWithoutMetadata(new Uint8Array(await fixture(enc)), type)
      assert.ok(out.byteLength <= PET_PHOTO_MAX_BYTES)
    })
  })
}

describe("reencodeWithoutMetadata — recusas", () => {
  it("assinatura JPEG válida com conteúdo corrompido → mensagem de conteúdo inválido", async () => {
    const lixo = new Uint8Array(2048)
    lixo.set([0xff, 0xd8, 0xff, 0xe0])
    await assert.rejects(
      reencodeWithoutMetadata(lixo, "image/jpeg"),
      (err: unknown) => err instanceof PetPhotoValidationError && err.message === INVALID_CONTENT_MESSAGE
    )
  })

  it("PNG sem perdas que não cabe em 5 MB após re-encode → mensagem de muito grande, nunca grava acima do limite", async () => {
    // Ruído não comprime: 1400×1400×3 ≈ 5,9 MB de pixels aleatórios.
    const w = 1400
    const raw = Buffer.alloc(w * w * 3)
    for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0
    const png = await sharp(raw, { raw: { width: w, height: w, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer()
    await assert.rejects(
      reencodeWithoutMetadata(new Uint8Array(png), "image/png"),
      (err: unknown) => err instanceof PetPhotoValidationError && err.message === TOO_LARGE_MESSAGE
    )
  })

  it("constantes defensivas presentes e sãs", () => {
    assert.ok(REENCODE_MAX_INPUT_PIXELS >= 50_000_000, "precisa aceitar câmera de 50 MP")
    assert.ok(REENCODE_MAX_INPUT_PIXELS <= 268_402_689, "não pode afrouxar o teto padrão do sharp")
    assert.deepEqual([...LOSSY_QUALITY_LADDER], [...LOSSY_QUALITY_LADDER].sort((a, b) => b - a))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CONTRATO — os dois pontos de upload público usam o re-encode, depois da
// validação, e enviam os bytes RE-CODIFICADOS (nunca o arquivo original).
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

for (const [arquivo, validador] of [
  ["lib/storage/avatar-photo.ts", "validateAvatarFile"],
  ["lib/storage/pet-photo.ts", "validatePetPhotoFile"],
] as const) {
  describe(`${arquivo} — upload público sem metadados`, () => {
    const fonte = semComentarios(readFileSync(path.join(RAIZ_APP, arquivo), "utf8"))
    const corpo = fonte.slice(fonte.search(/export async function upload\w+Photo\(/))

    it("valida (MIME, tamanho, magic bytes) ANTES de re-codificar", () => {
      const iValida = corpo.indexOf(`await ${validador}(file)`)
      const iReencode = corpo.indexOf("reencodeWithoutMetadata(")
      assert.ok(iValida >= 0, "validação ausente")
      assert.ok(iReencode > iValida, "re-encode precisa vir depois da validação")
    })

    it("o corpo do upload é montado com os bytes re-codificados", () => {
      assert.match(corpo, /const bytes = await reencodeWithoutMetadata\(/)
      assert.match(corpo, /new Blob\(\[bytes\], \{ type: detectedType \}\)/)
      assert.doesNotMatch(corpo, /new Blob\(\[\s*await file\.arrayBuffer\(\)/)
    })
  })
}
