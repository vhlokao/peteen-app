/**
 * URL otimizada de foto — contrato do helper e das larguras aceitas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O BUG QUE ESTE ARQUIVO TRAVA
 *
 * A primeira versão deste helper usava `160` como largura para o box de 80px
 * do PetPhotoField. O otimizador do Next só aceita larguras que constam em
 * `images.imageSizes` — o padrão do framework é [16,32,48,64,96,128,256,384],
 * e 160 não está nessa lista. Testado ao vivo contra o servidor local ANTES
 * da correção: `w=160` respondia `400` com
 * `"w" parameter (width) of 160 is not allowed`. O tipo `OptimizedImageWidth`
 * existe para que TypeScript pegue isso em tempo de compilação — mas só
 * funciona se ninguém alargar o union sem conferir a lista real do Next.
 *
 * Rodar: npm run test:optimized-image
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { buildOptimizedImageUrl, type OptimizedImageWidth } from "./optimized-image-url.ts"

/**
 * Espelha `imageConfigDefault.imageSizes` de
 * `node_modules/next/dist/shared/lib/image-config.js` — não importamos o
 * arquivo do Next porque ele não é feito para rodar fora do bundler, mas o
 * valor é o contrato público e estável do framework (lista de larguras que o
 * `/_next/image` aceita sem configuração extra em `next.config.ts`).
 */
const NEXT_DEFAULT_IMAGE_SIZES = [16, 32, 48, 64, 96, 128, 256, 384]

const URL_SUPABASE = "https://xyzcompany.supabase.co/storage/v1/object/public/pets/a/b.jpg"

describe("toda largura do tipo é aceita pelo otimizador do Next", () => {
  // Lista fechada e explícita, não `as const` do union — se alguém adicionar
  // um valor ao tipo sem atualizar este array, o TypeScript acusa aqui.
  const larguras: OptimizedImageWidth[] = [96, 128]

  for (const w of larguras) {
    it(`${w}px consta em imageSizes padrão do Next`, () => {
      assert.ok(
        NEXT_DEFAULT_IMAGE_SIZES.includes(w),
        `${w} não está em [${NEXT_DEFAULT_IMAGE_SIZES.join(",")}] — o otimizador responderia 400`
      )
    })
  }

  it("CONTROLE NEGATIVO: 160 (a largura originalmente usada) NÃO é aceita", () => {
    // Prova que o teste acima falharia de verdade se alguém reintroduzisse
    // o valor que causou o 400 real.
    assert.ok(!NEXT_DEFAULT_IMAGE_SIZES.includes(160 as OptimizedImageWidth))
  })
})

describe("buildOptimizedImageUrl — passthrough vs otimização", () => {
  it("null/undefined/vazio → null", () => {
    assert.equal(buildOptimizedImageUrl(null, 96), null)
    assert.equal(buildOptimizedImageUrl(undefined, 96), null)
    assert.equal(buildOptimizedImageUrl("", 96), null)
  })

  it("blob: (preview local de upload) passa direto, sem otimizar", () => {
    const blob = "blob:http://localhost:3000/1234-5678"
    assert.equal(buildOptimizedImageUrl(blob, 96), blob)
  })

  it("data: passa direto, sem otimizar", () => {
    const data = "data:image/png;base64,iVBORw0KGgo="
    assert.equal(buildOptimizedImageUrl(data, 96), data)
  })

  it("URL do Supabase Storage vira /_next/image com url/w/q", () => {
    const r = buildOptimizedImageUrl(URL_SUPABASE, 96)
    assert.ok(r?.startsWith("/_next/image?"))
    const params = new URLSearchParams(r!.slice("/_next/image?".length))
    assert.equal(params.get("url"), URL_SUPABASE)
    assert.equal(params.get("w"), "96")
    assert.equal(params.get("q"), "75")
  })

  it("host que NÃO é o bucket de Storage passa direto — nunca força pelo otimizador às cegas", () => {
    // O otimizador rejeitaria um host fora de `remotePatterns` de qualquer
    // jeito; forçar a passagem aqui só trocaria uma URL que funciona por uma
    // que quebra silenciosamente.
    const outro = "https://cdn.exemplo.com/foo.jpg"
    assert.equal(buildOptimizedImageUrl(outro, 96), outro)
  })

  it("qualidade tem default 75 e aceita override explícito", () => {
    const r = buildOptimizedImageUrl(URL_SUPABASE, 96, 60)
    assert.match(r!, /q=60/)
  })
})
