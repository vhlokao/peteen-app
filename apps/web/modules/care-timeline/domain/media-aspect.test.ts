/**
 * Orientação e proporção portrait-first (V0.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CASO QUE ORIGINOU TUDO
 *
 * Os vídeos reais do QA são 1080x1920. A V0.1 fixava 16/9 no card fechado, e o
 * tutor via um card deitado que, ao tocar, virava um vídeo em pé — parecia
 * outro objeto. Estes testes fixam que a forma fechada segue a orientação real
 * e que a ausência de metadata cai em vertical, nunca de volta ao horizontal.
 *
 * As dimensões vêm do CLIENTE. Isso é aceitável porque só afetam layout — mas
 * a sanidade precisa ser rigorosa, e é a maior parte dos casos aqui.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  DIMENSAO_MAXIMA,
  PROPORCAO_FECHADA_HORIZONTAL,
  PROPORCAO_FECHADA_QUADRADA,
  PROPORCAO_FECHADA_VERTICAL,
  dimensaoUtilizavel,
  normalizarDimensoes,
  orientacaoDeMidia,
  proporcaoAberta,
  proporcaoFechada,
} from "./media-aspect.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Orientação — os três casos reais
// ─────────────────────────────────────────────────────────────────────────────

describe("orientacaoDeMidia", () => {
  it("1080x1920 é VERTICAL — o formato real dos vídeos do QA físico", () => {
    assert.equal(orientacaoDeMidia(1080, 1920), "VERTICAL")
  })

  it("1920x1080 é HORIZONTAL", () => {
    assert.equal(orientacaoDeMidia(1920, 1080), "HORIZONTAL")
  })

  it("1080x1080 é QUADRADA", () => {
    assert.equal(orientacaoDeMidia(1080, 1080), "QUADRADA")
  })

  it("sem dimensões é null — desconhecido, não um palpite", () => {
    assert.equal(orientacaoDeMidia(null, null), null)
    assert.equal(orientacaoDeMidia(undefined, undefined), null)
    assert.equal(orientacaoDeMidia(1080, null), null)
    assert.equal(orientacaoDeMidia(null, 1920), null)
  })

  it("dimensão implausível não vira orientação", () => {
    assert.equal(orientacaoDeMidia(0, 1920), null)
    assert.equal(orientacaoDeMidia(-1080, 1920), null)
    assert.equal(orientacaoDeMidia(1080.5, 1920), null)
    assert.equal(orientacaoDeMidia(DIMENSAO_MAXIMA + 1, 1920), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sanidade — a fronteira do que o cliente informa
// ─────────────────────────────────────────────────────────────────────────────

describe("dimensaoUtilizavel", () => {
  it("aceita inteiro positivo dentro do teto", () => {
    assert.equal(dimensaoUtilizavel(1), true)
    assert.equal(dimensaoUtilizavel(1080), true)
    assert.equal(dimensaoUtilizavel(DIMENSAO_MAXIMA), true)
  })

  it("recusa zero e negativo", () => {
    assert.equal(dimensaoUtilizavel(0), false)
    assert.equal(dimensaoUtilizavel(-1), false)
    assert.equal(dimensaoUtilizavel(-1080), false)
  })

  it("recusa acima do teto", () => {
    assert.equal(dimensaoUtilizavel(DIMENSAO_MAXIMA + 1), false)
    assert.equal(dimensaoUtilizavel(999_999), false)
  })

  it("recusa decimal", () => {
    assert.equal(dimensaoUtilizavel(1080.5), false)
    assert.equal(dimensaoUtilizavel(0.5), false)
  })

  it("recusa não-número, NaN e Infinity", () => {
    assert.equal(dimensaoUtilizavel("1080"), false)
    assert.equal(dimensaoUtilizavel(null), false)
    assert.equal(dimensaoUtilizavel(undefined), false)
    assert.equal(dimensaoUtilizavel(NaN), false)
    assert.equal(dimensaoUtilizavel(Infinity), false)
    assert.equal(dimensaoUtilizavel({}), false)
    assert.equal(dimensaoUtilizavel([1080]), false)
  })

  it("o teto cobre 8K com folga e ainda barra absurdo", () => {
    assert.equal(dimensaoUtilizavel(7680), true, "8K precisa passar")
    assert.equal(dimensaoUtilizavel(100_000), false)
  })
})

describe("normalizarDimensoes", () => {
  it("par válido passa intacto", () => {
    assert.deepEqual(normalizarDimensoes(1080, 1920), {
      displayWidth: 1080,
      displayHeight: 1920,
    })
  })

  it("é TUDO-OU-NADA: uma dimensão ruim zera as duas", () => {
    // Guardar metade do par não descreve proporção nenhuma e convidaria um
    // cálculo com undefined mais adiante.
    assert.equal(normalizarDimensoes(1080, 0), null)
    assert.equal(normalizarDimensoes(0, 1920), null)
    assert.equal(normalizarDimensoes(1080, -1), null)
    assert.equal(normalizarDimensoes(1080.5, 1920), null)
    assert.equal(normalizarDimensoes(1080, DIMENSAO_MAXIMA + 1), null)
  })

  it("ausência total vira null, sem lançar", () => {
    assert.equal(normalizarDimensoes(undefined, undefined), null)
    assert.equal(normalizarDimensoes(null, null), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Card fechado — portrait-first
// ─────────────────────────────────────────────────────────────────────────────

describe("proporcaoFechada", () => {
  it("vertical fecha em 4:5, não na proporção real", () => {
    // 9:16 real numa coluna de 390px daria ~636px de altura: quase a tela
    // inteira para um vídeo que ninguém abriu.
    assert.equal(proporcaoFechada(1080, 1920), PROPORCAO_FECHADA_VERTICAL)
    assert.equal(PROPORCAO_FECHADA_VERTICAL, 4 / 5)
  })

  it("horizontal fecha em 16:9", () => {
    assert.equal(proporcaoFechada(1920, 1080), PROPORCAO_FECHADA_HORIZONTAL)
    assert.equal(PROPORCAO_FECHADA_HORIZONTAL, 16 / 9)
  })

  it("quadrado fecha em 1:1", () => {
    assert.equal(proporcaoFechada(1080, 1080), PROPORCAO_FECHADA_QUADRADA)
    assert.equal(PROPORCAO_FECHADA_QUADRADA, 1)
  })

  it("SEM METADATA cai em vertical — nunca de volta ao 16:9", () => {
    // Voltar ao horizontal por omissão reproduziria o problema que a V0.2
    // corrige. As duas mídias legadas deste piloto são 9:16, então o palpite
    // vertical é também o correto para elas.
    assert.equal(proporcaoFechada(null, null), PROPORCAO_FECHADA_VERTICAL)
    assert.equal(proporcaoFechada(undefined, undefined), PROPORCAO_FECHADA_VERTICAL)
    assert.notEqual(proporcaoFechada(null, null), PROPORCAO_FECHADA_HORIZONTAL)
  })

  it("dimensão implausível também cai no fallback vertical", () => {
    assert.equal(proporcaoFechada(0, 0), PROPORCAO_FECHADA_VERTICAL)
    assert.equal(proporcaoFechada(-1, -1), PROPORCAO_FECHADA_VERTICAL)
    assert.equal(proporcaoFechada(99_999, 99_999), PROPORCAO_FECHADA_VERTICAL)
  })

  it("nunca devolve valor inválido para CSS", () => {
    const entradas: Array<[unknown, unknown]> = [
      [1080, 1920], [1920, 1080], [1080, 1080],
      [null, null], [0, 0], [NaN, NaN], ["a", "b"], [Infinity, 1],
    ]
    for (const [w, h] of entradas) {
      const r = proporcaoFechada(w as number, h as number)
      assert.ok(Number.isFinite(r) && r > 0, `proporção inválida para ${String(w)}x${String(h)}: ${r}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Player aberto — proporção real
// ─────────────────────────────────────────────────────────────────────────────

describe("proporcaoAberta", () => {
  it("devolve a proporção real quando conhecida", () => {
    assert.equal(proporcaoAberta(1080, 1920), 1080 / 1920)
    assert.equal(proporcaoAberta(1920, 1080), 1920 / 1080)
    assert.equal(proporcaoAberta(1080, 1080), 1)
  })

  it("devolve null quando desconhecida — não inventa forma", () => {
    assert.equal(proporcaoAberta(null, null), null)
    assert.equal(proporcaoAberta(0, 1920), null)
    assert.equal(proporcaoAberta(1080.5, 1920), null)
  })

  it("abrir um vertical é EXPANSÃO, não rotação: 4:5 e 9:16 são ambos < 1", () => {
    // A garantia visual central da V0.2. Se o fechado fosse 16/9 (>1) e o
    // aberto 9/16 (<1), o objeto pareceria girar.
    const fechado = proporcaoFechada(1080, 1920)
    const aberto = proporcaoAberta(1080, 1920)!
    assert.ok(fechado < 1, "card fechado precisa ser vertical")
    assert.ok(aberto < 1, "player aberto precisa ser vertical")
    assert.ok(aberto < fechado, "abrir deve alongar, não achatar")
  })

  it("abrir um horizontal também mantém orientação", () => {
    const fechado = proporcaoFechada(1920, 1080)
    const aberto = proporcaoAberta(1920, 1080)!
    assert.ok(fechado > 1 && aberto > 1)
  })
})
