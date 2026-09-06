/**
 * GATE-16-DEMO-ENV-FOUNDATION-003 — identidade de ambiente do Peteen.
 *
 * O achado que motiva este arquivo: um projeto Vercel dedicado ao DEMO, quando
 * publicado, também recebe `VERCEL_ENV=production`. Logo `VERCEL_ENV` sozinho
 * NÃO distingue o Peteen de produção do Peteen de demonstração — e tratar os
 * dois como iguais faria o sender do DEMO se considerar produção e ficar
 * elegível a entregar push em subscriptions de usuários reais.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  isPeteenEnvironment,
  isProducaoReal,
  PETEEN_ENVIRONMENTS,
  resolvePeteenEnvironment,
} from "./peteen-environment.ts"

/** Silencia o aviso nos casos em que ele é esperado. */
const mudo = () => {}

// ─────────────────────────────────────────────────────────────────────────────
// A matriz exigida pela missão
// ─────────────────────────────────────────────────────────────────────────────

describe("PETEEN_ENV distingue o que VERCEL_ENV não distingue", () => {
  it("VERCEL_ENV=production + PETEEN_ENV=demo → demo", () => {
    // O caso central: os dois projetos Vercel publicam como production.
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: "demo" }),
      "demo"
    )
  })

  it("VERCEL_ENV=production SEM PETEEN_ENV → production (compatibilidade)", () => {
    // Produção hoje não define a variável e não pode quebrar por isso.
    assert.equal(resolvePeteenEnvironment({ vercelEnv: "production" }), "production")
  })

  it("preview e development preservados", () => {
    assert.equal(resolvePeteenEnvironment({ vercelEnv: "preview" }), "preview")
    assert.equal(resolvePeteenEnvironment({ vercelEnv: "development" }), "development")
  })

  it("sem nenhuma variável → development (localhost, CI, container próprio)", () => {
    assert.equal(resolvePeteenEnvironment({}), "development")
  })

  it("PETEEN_ENV=production continua production, mesmo em preview", () => {
    // Declaração explícita vence — é a razão de a variável existir.
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "preview", peteenEnv: "production" }),
      "production"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Falhar para baixo, nunca para production
// ─────────────────────────────────────────────────────────────────────────────

describe("identidade desconhecida falha de forma conservadora", () => {
  const TYPOS = ["Demo", "DEMO", "prod", "producao", "staging", "qa", "1", "true", "-"]

  it("nenhum valor inválido resolve como production", () => {
    for (const typo of TYPOS) {
      const r = resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: typo }, mudo)
      assert.notEqual(r, "production", `"${typo}" virou production`)
      assert.equal(r, "development", `"${typo}" deveria cair em development`)
    }
  })

  it("valor inválido NÃO cai de volta no mapa de VERCEL_ENV", () => {
    // Se caísse, um typo em produção seria ignorado e viraria production pelo
    // caminho de trás — exatamente o que este módulo impede.
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: "prd" }, mudo),
      "development"
    )
  })

  it("valor inválido avisa, dizendo o que foi recebido e o que é aceito", () => {
    const avisos: Array<{ m: string; d: Record<string, unknown> }> = []
    resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: "Demo" }, (m, d) =>
      avisos.push({ m, d })
    )
    assert.equal(avisos.length, 1)
    const aviso = avisos[0]!
    assert.match(aviso.m, /PETEEN_ENV/)
    assert.equal(aviso.d.recebido, "Demo")
    assert.match(String(aviso.d.aceitos), /demo/)
  })

  it("string vazia ou só espaços é tratada como ausência, sem avisar", () => {
    const avisos: number[] = []
    const aoAvisar = () => avisos.push(1)
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: "" }, aoAvisar),
      "production"
    )
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: "   " }, aoAvisar),
      "production"
    )
    assert.deepEqual(avisos, [], "ausência não é erro de configuração")
  })

  it("espaço em volta de um valor válido não invalida", () => {
    assert.equal(
      resolvePeteenEnvironment({ vercelEnv: "production", peteenEnv: " demo " }),
      "demo"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulário
// ─────────────────────────────────────────────────────────────────────────────

describe("vocabulário de ambientes", () => {
  it("os quatro ambientes, e só eles", () => {
    assert.deepEqual([...PETEEN_ENVIRONMENTS], ["production", "demo", "preview", "development"])
  })

  it("o guarda de tipo aceita exatamente esses", () => {
    for (const e of PETEEN_ENVIRONMENTS) assert.equal(isPeteenEnvironment(e), true, e)
    for (const nao of ["Demo", "", null, undefined, 3, {}]) {
      assert.equal(isPeteenEnvironment(nao), false, String(nao))
    }
  })

  it("só production é produção real — DEMO nunca é", () => {
    assert.equal(isProducaoReal("production"), true)
    for (const outro of ["demo", "preview", "development"] as const) {
      assert.equal(isProducaoReal(outro), false, outro)
    }
  })

  it("toda resolução possível devolve um ambiente do vocabulário", () => {
    const entradas = [
      {},
      { vercelEnv: "production" },
      { vercelEnv: "preview" },
      { vercelEnv: "development" },
      { vercelEnv: "lixo" },
      { peteenEnv: "demo" },
      { peteenEnv: "lixo" },
      { vercelEnv: "production", peteenEnv: "demo" },
    ]
    for (const e of entradas) {
      assert.ok(isPeteenEnvironment(resolvePeteenEnvironment(e, mudo)), JSON.stringify(e))
    }
  })
})
