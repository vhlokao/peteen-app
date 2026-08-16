/**
 * R2B.4 — fallback de foto quebrada no Diário.
 *
 * Regressão do achado do gate independente: uma imagem que vem do SSR e falha
 * ANTES da hidratação dispara `error` sem ninguém ouvindo, e o placeholder
 * "Foto indisponível" não aparecia. A checagem no mount fecha essa janela.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { imagemChegouQuebrada, type EstadoDaImagem } from "./media-display.ts"

/** Como o navegador deixa o elemento em cada situação real. */
const CARREGOU_OK: EstadoDaImagem = { complete: true, naturalWidth: 1 }
const FALHOU: EstadoDaImagem = { complete: true, naturalWidth: 0 }
const AINDA_CARREGANDO: EstadoDaImagem = { complete: false, naturalWidth: 0 }

describe("caso 2 — imagem JÁ quebrada no mount (a janela pré-hidratação)", () => {
  it("complete + naturalWidth 0 → placeholder", () => {
    assert.equal(imagemChegouQuebrada(FALHOU), true)
  })

  it("é o cenário do SSR: o elemento veio no HTML e falhou antes do React", () => {
    // Sem esta checagem, `onError` nunca rodaria para este elemento e o
    // usuário via um quadro vazio em vez do placeholder.
    const vindaDoServidorEQuebrada = { complete: true, naturalWidth: 0 }
    assert.equal(imagemChegouQuebrada(vindaDoServidorEQuebrada), true)
  })
})

describe("caso 3 — imagem válida NÃO cai no placeholder", () => {
  it("complete + naturalWidth > 0 → renderiza normalmente", () => {
    assert.equal(imagemChegouQuebrada(CARREGOU_OK), false)
  })

  it("imagem grande também não é confundida com falha", () => {
    assert.equal(imagemChegouQuebrada({ complete: true, naturalWidth: 4032 }), false)
  })

  it("o teste de 1x1 usado nas fixtures de QA conta como válida", () => {
    assert.equal(imagemChegouQuebrada({ complete: true, naturalWidth: 1 }), false)
  })
})

describe("ainda carregando não é falha — quem decide depois é o onError", () => {
  it("complete false → não marca quebrada", () => {
    assert.equal(imagemChegouQuebrada(AINDA_CARREGANDO), false)
  })

  it("loading=lazy fora da viewport (complete false) não vira placeholder", () => {
    // Tratar isto como quebrado esconderia fotos boas antes de aparecerem.
    assert.equal(imagemChegouQuebrada({ complete: false, naturalWidth: 0 }), false)
  })

  it("complete false com largura já conhecida também não marca", () => {
    assert.equal(imagemChegouQuebrada({ complete: false, naturalWidth: 800 }), false)
  })
})

describe("caso 1 — erro DEPOIS da hidratação continua coberto pelo onError", () => {
  it("o estado pós-falha é o mesmo que esta função reconhece", () => {
    // Os dois caminhos convergem no mesmo placeholder: `onError` marca na
    // hora; esta função marca o que o `onError` não teve chance de ouvir.
    // Uma signedUrl expirada (403) deixa o elemento exatamente assim.
    const aposUrlExpirada: EstadoDaImagem = { complete: true, naturalWidth: 0 }
    assert.equal(imagemChegouQuebrada(aposUrlExpirada), true)
  })

  it("a função é idempotente — chamá-la de novo dá o mesmo resultado", () => {
    // O callback de ref roda a cada commit; o resultado não pode oscilar.
    assert.equal(imagemChegouQuebrada(FALHOU), imagemChegouQuebrada(FALHOU))
    assert.equal(imagemChegouQuebrada(CARREGOU_OK), imagemChegouQuebrada(CARREGOU_OK))
  })
})

describe("robustez — nenhuma combinação lança", () => {
  it("varre complete × naturalWidth e sempre devolve boolean", () => {
    for (const complete of [true, false]) {
      for (const naturalWidth of [0, 1, 1024]) {
        const r = imagemChegouQuebrada({ complete, naturalWidth })
        assert.equal(typeof r, "boolean", `complete=${complete} w=${naturalWidth}`)
      }
    }
  })

  it("só há UM caminho para true: terminou de carregar e não tem pixels", () => {
    const verdadeiros = [true, false].flatMap((complete) =>
      [0, 1, 1024].map((naturalWidth) => ({
        complete,
        naturalWidth,
        quebrada: imagemChegouQuebrada({ complete, naturalWidth }),
      }))
    ).filter((c) => c.quebrada)

    assert.deepEqual(verdadeiros, [{ complete: true, naturalWidth: 0, quebrada: true }])
  })
})
