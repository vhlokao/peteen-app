/**
 * Fotos do Diário — publicação a partir do objeto reprocessado, com
 * atomicidade. PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * O Storage é um dublê em memória; o processamento é o REAL
 * (`processImageForStorage`, sharp), para que "o arquivo publicado não tem
 * EXIF/GPS" seja prova e não suposição.
 *
 * Rodar: npm run test:image
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"

import {
  CARE_PHOTO_NOT_CONFIRMED,
  CARE_PHOTO_PUBLISH_FAILED,
  discardCarePhotoObjects,
  finalizeCarePhotos,
  type CarePhotoDeps,
} from "./finalize-care-photos.ts"
import { processImageForStorage } from "../../../lib/image/process-image.server.ts"
import { IMAGE_MESSAGES } from "../../../lib/image/image-policy.ts"

const REQ = "req_123"
const EXIF_COM_GPS = {
  IFD0: { Make: "PeteenFixture" },
  IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 32/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" },
}

async function fotoComGps(w = 3200, h = 2400): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#963" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif(EXIF_COM_GPS)
    .toBuffer()
}

/** Bucket em memória + registro de chamadas. */
function storageFake(inicial: Record<string, Uint8Array>, opcoes: { falharUploadNa?: number } = {}) {
  const objetos = new Map<string, Uint8Array>(Object.entries(inicial))
  const removidos: string[] = []
  let uploads = 0
  let seq = 0
  const deps: CarePhotoDeps = {
    download: async (p) => objetos.get(p) ?? null,
    process: (bytes, declaredType) => processImageForStorage({ bytes, declaredType, category: "CARE_PHOTO" }),
    uploadFinal: async (bytes) => {
      uploads++
      if (opcoes.falharUploadNa === uploads) return null
      const p = `requests/${REQ}/final-${++seq}.jpg`
      objetos.set(p, bytes)
      return p
    },
    remove: async (p) => {
      removidos.push(p)
      return objetos.delete(p)
    },
    declaredTypeOf: (p) => (p.endsWith(".jpg") ? "image/jpeg" : p.endsWith(".png") ? "image/png" : null),
  }
  return { deps, objetos, removidos }
}

describe("finalizeCarePhotos — sucesso", () => {
  it("publica a SAÍDA reprocessada em chave nova: JPEG ≤ 2560 px, em pé, sem EXIF/GPS; o original fica intacto até a publicação", async () => {
    const original = await fotoComGps()
    assert.ok((await sharp(original).metadata()).exif, "fixture sem EXIF")
    const { deps, objetos, removidos } = storageFake({ [`requests/${REQ}/a.jpg`]: original })

    const r = await finalizeCarePhotos({ paths: [`requests/${REQ}/a.jpg`], deps })
    assert.equal(r.ok, true)
    if (!r.ok) return

    const [foto] = r.photos
    assert.notEqual(foto!.finalPath, foto!.originalPath, "nunca publica o mesmo path enviado")
    assert.equal(foto!.mimeType, "image/jpeg")
    const final = objetos.get(foto!.finalPath)!
    const m = await sharp(final).metadata()
    assert.equal(m.format, "jpeg")
    assert.equal(m.exif, undefined)
    assert.equal(m.orientation, undefined)
    assert.equal(Buffer.from(final).includes(Buffer.from("Exif\0\0")), false)
    assert.equal(Math.max(m.width!, m.height!), 2560)
    assert.ok(m.height! > m.width!, "orientação 6 aplicada: fica em pé")
    assert.equal(foto!.sizeBytes, final.byteLength)
    assert.deepEqual(removidos, [], "nada é apagado antes de a publicação confirmar")
    assert.ok(objetos.has(`requests/${REQ}/a.jpg`))
  })

  it("após publicar, descartar originais remove só os enviados", async () => {
    const { deps, objetos } = storageFake({ [`requests/${REQ}/a.jpg`]: await fotoComGps(40, 20) })
    const r = await finalizeCarePhotos({ paths: [`requests/${REQ}/a.jpg`], deps })
    assert.ok(r.ok)
    await discardCarePhotoObjects(r.ok ? r.photos.map((f) => f.originalPath) : [], deps.remove)
    assert.equal(objetos.has(`requests/${REQ}/a.jpg`), false)
    assert.equal(objetos.has(r.ok ? r.photos[0]!.finalPath : ""), true)
  })
})

