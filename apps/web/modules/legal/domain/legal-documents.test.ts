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
  TERMOS_VIGENTE,
} from "./legal-documents.ts"

describe("trava de publicação", () => {
  it("termos ainda tem seção pendente e por isso NÃO é vigente", () => {
    // Termos de Uso continua sem texto jurídico real — ver missão de
    // privacidade (PHASE legal), que só entregou o corpo da Política.
    assert.equal(documentoVigente(TERMOS_DE_USO), false, "termos se declara vigente")
  })

  it("toda seção de termos permanece pendente — nenhum conteúdo foi inventado", () => {
    for (const s of TERMOS_DE_USO.secoes) {
      assert.equal(s.pendente, true, `termos#${s.id} deixou de ser pendente sem revisão jurídica`)
    }
  })

  it("privacidade tem corpo real em toda seção e por isso É vigente", () => {
    // Conteúdo publicado após auditoria factual do comportamento real do
    // Peteen — ver docs da missão PRIVACY AUDIT / IMPLEMENTATION.
    assert.equal(documentoVigente(POLITICA_DE_PRIVACIDADE), true, "privacidade não é vigente")
    for (const s of POLITICA_DE_PRIVACIDADE.secoes) {
      assert.equal(s.pendente, false, `privacidade#${s.id} ainda está pendente`)
    }
  })

  it("um documento sem pendências seria vigente", () => {
    // Trava do próprio teste: garante que `documentoVigente` não está
    // simplesmente retornando `false` sempre.
    assert.equal(documentoVigente({ ...TERMOS_DE_USO, secoes: [] }), true)
  })

  it("TERMOS_VIGENTE reflete o estado atual de TERMOS_DE_USO (SA-002)", () => {
    // Constante exportada para superfícies como o login declararem aceite
    // só quando há texto de verdade por trás. Se algum dia isto divergir de
    // documentoVigente(TERMOS_DE_USO), a constante ficou obsoleta/hardcoded.
    assert.equal(TERMOS_VIGENTE, documentoVigente(TERMOS_DE_USO))
    assert.equal(TERMOS_VIGENTE, false, "termos ainda pendente — a constante deveria ser false hoje")
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

describe("SA-002 — login não declara aceite de Termos inexistentes", () => {
  it("login-form usa TERMOS_VIGENTE para decidir se menciona os Termos de Uso", () => {
    const fonte = lerCodigo("modules/identity/components/login-form.tsx")
    assert.ok(
      fonte.includes("TERMOS_VIGENTE"),
      "login-form não consulta TERMOS_VIGENTE — pode voltar a declarar aceite hardcoded"
    )
  })

  it("enquanto TERMOS_VIGENTE for false, a frase de consentimento não menciona 'termos de uso'", () => {
    // Não inspeciona só a presença da constante: prova que o RAMO que o
    // usuário efetivamente vê hoje (TERMOS_VIGENTE === false) não contém a
    // frase problemática. Se alguém reordenar o condicional (ramo `true`
    // primeiro) ou remover o `else`, este teste falha.
    assert.equal(TERMOS_VIGENTE, false, "pré-condição do teste: termos deveria seguir pendente")

    const fonte = lerCodigo("modules/identity/components/login-form.tsx")
    const match = fonte.match(/\{TERMOS_VIGENTE \? \(([\s\S]*?)\) : \(([\s\S]*?)\)\}/)
    assert.ok(match, "condicional TERMOS_VIGENTE não encontrado na forma esperada")
    const ramoVigente = match?.[1] ?? ""
    const ramoPendente = match?.[2] ?? ""

    // Ramo vigente é o texto ANTIGO (preservado para quando os Termos forem
    // publicados) — ele DEVE mencionar termos de uso; não é o que reprova.
    assert.ok(ramoVigente.includes("termos de uso"))

    // Ramo pendente (o que renderiza HOJE) não pode afirmar concordância com
    // Termos de Uso, mas segue mencionando a Privacidade, que é real.
    // `[\s\S]` no lugar do flag `s` (dotAll indisponível no target ES2017 do projeto).
    assert.ok(
      !/concorda com os[\s\S]*termos de uso/i.test(ramoPendente),
      "ramo pendente ainda declara aceite de termos de uso"
    )
    assert.ok(ramoPendente.includes("privacidade"), "ramo pendente parou de mencionar privacidade")
  })
})

describe("nenhum texto jurídico foi inventado além do que foi revisado", () => {
  it("o domínio legal não contém lorem ipsum em lugar nenhum", () => {
    const fonte = lerCodigo("modules/legal/domain/legal-documents.ts")
    for (const proibido of ["lorem", "Lorem"]) {
      assert.ok(!fonte.includes(proibido), `apareceu conteúdo de rascunho: ${proibido}`)
    }
  })

  it("a página ainda sabe declarar a pendência de forma visível (usada por termos)", () => {
    const fonte = ler("modules/legal/components/legal-document-page.tsx")
    assert.ok(fonte.includes("Documento em elaboração"))
    assert.ok(fonte.includes("Conteúdo em elaboração"))
  })
})
