/**
 * Documentos legais — estrutura e trava de publicação.
 *
 * O teste central é o de que NENHUM documento com seção pendente pode ser
 * tratado como vigente. Um termo de uso com aparência de definitivo e conteúdo
 * inventado é pior que um 404: o 404 não engana ninguém.
 *
 * Rodar: npm run test:legal
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  documentoVigente,
  LEGAL_DOCUMENTS,
  LEGAL_LINK_LABELS,
  legalHref,
  POLITICA_DE_PRIVACIDADE,
  TERMOS_DE_USO,
} from "./legal-documents.ts"

describe("trava de publicação", () => {
  it("documento com qualquer seção pendente NÃO é vigente", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      assert.equal(documentoVigente(doc), false, `${doc.slug} se declara vigente`)
    }
  })

  it("um documento sem pendências seria vigente", () => {
    // Trava do próprio teste: garante que `documentoVigente` não está
    // simplesmente retornando `false` sempre.
    assert.equal(documentoVigente({ ...TERMOS_DE_USO, secoes: [] }), true)
  })
})

describe("estrutura", () => {
  it("as âncoras são únicas dentro de cada documento", () => {
    // Âncoras duplicadas quebrariam o sumário em silêncio: o link levaria
    // sempre à primeira ocorrência.
    for (const doc of LEGAL_DOCUMENTS) {
      const ids = doc.secoes.map((s) => s.id)
      assert.equal(new Set(ids).size, ids.length, `${doc.slug} tem âncora repetida`)
    }
  })

  it("âncoras são slugs estáveis, seguros para URL", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      for (const s of doc.secoes) {
        assert.match(s.id, /^[a-z0-9-]+$/, `${doc.slug}#${s.id}`)
      }
    }
  })

  it("toda seção tem título não vazio", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      for (const s of doc.secoes) {
        assert.ok(s.titulo.trim().length > 0, `${doc.slug}#${s.id} sem título`)
      }
    }
  })

  it("privacidade cobre a pauta mínima de LGPD", () => {
    // Não é declaração de conformidade — é garantia de que a PAUTA para o
    // jurídico não perdeu um tema estruturante num refactor.
    const ids = POLITICA_DE_PRIVACIDADE.secoes.map((s) => s.id)
    for (const obrigatorio of [
      "controlador",
      "dados-coletados",
      "finalidades",
      "base-legal",
      "compartilhamento",
      "direitos",
      "encarregado",
    ]) {
      assert.ok(ids.includes(obrigatorio), `pauta perdeu: ${obrigatorio}`)
    }
  })

  it("termos cobre a pauta mínima do produto real", () => {
    // Mesma trava da privacidade, para os temas específicos do PRODUTO — não
    // de um marketplace genérico. "care-timeline" e "trust" existem porque a
    // auditoria BRAND/DOMAIN/LEGAL encontrou os dois ausentes: o esqueleto
    // cobria pagamento e avaliação, mas nada nomeava o Diário de cuidado nem
    // o Índice de Confiança — os dois elementos que mais diferenciam a
    // Peteen de um marketplace comum, e por isso os que mais precisam de
    // cláusula própria.
    const ids = TERMOS_DE_USO.secoes.map((s) => s.id)
    for (const obrigatorio of [
      "papel-da-peteen",
      "obrigacoes-tutor",
      "obrigacoes-profissional",
      "agendamento",
      "care-timeline",
      "avaliacoes",
      "trust",
      "conduta",
      "responsabilidade",
      "suspensao",
      "contato",
    ]) {
      assert.ok(ids.includes(obrigatorio), `pauta perdeu: ${obrigatorio}`)
    }
  })
})

describe("links", () => {
  it("legalHref produz rota interna absoluta", () => {
    assert.equal(legalHref("termos"), "/termos")
    assert.equal(legalHref("privacidade"), "/privacidade")
  })

  it("todo documento tem rótulo de link", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      assert.ok(LEGAL_LINK_LABELS[doc.slug]?.length > 0, doc.slug)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TRAVAS ESTRUTURAIS
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

/**
 * Remove comentários antes de inspecionar o código.
 *
 * Sem isto, o teste casaria com a própria DOCUMENTAÇÃO da regra: o cabeçalho
 * do domínio legal cita "lorem ipsum" justamente para explicar que nada ali
 * pode ser um. Um teste que quebra porque alguém documentou bem é um teste
 * ruim — mesmo padrão já usado em contextual-push-invite.test.ts.
 */
const lerCodigo = (rel: string) =>
  ler(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")

describe("nenhum link legal aponta para string solta", () => {
  it("login e Minha Conta derivam a rota de legalHref", () => {
    // Estes dois links apontavam para 404 — no ponto exato em que a pessoa
    // declara concordar com eles. Derivar do módulo faz um rename futuro
    // quebrar o build em vez de quebrar na cara do usuário.
    for (const arquivo of [
      "modules/identity/components/login-form.tsx",
      "components/account/account-settings-page.tsx",
      "app/(marketing)/page.tsx",
    ]) {
      const fonte = lerCodigo(arquivo)
      assert.ok(fonte.includes("legalHref("), `${arquivo} não usa legalHref`)
      assert.ok(
        !/href="\/termos"|href="\/privacidade"/.test(fonte),
        `${arquivo} ainda tem rota legal hardcoded`
      )
    }
  })
})

describe("nenhum texto jurídico foi inventado", () => {
  it("o domínio legal não contém corpo de documento", () => {
    // Se alguém acrescentar um campo de conteúdo aqui sem passar pela revisão
    // jurídica, este teste é o que segura.
    const fonte = lerCodigo("modules/legal/domain/legal-documents.ts")
    for (const proibido of ["lorem", "Lorem", "conteudo:", "corpo:", "texto:"]) {
      assert.ok(!fonte.includes(proibido), `apareceu conteúdo inventado: ${proibido}`)
    }
  })

  it("a página declara a pendência de forma visível", () => {
    const fonte = ler("modules/legal/components/legal-document-page.tsx")
    assert.ok(fonte.includes("Documento em elaboração"))
    assert.ok(fonte.includes("Conteúdo em elaboração"))
  })
})
