/**
 * Contrato de `mediaDimensions` — hint visual que NÃO pode virar autoridade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A PERGUNTA QUE ESTES TESTES RESPONDEM
 *
 * `mediaDimensions` é a primeira coisa que o cliente informa sobre a mídia e
 * que chega ao banco. Todo o resto — tipo, MIME, tamanho, posse — é derivado no
 * servidor. Então a pergunta certa não é "o valor está correto?", e sim: um
 * cliente hostil consegue usar este campo para alguma coisa além de estragar
 * o próprio layout?
 *
 * A resposta precisa ser não, e precisa ser verificável. Como o laço de
 * validação itera sobre `mediaPaths` — já validado por posse e magic bytes — e
 * apenas CONSULTA o mapa de dimensões, um path que exista só em
 * `mediaDimensions` nunca é alcançado. Estes testes fixam essa estrutura, mais
 * o schema de entrada e a sanidade dos valores.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { CreateCareUpdateSchema } from "./types.ts"
import { normalizarDimensoes } from "./media-aspect.ts"

const BASE = {
  requestId: "req_1",
  category: "NOTE" as const,
  content: "Relato suficientemente longo para passar na validação de conteúdo.",
  occurredAt: new Date().toISOString(),
  idempotencyKey: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema de entrada
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateCareUpdateSchema — mediaDimensions", () => {
  it("é OPCIONAL: cliente antigo publica sem o campo", () => {
    // Uma aba aberta durante o deploy precisa continuar publicando.
    const r = CreateCareUpdateSchema.safeParse({ ...BASE, mediaPaths: ["requests/req_1/a.mp4"] })
    assert.equal(r.success, true)
    if (r.success) assert.equal(r.data.mediaDimensions, undefined)
  })

  it("aceita um par válido", () => {
    const r = CreateCareUpdateSchema.safeParse({
      ...BASE,
      mediaPaths: ["requests/req_1/a.mp4"],
      mediaDimensions: [{ path: "requests/req_1/a.mp4", width: 1080, height: 1920 }],
    })
    assert.equal(r.success, true)
    if (r.success) assert.equal(r.data.mediaDimensions?.[0]?.width, 1080)
  })

  it("aceita valores implausíveis no SCHEMA — a sanidade é do domínio", () => {
    // De propósito: o schema não recusa a publicação por metadata visual ruim.
    // `normalizarDimensoes` transforma em null mais adiante.
    const r = CreateCareUpdateSchema.safeParse({
      ...BASE,
      mediaPaths: ["requests/req_1/a.mp4"],
      mediaDimensions: [{ path: "requests/req_1/a.mp4", width: -5, height: 0 }],
    })
    assert.equal(r.success, true, "metadata ruim não pode reprovar publicação válida")
  })

  it("recusa entrada malformada", () => {
    const semPath = CreateCareUpdateSchema.safeParse({
      ...BASE,
      mediaDimensions: [{ width: 1080, height: 1920 }],
    })
    assert.equal(semPath.success, false)

    const naoNumerico = CreateCareUpdateSchema.safeParse({
      ...BASE,
      mediaDimensions: [{ path: "a", width: "1080", height: 1920 }],
    })
    assert.equal(naoNumerico.success, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sanidade aplicada — o que efetivamente chega ao banco
// ─────────────────────────────────────────────────────────────────────────────

describe("sanidade aplicada às dimensões informadas", () => {
  const casos: Array<[string, unknown, unknown, boolean]> = [
    ["vertical real do QA", 1080, 1920, true],
    ["horizontal", 1920, 1080, true],
    ["quadrado", 1080, 1080, true],
    ["zero", 0, 1920, false],
    ["negativo", -1080, 1920, false],
    ["acima do teto", 10_001, 1920, false],
    ["decimal", 1080.5, 1920, false],
    ["NaN", NaN, 1920, false],
    ["Infinity", Infinity, 1920, false],
    ["string", "1080", 1920, false],
  ]

  for (const [nome, w, h, deveriaPassar] of casos) {
    it(`${nome} → ${deveriaPassar ? "persistido" : "NULL"}`, () => {
      const r = normalizarDimensoes(w, h)
      if (deveriaPassar) {
        assert.notEqual(r, null)
        assert.equal(r?.displayWidth, w)
        assert.equal(r?.displayHeight, h)
      } else {
        assert.equal(r, null, "dimensão implausível precisa virar NULL, não ser gravada")
      }
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Estrutura — dimensões não criam mídia
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../application/actions.ts"),
  "utf8"
)

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("validateMediaPaths — dimensões só são CONSULTADAS", () => {
  const codigo = semComentarios(ACTIONS)

  it("o laço de validação itera sobre paths, nunca sobre dimensões", () => {
    // Se um dia alguém iterar sobre `dimensions`, um path informado só ali
    // entraria no pipeline sem passar por posse nem magic bytes.
    assert.match(codigo, /for \(const path of paths\)/)
    assert.doesNotMatch(
      codigo,
      /for \(const \w+ of dimensions\b(?![\s\S]{0,80}dimensoesPorPath\.set)/,
      "dimensões não podem alimentar o laço de validação"
    )
  })

  it("as dimensões entram por lookup do path já validado", () => {
    assert.match(codigo, /dimensoesPorPath\.get\(path\)/)
  })

  it("só VIDEO recebe dimensões — PHOTO fica null", () => {
    assert.match(codigo, /veredito\.kind === "VIDEO" && hint/)
  })

  it("o valor passa pela sanidade do domínio antes de ser persistido", () => {
    assert.match(codigo, /normalizarDimensoes\(hint\.width,\s*hint\.height\)/)
  })

  it("dimensão ausente ou reprovada vira null, sem abortar a publicação", () => {
    assert.match(codigo, /displayWidth:\s*dims\?\.displayWidth \?\? null/)
    assert.match(codigo, /displayHeight:\s*dims\?\.displayHeight \?\? null/)
  })

  it("nenhum caminho recusa publicação por causa de dimensão", () => {
    // Uma checagem que devolvesse `ok: false` por metadata visual quebraria o
    // contrato: layout ruim nunca deve impedir o registro do atendimento.
    const trecho = codigo.slice(
      codigo.indexOf("async function validateMediaPaths"),
      codigo.indexOf("async function validateMediaPaths") + 6000
    )
    const recusas = trecho.match(/return \{ ok: false[^}]*\}/g) ?? []
    for (const r of recusas) {
      assert.doesNotMatch(r, /dimens|width|height/i, `recusa ligada a dimensão: ${r}`)
    }
  })
})
