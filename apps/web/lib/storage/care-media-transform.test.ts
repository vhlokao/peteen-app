/**
 * Três níveis de imagem — miniatura, visualização e original.
 *
 * O que estes testes travam: a grade nunca pede a original quando há
 * miniatura, o lightbox nunca pede a original quando há versão de
 * visualização, e mídia sem nenhuma variante continua aparecendo — que é o que
 * dispensa backfill das fotos já publicadas.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CARE_MEDIA_DISPLAY_PX,
  CARE_MEDIA_DISPLAY_QUALITY,
  CARE_MEDIA_THUMBNAIL_PX,
  CARE_MEDIA_THUMBNAIL_QUALITY,
  careMediaDisplayTransform,
  careMediaThumbnailTransform,
  resolveLightboxImageSrc,
  resolveTimelineImageSrc,
  type CareMediaUrls,
} from "./care-media-transform.ts"

const ORIGINAL = "https://storage.example/foto.jpg?token=abc"
const MINIATURA = "https://storage.example/foto.jpg?token=abc&width=288"
const DISPLAY = "https://storage.example/foto.jpg?token=abc&width=1600"

const urls = (over: Partial<CareMediaUrls> = {}): CareMediaUrls => ({
  signedUrl: ORIGINAL,
  thumbnailUrl: MINIATURA,
  displayUrl: DISPLAY,
  ...over,
})

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros
// ─────────────────────────────────────────────────────────────────────────────

describe("miniatura — grade da timeline", () => {
  it("288px cobre a grade de 96 CSS px em telas 3x", () => {
    assert.equal(CARE_MEDIA_THUMBNAIL_PX, 288)
    assert.equal(CARE_MEDIA_THUMBNAIL_PX % 96, 0)
  })

  it("usa `cover` — o CSS da grade já recorta com object-cover", () => {
    assert.equal(careMediaThumbnailTransform().resize, "cover")
  })

  it("quadrada e com qualidade reduzida, mas não agressiva", () => {
    const t = careMediaThumbnailTransform()
    assert.equal(t.width, t.height)
    assert.equal(CARE_MEDIA_THUMBNAIL_QUALITY, 75)
  })
})

describe("visualização — lightbox", () => {
  it("usa `contain`: a foto inteira precisa aparecer, sem recorte", () => {
    // É a diferença entre uma miniatura de grade e olhar a evidência.
    assert.equal(careMediaDisplayTransform().resize, "contain")
  })

  it("1600px no maior lado — folga sobre os ~512 CSS px do diálogo", () => {
    // A folga existe para pinch-zoom no celular, que é onde alguém amplia
    // para olhar o olho do animal ou uma etiqueta.
    assert.equal(CARE_MEDIA_DISPLAY_PX, 1600)
    assert.ok(CARE_MEDIA_DISPLAY_PX > CARE_MEDIA_THUMBNAIL_PX)
  })

  it("qualidade maior que a da miniatura — é a tela de evidência", () => {
    assert.equal(CARE_MEDIA_DISPLAY_QUALITY, 82)
    assert.ok(CARE_MEDIA_DISPLAY_QUALITY > CARE_MEDIA_THUMBNAIL_QUALITY)
  })

  it("as duas transformações são objetos independentes", () => {
    // Devolver a mesma referência deixaria um chamador mutar o padrão do outro.
    assert.notEqual(careMediaThumbnailTransform(), careMediaDisplayTransform())
    assert.notDeepEqual(careMediaThumbnailTransform(), careMediaDisplayTransform())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Roteamento — quem usa o quê
// ─────────────────────────────────────────────────────────────────────────────

describe("grade — miniatura, com queda para a original", () => {
  it("com miniatura, usa a miniatura", () => {
    assert.equal(resolveTimelineImageSrc(urls()), MINIATURA)
  })

  it("sem miniatura, cai para a ORIGINAL — nunca para a de visualização", () => {
    // A display é 1600px: pesada demais para uma grade de 96px, e a original
    // é o único fallback garantido. Cair na display aqui seria trocar um
    // problema de peso por outro.
    assert.equal(resolveTimelineImageSrc(urls({ thumbnailUrl: null })), ORIGINAL)
  })
})

describe("lightbox — visualização, com queda para a original", () => {
  it("com display, usa a display e NUNCA a original", () => {
    // Mudança desta missão: antes o lightbox servia a original (4,7 MB) e
    // parecia lento justamente na tela que o usuário abriu de propósito.
    assert.equal(resolveLightboxImageSrc(urls()), DISPLAY)
    assert.notEqual(resolveLightboxImageSrc(urls()), ORIGINAL)
  })

  it("sem display, cai para a original", () => {
    assert.equal(resolveLightboxImageSrc(urls({ displayUrl: null })), ORIGINAL)
  })

  it("ignora a miniatura mesmo quando a display falta", () => {
    // 288px numa tela cheia seria evidência ilegível.
    assert.equal(
      resolveLightboxImageSrc(urls({ displayUrl: null, thumbnailUrl: MINIATURA })),
      ORIGINAL
    )
  })
})

describe("mídia legada — sem nenhuma variante", () => {
  it("as duas superfícies caem para a original, sem backfill", () => {
    const legada = urls({ thumbnailUrl: null, displayUrl: null })
    assert.equal(resolveTimelineImageSrc(legada), ORIGINAL)
    assert.equal(resolveLightboxImageSrc(legada), ORIGINAL)
  })

  it("o pior caso é o comportamento anterior à otimização — pesado, nunca quebrado", () => {
    const legada = urls({ thumbnailUrl: null, displayUrl: null })
    assert.equal(typeof resolveTimelineImageSrc(legada), "string")
    assert.ok(resolveTimelineImageSrc(legada).length > 0)
  })
})

describe("a original nunca é servida quando existe alternativa", () => {
  it("com as três URLs presentes, nenhuma superfície pede a original", () => {
    // Item 7 da missão: a original é preservação, não delivery.
    const completa = urls()
    assert.notEqual(resolveTimelineImageSrc(completa), ORIGINAL)
    assert.notEqual(resolveLightboxImageSrc(completa), ORIGINAL)
  })

  it("grade e lightbox pedem coisas DIFERENTES", () => {
    assert.notEqual(resolveTimelineImageSrc(urls()), resolveLightboxImageSrc(urls()))
  })
})

describe("nenhuma das funções constrói URL — só escolhe entre as recebidas", () => {
  it("a saída é sempre uma das entradas, verbatim", () => {
    const u = urls()
    assert.ok([ORIGINAL, MINIATURA, DISPLAY].includes(resolveTimelineImageSrc(u)))
    assert.ok([ORIGINAL, MINIATURA, DISPLAY].includes(resolveLightboxImageSrc(u)))
  })

  it("não há concatenação de path nem montagem de query no domínio", () => {
    // Montar URL aqui reabriria a porta para apontar a um objeto arbitrário.
    const fonte = resolveTimelineImageSrc.toString() + resolveLightboxImageSrc.toString()
    assert.ok(!fonte.includes("http"))
    assert.ok(!fonte.includes("supabase"))
    assert.ok(!fonte.includes("/storage/"))
  })
})
