/**
 * Testes focados — resolução do filtro de cidade do Discovery.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/location/domain/discovery-filter.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 *
 * REGRESSÃO NOMEADA: existe por causa de divergência comprovada em auditoria —
 * tutor de Carapicuíba via "Todas as cidades" no seletor enquanto a query
 * filtrava Carapicuíba e escondia 4 de 8 profissionais sem nenhum aviso.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { resolveDiscoveryCity, TODAS_AS_CIDADES } from "./discovery-filter.ts"

describe("A — default do perfil (sem query param)", () => {
  it("tutor de Carapicuíba: UI e query mostram a MESMA cidade", () => {
    const r = resolveDiscoveryCity({ cityParam: undefined, tutorCity: "Carapicuíba" })
    assert.equal(r.effectiveCity, "Carapicuíba", "query deve filtrar Carapicuíba")
    assert.equal(r.selectValue, "Carapicuíba", "UI deve MOSTRAR Carapicuíba")
    assert.equal(r.usandoDefaultDoPerfil, true)
    assert.equal(r.semFiltroExplicito, false)
  })

  it("o bug original está fechado: UI nunca diz 'todas' com filtro ativo", () => {
    const r = resolveDiscoveryCity({ cityParam: undefined, tutorCity: "Carapicuíba" })
    assert.notEqual(r.selectValue, TODAS_AS_CIDADES)
  })

  it("param vazio ou só espaços cai no default do perfil", () => {
    for (const p of ["", "   ", null]) {
      const r = resolveDiscoveryCity({ cityParam: p, tutorCity: "Osasco" })
      assert.equal(r.effectiveCity, "Osasco", `param ${JSON.stringify(p)}`)
      assert.equal(r.selectValue, "Osasco")
    }
  })
})

describe("B — override manual tem precedência", () => {
  it("?city=São Paulo sobrepõe a cidade do perfil", () => {
    const r = resolveDiscoveryCity({ cityParam: "São Paulo", tutorCity: "Carapicuíba" })
    assert.equal(r.effectiveCity, "São Paulo")
    assert.equal(r.selectValue, "São Paulo")
    assert.equal(r.usandoDefaultDoPerfil, false)
  })

  it("espaços em volta não quebram o override", () => {
    const r = resolveDiscoveryCity({ cityParam: "  Osasco  ", tutorCity: "Carapicuíba" })
    assert.equal(r.effectiveCity, "Osasco")
  })

  it("1 caractere é ignorado (mesmo mínimo do schema da action)", () => {
    const r = resolveDiscoveryCity({ cityParam: "S", tutorCity: "Carapicuíba" })
    assert.equal(r.effectiveCity, "Carapicuíba", "deve cair no default, não filtrar por 'S'")
  })
})

describe("C — 'todas as cidades' realmente remove o filtro", () => {
  it("?city=todas não filtra, MESMO com cidade no perfil", () => {
    const r = resolveDiscoveryCity({ cityParam: TODAS_AS_CIDADES, tutorCity: "Carapicuíba" })
    assert.equal(r.effectiveCity, undefined, "query NÃO pode receber cidade")
    assert.equal(r.selectValue, TODAS_AS_CIDADES)
    assert.equal(r.semFiltroExplicito, true)
  })

  it("é distinguível de 'sem parâmetro' — a colisão semântica que causava o bug", () => {
    const semParam = resolveDiscoveryCity({ cityParam: undefined, tutorCity: "Carapicuíba" })
    const todas = resolveDiscoveryCity({ cityParam: TODAS_AS_CIDADES, tutorCity: "Carapicuíba" })
    assert.notDeepEqual(semParam, todas, "os dois estados NÃO podem ser equivalentes")
    assert.equal(semParam.effectiveCity, "Carapicuíba")
    assert.equal(todas.effectiveCity, undefined)
  })
})

describe("visitante sem perfil / sem cidade", () => {
  it("sem tutorCity e sem param: não filtra e o select reflete isso", () => {
    for (const t of [null, undefined, "", "   "]) {
      const r = resolveDiscoveryCity({ cityParam: undefined, tutorCity: t })
      assert.equal(r.effectiveCity, undefined)
      assert.equal(r.selectValue, TODAS_AS_CIDADES)
      assert.equal(r.usandoDefaultDoPerfil, false)
    }
  })

  it("sem perfil, override manual continua funcionando", () => {
    const r = resolveDiscoveryCity({ cityParam: "Barueri", tutorCity: null })
    assert.equal(r.effectiveCity, "Barueri")
    assert.equal(r.selectValue, "Barueri")
  })
})

describe("invariante central — UI e query NUNCA divergem", () => {
  it("para toda combinação, selectValue reflete o filtro real", () => {
    const params = [undefined, null, "", "  ", "S", TODAS_AS_CIDADES, "São Paulo", " Osasco "]
    const perfis = [null, undefined, "", "Carapicuíba", "São Paulo"]
    for (const cityParam of params) {
      for (const tutorCity of perfis) {
        const r = resolveDiscoveryCity({ cityParam, tutorCity })
        if (r.effectiveCity === undefined) {
          assert.equal(
            r.selectValue,
            TODAS_AS_CIDADES,
            `sem filtro deve mostrar "todas" (param=${JSON.stringify(cityParam)}, perfil=${JSON.stringify(tutorCity)})`
          )
        } else {
          assert.equal(
            r.selectValue,
            r.effectiveCity,
            `com filtro, o select deve mostrar exatamente a cidade filtrada (param=${JSON.stringify(cityParam)}, perfil=${JSON.stringify(tutorCity)})`
          )
        }
      }
    }
  })
})
