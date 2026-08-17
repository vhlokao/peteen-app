/**
 * Care Timeline — "Agora" como padrão, horário manual e proteção de rascunho.
 *
 * Inclui a REGRESSÃO ESTRUTURAL do incidente físico em que a foto nunca
 * publicava (ver o bloco final). Aquele bug não era de lógica pura — era de
 * ordem entre `setState` e uma ref lida no mesmo tick — então a trava aqui é
 * sobre o código do componente, não sobre uma simulação que poderia divergir
 * dele.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import {
  OCCURRED_AT_COPY,
  formularioTemTrabalhoEmAndamento,
  resolverOccurredAtParaEnvio,
  valorInicialDoControleManual,
} from "./care-update-timing.ts"

const AGORA = new Date("2026-08-17T22:27:31.482Z")

// ─────────────────────────────────────────────────────────────────────────────
// Modo "agora" — o caminho padrão
// ─────────────────────────────────────────────────────────────────────────────

describe("modo agora — nenhum controle, instante do envio", () => {
  it("usa exatamente o instante recebido", () => {
    const r = resolverOccurredAtParaEnvio({ modo: "agora", valorLocal: "", agora: AGORA })
    assert.equal(r.ok, true)
    assert.equal(r.ok === true && r.iso, AGORA.toISOString())
  })

  it("ignora qualquer valor manual remanescente", () => {
    // Alternar para manual e voltar não pode deixar um horário fantasma
    // decidindo a publicação.
    const r = resolverOccurredAtParaEnvio({
      modo: "agora",
      valorLocal: "2020-01-01T03:00",
      agora: AGORA,
    })
    assert.equal(r.ok === true && r.iso, AGORA.toISOString())
  })

  it("é resolvido no ENVIO, não na abertura do formulário", () => {
    // O formulário fica aberto enquanto a pessoa escreve. Congelar o instante
    // na abertura publicaria um occurredAt sistematicamente atrasado.
    const abertura = new Date("2026-08-17T22:20:00.000Z")
    const envio = new Date("2026-08-17T22:27:31.482Z")
    const naAbertura = resolverOccurredAtParaEnvio({ modo: "agora", valorLocal: "", agora: abertura })
    const noEnvio = resolverOccurredAtParaEnvio({ modo: "agora", valorLocal: "", agora: envio })
    assert.notEqual(
      naAbertura.ok === true && naAbertura.iso,
      noEnvio.ok === true && noEnvio.iso
    )
    assert.equal(noEnvio.ok === true && noEnvio.iso, envio.toISOString())
  })

  it("não depende do fuso do processo", () => {
    // A função não lê Date.now() nem constrói Date a partir de componentes
    // locais no caminho "agora" — só serializa o instante recebido.
    const fonte = resolverOccurredAtParaEnvio.toString()
    assert.ok(!fonte.includes("Date.now()"))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Modo manual — registro atrasado
// ─────────────────────────────────────────────────────────────────────────────

describe("modo manual — o profissional informa quando aconteceu", () => {
  it("converte horário civil do piloto (UTC-3) para o instante correto", () => {
    // 14:20 em America/Sao_Paulo = 17:20Z
    const r = resolverOccurredAtParaEnvio({
      modo: "manual",
      valorLocal: "2026-08-17T14:20",
      agora: AGORA,
    })
    assert.equal(r.ok, true)
    assert.equal(r.ok === true && r.iso, "2026-08-17T17:20:00.000Z")
  })

  it("usa o helper canônico de fuso — resultado independe da máquina", () => {
    // Duas chamadas idênticas, e o valor esperado é fixo: se a conversão
    // dependesse do fuso do processo, este teste falharia fora do Brasil.
    const a = resolverOccurredAtParaEnvio({ modo: "manual", valorLocal: "2026-08-17T09:05", agora: AGORA })
    const b = resolverOccurredAtParaEnvio({ modo: "manual", valorLocal: "2026-08-17T09:05", agora: AGORA })
    assert.equal(a.ok === true && a.iso, "2026-08-17T12:05:00.000Z")
    assert.equal(a.ok === true && a.iso, b.ok === true && b.iso)
  })

  it("aceita fuso explícito diferente do piloto", () => {
    const r = resolverOccurredAtParaEnvio({
      modo: "manual",
      valorLocal: "2026-08-17T14:20",
      agora: AGORA,
      timeZone: "UTC",
    })
    assert.equal(r.ok === true && r.iso, "2026-08-17T14:20:00.000Z")
  })

  it("valor vazio é recusado com mensagem humana", () => {
    const r = resolverOccurredAtParaEnvio({ modo: "manual", valorLocal: "", agora: AGORA })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.mensagem, OCCURRED_AT_COPY.valorInvalido)
  })

  it("formato inválido é recusado, nunca vira NaN silencioso", () => {
    // `new Date("17/08/2026")` produziria Invalid Date e um .toISOString() que
    // lança — o formulário mostraria um erro técnico em vez de uma frase.
    for (const valor of ["17/08/2026 14:20", "2026-08-17", "abc", "2026-13-45T99:99"]) {
      const r = resolverOccurredAtParaEnvio({ modo: "manual", valorLocal: valor, agora: AGORA })
      assert.equal(r.ok, false, valor)
    }
  })

  it("tolera espaços em volta do valor", () => {
    const r = resolverOccurredAtParaEnvio({
      modo: "manual",
      valorLocal: "  2026-08-17T14:20  ",
      agora: AGORA,
    })
    assert.equal(r.ok, true)
  })
})

describe("valor inicial do controle manual", () => {
  it("tem o formato aceito por datetime-local", () => {
    assert.match(valorInicialDoControleManual(AGORA), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it("parte do instante corrente — ajustar minutos não exige redigitar a data", () => {
    const valor = valorInicialDoControleManual(AGORA)
    assert.equal(valor.slice(0, 4), String(AGORA.getFullYear()))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dirty state — o que suspende o auto-sync
// ─────────────────────────────────────────────────────────────────────────────

describe("trabalho em andamento — suspende o auto-sync do Diário", () => {
  const base = { conteudo: "", fotosSelecionadas: 0, modo: "agora" as const, publicando: false }

  it("formulário limpo NÃO suspende — a tela pode atualizar à vontade", () => {
    assert.equal(formularioTemTrabalhoEmAndamento(base), false)
  })

  it("texto digitado suspende", () => {
    assert.equal(formularioTemTrabalhoEmAndamento({ ...base, conteudo: "Rex almoçou" }), true)
  })

  it("só espaços em branco NÃO conta como trabalho", () => {
    assert.equal(formularioTemTrabalhoEmAndamento({ ...base, conteudo: "   \n  " }), false)
  })

  it("foto selecionada suspende — mesmo sem texto", () => {
    // Perder a seleção de fotos por um refresh é o pior caso: o upload já
    // aconteceu e a pessoa não tem como saber que precisa reselecionar.
    assert.equal(formularioTemTrabalhoEmAndamento({ ...base, fotosSelecionadas: 1 }), true)
  })

  it("horário manual ativado suspende", () => {
    assert.equal(formularioTemTrabalhoEmAndamento({ ...base, modo: "manual" }), true)
  })

  it("publicação em voo suspende", () => {
    assert.equal(formularioTemTrabalhoEmAndamento({ ...base, publicando: true }), true)
  })

  it("qualquer combinação com trabalho presente suspende", () => {
    assert.equal(
      formularioTemTrabalhoEmAndamento({
        conteudo: "texto", fotosSelecionadas: 3, modo: "manual", publicando: true,
      }),
      true
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regressão estrutural — a foto que nunca publicava
// ─────────────────────────────────────────────────────────────────────────────

const PICKER = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../components/CarePhotoPicker.tsx"),
  "utf8"
)

/** Remove comentários: um exemplo em comentário não pode reprovar o teste. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("CarePhotoPicker — a seleção não pode ser descartada pelo próprio upload", () => {
  const codigo = semComentarios(PICKER)

  it("existe UM caminho de mutação que atualiza a ref antes do onChange", () => {
    // O bug: `itensRef.current` só era reatribuído no render, mas `enviarFoto`
    // lia a ref no MESMO tick da seleção — antes do render — e reconstruía a
    // lista sem as fotos recém-adicionadas. React agrupava os dois setState e
    // o último (com a lista antiga) vencia.
    assert.match(codigo, /const aplicar = useCallback\(/)
    assert.match(codigo, /itensRef\.current = proximos\s*\n\s*onChange\(proximos\)/)
  })

  it("`marcar` usa `aplicar`, nunca `onChange` direto", () => {
    const marcar = /const marcar = \(patch: Partial<PhotoUiItem>\) => \{([\s\S]*?)\n {6}\}/.exec(codigo)
    assert.ok(marcar, "bloco `marcar` não encontrado")
    assert.match(marcar[1]!, /aplicar\(/)
    assert.doesNotMatch(marcar[1]!, /onChange\(/)
  })

  it("a seleção e a remoção também passam por `aplicar`", () => {
    assert.match(codigo, /aplicar\(\[\.\.\.itens, \.\.\.novos\]\)/)
    assert.match(codigo, /aplicar\(itens\.filter\(/)
  })

  it("o único `onChange(` fora de `aplicar` é a declaração do prop", () => {
    const chamadas = codigo.match(/onChange\(/g) ?? []
    // 1 dentro de `aplicar` + 0 em qualquer outro lugar. A assinatura do prop
    // (`onChange: (itens: ...) => void`) não casa com `onChange(`.
    assert.equal(chamadas.length, 1)
  })
})
