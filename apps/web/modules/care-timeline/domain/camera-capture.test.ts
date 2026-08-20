/**
 * Regressão do incidente físico: um Android mostrou "Tirar foto agora", outro
 * não. A detecção antiga (`pointer: coarse`) descrevia o apontador PRIMÁRIO;
 * bastava uma caneta ativa, um mouse pareado ou o modo desktop para o botão
 * sumir num aparelho que tinha a tela de toque logo ali.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  MEDIA_QUERY_CAPTURA,
  deveOferecerCameraPrimeiro,
} from "./camera-capture.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Os aparelhos do incidente
// ─────────────────────────────────────────────────────────────────────────────

describe("os dois Androids do QA físico", () => {
  it("Android A — dedo é o apontador primário: oferece câmera", () => {
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: true, pontosDeToque: 5 }),
      true
    )
  })

  it("Android B — caneta/mouse vira o apontador primário: AINDA oferece câmera", () => {
    // Este é o caso que falhava. `pointer: coarse` seria false aqui; o que
    // salva é perguntar se ALGUM apontador é impreciso, e o `maxTouchPoints`
    // como segunda via.
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: true, pontosDeToque: 10 }),
      true
    )
  })

  it("qualquer um dos dois sinais basta — são caminhos de detecção independentes", () => {
    // Só a media query (navegador que não expõe maxTouchPoints):
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: true, pontosDeToque: 0 }),
      true
    )
    // Só a API de dispositivo (navegador que reporta a media query de forma
    // inesperada — a hipótese que não dá para descartar no Android B):
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: false, pontosDeToque: 1 }),
      true
    )
  })
})

describe("desktop sem toque — segue com um botão só", () => {
  it("nenhum apontador impreciso e zero pontos de toque: não oferece câmera", () => {
    // Medido no navegador real: desktop sem toque reporta any-pointer coarse
    // false e maxTouchPoints 0.
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: false, pontosDeToque: 0 }),
      false
    )
  })
})

describe("trade-off assumido: notebook com tela de toque", () => {
  it("recebe os dois botões — e isso é deliberado", () => {
    // Custo real: um botão redundante (o navegador ignora `capture` e abre o
    // mesmo seletor). O erro oposto — não oferecer câmera num celular real —
    // custa o fluxo principal do produto durante um atendimento, que foi
    // exatamente o que aconteceu. Preferimos errar para o lado que mantém o
    // caminho aberto.
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: true, pontosDeToque: 10 }),
      true
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Travas de contrato
// ─────────────────────────────────────────────────────────────────────────────

describe("a media query consultada não pode regredir", () => {
  it("é `any-pointer`, NUNCA `pointer`", () => {
    // Trocar por `(pointer: coarse)` reintroduz o bug do Android B em
    // silêncio — nenhum outro teste pegaria, porque a função continuaria pura
    // e correta para os sinais que recebesse.
    assert.equal(MEDIA_QUERY_CAPTURA, "(any-pointer: coarse)")
    assert.ok(MEDIA_QUERY_CAPTURA.includes("any-pointer"))
  })
})

describe("a decisão não usa user-agent nem tamanho de tela", () => {
  it("a função só olha os dois sinais recebidos", () => {
    const fonte = deveOferecerCameraPrimeiro.toString()
    assert.ok(!/userAgent|navigator\.platform|innerWidth|screen/.test(fonte))
  })

  it("viewport larga não desliga a câmera — celular em modo desktop continua celular", () => {
    // Nenhum parâmetro de largura existe na assinatura; este teste trava isso.
    assert.equal(deveOferecerCameraPrimeiro.length, 1)
  })
})

describe("robustez — nenhuma combinação lança", () => {
  it("varre os sinais possíveis, incluindo valores inesperados", () => {
    for (const impreciso of [true, false]) {
      for (const toques of [0, 1, 5, 10, -1]) {
        const r = deveOferecerCameraPrimeiro({
          algumApontadorImpreciso: impreciso,
          pontosDeToque: toques,
        })
        assert.equal(typeof r, "boolean", `${impreciso}/${toques}`)
      }
    }
  })

  it("maxTouchPoints negativo (valor absurdo) não liga a câmera sozinho", () => {
    assert.equal(
      deveOferecerCameraPrimeiro({ algumApontadorImpreciso: false, pontosDeToque: -1 }),
      false
    )
  })
})
