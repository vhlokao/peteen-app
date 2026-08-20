/**
 * Otimização de imagem da timeline — parâmetros e roteamento de URL.
 *
 * O que estes testes travam: a grade NUNCA pede a original quando existe
 * miniatura, o lightbox NUNCA pede a miniatura, e mídia sem miniatura continua
 * aparecendo (fallback) — que é o que dispensa backfill das fotos já
 * publicadas.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CARE_MEDIA_THUMBNAIL_PX,
  CARE_MEDIA_THUMBNAIL_QUALITY,
  careMediaThumbnailTransform,
  resolveLightboxImageSrc,
  resolveTimelineImageSrc,
} from "./care-media-transform.ts"

const ORIGINAL = "https://storage.example/original.jpg?token=abc"
const MINIATURA = "https://storage.example/original.jpg?token=abc&width=288"

// ─────────────────────────────────────────────────────────────────────────────
// Parâmetros da miniatura
// ─────────────────────────────────────────────────────────────────────────────

describe("transformação da miniatura", () => {
  it("288px cobre a grade de 96 CSS px em telas 3x", () => {
    // A grade é grid-cols-3: ~96px por foto num celular. 288 = 96 × 3.
    assert.equal(CARE_MEDIA_THUMBNAIL_PX, 288)
    assert.equal(CARE_MEDIA_THUMBNAIL_PX % 96, 0)
  })

  it("usa `cover` — o CSS da grade já recorta com object-cover", () => {
    // `contain` traria barras que o CSS descartaria de qualquer forma.
    assert.equal(careMediaThumbnailTransform().resize, "cover")
  })

  it("quadrada: largura e altura iguais", () => {
    const t = careMediaThumbnailTransform()
    assert.equal(t.width, t.height)
    assert.equal(t.width, CARE_MEDIA_THUMBNAIL_PX)
  })

  it("qualidade reduzida, mas não agressiva", () => {
    // Num quadrado de 96px, 75 é indistinguível de 100 a olho nu — e é onde a
    // economia mora. Abaixo de ~60 começa a aparecer artefato em pelo de
    // animal, que é justamente o que o Diário registra.
    assert.equal(CARE_MEDIA_THUMBNAIL_QUALITY, 75)
    assert.ok(CARE_MEDIA_THUMBNAIL_QUALITY >= 60 && CARE_MEDIA_THUMBNAIL_QUALITY <= 85)
  })

  it("devolve um objeto novo a cada chamada — nenhum chamador pode mutar o padrão", () => {
    const a = careMediaThumbnailTransform()
    const b = careMediaThumbnailTransform()
    assert.notEqual(a, b)
    assert.deepEqual(a, b)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Roteamento — quem usa o quê
// ─────────────────────────────────────────────────────────────────────────────

describe("grade da timeline — miniatura, com fallback para a original", () => {
  it("com miniatura disponível, usa a miniatura", () => {
    assert.equal(
      resolveTimelineImageSrc({ signedUrl: ORIGINAL, thumbnailUrl: MINIATURA }),
      MINIATURA
    )
  })

  it("sem miniatura (null), cai para a ORIGINAL — a foto nunca some", () => {
    // É o caminho de qualquer mídia já publicada e de qualquer falha na
    // assinatura da variante. O pior caso é o comportamento anterior à
    // otimização — pesado, não quebrado.
    assert.equal(
      resolveTimelineImageSrc({ signedUrl: ORIGINAL, thumbnailUrl: null }),
      ORIGINAL
    )
  })

  it("mídia legada continua funcionando sem nenhum backfill", () => {
    // Uma CareMedia publicada antes desta missão não tem nada gravado sobre
    // miniatura — e não precisa: a variante é derivada na leitura.
    const legada = { signedUrl: ORIGINAL, thumbnailUrl: null }
    assert.equal(resolveTimelineImageSrc(legada), ORIGINAL)
    assert.equal(resolveLightboxImageSrc(legada), ORIGINAL)
  })
})

describe("lightbox — SEMPRE a original", () => {
  it("ignora a miniatura mesmo quando ela existe", () => {
    // O lightbox é a visualização de evidência: pelo, olho, etiqueta, ambiente.
    assert.equal(
      resolveLightboxImageSrc({ signedUrl: ORIGINAL, thumbnailUrl: MINIATURA }),
      ORIGINAL
    )
  })

  it("nunca devolve a mesma fonte que a grade quando há miniatura", () => {
    // Trava de contrato: se alguém apontar o lightbox para a miniatura, a
    // evidência passa a ser servida recomprimida e este teste quebra.
    const urls = { signedUrl: ORIGINAL, thumbnailUrl: MINIATURA }
    assert.notEqual(resolveLightboxImageSrc(urls), resolveTimelineImageSrc(urls))
  })
})

describe("nenhuma das funções constrói URL — só escolhe entre as recebidas", () => {
  it("a saída é sempre uma das entradas, verbatim", () => {
    const urls = { signedUrl: ORIGINAL, thumbnailUrl: MINIATURA }
    assert.ok([ORIGINAL, MINIATURA].includes(resolveTimelineImageSrc(urls)))
    assert.ok([ORIGINAL, MINIATURA].includes(resolveLightboxImageSrc(urls)))
  })

  it("não há concatenação de path nem montagem de query no domínio", () => {
    // Montar URL aqui reabriria a porta para apontar a um objeto arbitrário —
    // o componente só recebe URLs já assinadas pelo servidor.
    const fonte = resolveTimelineImageSrc.toString() + resolveLightboxImageSrc.toString()
    assert.ok(!fonte.includes("http"))
    assert.ok(!fonte.includes("supabase"))
    assert.ok(!fonte.includes("/storage/"))
  })
})