describe("finalizeCarePhotos — falha parcial não deixa registro nem objetos novos órfãos", () => {
  it("3ª foto reprovada (não é imagem) → finais da 1ª e 2ª removidos; original reprovado apagado; originais válidos preservados para novo envio", async () => {
    const boa = await fotoComGps(400, 300)
    const { deps, objetos, removidos } = storageFake({
      [`requests/${REQ}/a.jpg`]: boa,
      [`requests/${REQ}/b.jpg`]: boa,
      [`requests/${REQ}/c.jpg`]: new TextEncoder().encode("<?php system($_GET['c']); ?>"),
    })

    const r = await finalizeCarePhotos({
      paths: [`requests/${REQ}/a.jpg`, `requests/${REQ}/b.jpg`, `requests/${REQ}/c.jpg`],
      deps,
    })

    assert.deepEqual(r, { ok: false, error: IMAGE_MESSAGES.INVALID_IMAGE })
    const finaisRestantes = [...objetos.keys()].filter((k) => k.includes("final-"))
    assert.deepEqual(finaisRestantes, [], "nenhum objeto final pode sobrar")
    assert.ok(removidos.includes(`requests/${REQ}/final-1.jpg`))
    assert.ok(removidos.includes(`requests/${REQ}/final-2.jpg`))
    assert.equal(objetos.has(`requests/${REQ}/c.jpg`), false, "conteúdo reprovado não fica no bucket")
    assert.ok(objetos.has(`requests/${REQ}/a.jpg`) && objetos.has(`requests/${REQ}/b.jpg`))
  })

  it("falha ao gravar o final da 2ª foto → final da 1ª removido; originais preservados", async () => {
    const boa = await fotoComGps(400, 300)
    const { deps, objetos } = storageFake(
      { [`requests/${REQ}/a.jpg`]: boa, [`requests/${REQ}/b.jpg`]: boa },
      { falharUploadNa: 2 }
    )
    const r = await finalizeCarePhotos({ paths: [`requests/${REQ}/a.jpg`, `requests/${REQ}/b.jpg`], deps })
    assert.deepEqual(r, { ok: false, error: CARE_PHOTO_PUBLISH_FAILED })
    assert.deepEqual([...objetos.keys()].filter((k) => k.includes("final-")), [])
    assert.ok(objetos.has(`requests/${REQ}/a.jpg`) && objetos.has(`requests/${REQ}/b.jpg`))
  })

  it("original inexistente (rede/Storage) → erro de confirmação; nada apagado", async () => {
    const { deps, removidos } = storageFake({})
    const r = await finalizeCarePhotos({ paths: [`requests/${REQ}/sumiu.jpg`], deps })
    assert.deepEqual(r, { ok: false, error: CARE_PHOTO_NOT_CONFIRMED })
    assert.deepEqual(removidos, [])
  })

  it("HEIC enviado → mensagem de HEIC; original apagado; nada publicado", async () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic"), ...new Uint8Array(20)])
    const { deps, objetos } = storageFake({ [`requests/${REQ}/h.jpg`]: heic })
    const r = await finalizeCarePhotos({ paths: [`requests/${REQ}/h.jpg`], deps })
    assert.deepEqual(r, { ok: false, error: IMAGE_MESSAGES.HEIC_UNSUPPORTED })
    assert.equal(objetos.size, 0)
  })

  it("dependência que lança não escapa: vira falha tratada com limpeza", async () => {
    const boa = await fotoComGps(40, 20)
    const { deps, objetos } = storageFake({ [`requests/${REQ}/a.jpg`]: boa, [`requests/${REQ}/b.jpg`]: boa })
    let n = 0
    const r = await finalizeCarePhotos({
      paths: [`requests/${REQ}/a.jpg`, `requests/${REQ}/b.jpg`],
      deps: {
        ...deps,
        download: async (p) => {
          if (++n === 2) throw new Error("rede caiu")
          return deps.download(p)
        },
      },
    })
    assert.deepEqual(r, { ok: false, error: CARE_PHOTO_NOT_CONFIRMED })
    assert.deepEqual([...objetos.keys()].filter((k) => k.includes("final-")), [])
  })

  it("lista vazia (atualização só com texto) → ok sem I/O", async () => {
    const { deps, objetos } = storageFake({})
    assert.deepEqual(await finalizeCarePhotos({ paths: [], deps }), { ok: true, photos: [] })
    assert.equal(objetos.size, 0)
  })
})
