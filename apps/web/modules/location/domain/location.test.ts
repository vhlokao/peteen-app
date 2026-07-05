/**
 * Testes unitários — módulo location (Foundation V0).
 *
 * Runner: node:test nativo (sem dependência nova).
 * Rodar: npm run test:location
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  collapseWhitespace,
  stripDiacritics,
  compareLocationText,
  titleCaseSafe,
  normalizeCityName,
  normalizeNeighborhoodName,
  normalizeStateCode,
} from "./normalize.ts"
import { formatPublicLocation, LOCATION_NOT_INFORMED_LABEL } from "./format.ts"
import { resolvePublicLocation, resolveLocationCompleteness } from "./resolve.ts"

describe("collapseWhitespace", () => {
  it("faz trim e colapsa espaços duplicados", () => {
    assert.equal(collapseWhitespace("  São   Paulo  "), "São Paulo")
  })
  it("string só de espaços vira vazia", () => {
    assert.equal(collapseWhitespace("   "), "")
  })
})

describe("stripDiacritics", () => {
  it("remove acentos para comparação", () => {
    assert.equal(stripDiacritics("Carapicuíba"), "Carapicuiba")
    assert.equal(stripDiacritics("São João da Aliança"), "Sao Joao da Alianca")
  })
})

describe("compareLocationText", () => {
  it("cidade igual, caixa diferente", () => {
    assert.equal(compareLocationText("CENTRO", "centro"), true)
  })
  it("cidade igual, acento diferente", () => {
    assert.equal(compareLocationText("Carapicuiba", "Carapicuíba"), true)
  })
  it("espaços extras não importam", () => {
    assert.equal(compareLocationText(" São  Paulo ", "são paulo"), true)
  })
  it("cidades diferentes", () => {
    assert.equal(compareLocationText("Osasco", "Barueri"), false)
  })
  it("null/vazio nunca é igual a nada, nem a si mesmo", () => {
    assert.equal(compareLocationText(null, null), false)
    assert.equal(compareLocationText("", ""), false)
    assert.equal(compareLocationText("Osasco", null), false)
    assert.equal(compareLocationText(undefined, "Osasco"), false)
  })
})

describe("titleCaseSafe", () => {
  it("caixa alta vira capitalizado", () => {
    assert.equal(titleCaseSafe("CENTRO"), "Centro")
  })
  it("preserva acentos existentes", () => {
    assert.equal(titleCaseSafe("são paulo"), "São Paulo")
  })
  it("conectivos ficam minúsculos, exceto na primeira palavra", () => {
    assert.equal(titleCaseSafe("santana de parnaíba"), "Santana de Parnaíba")
    assert.equal(titleCaseSafe("de dentro"), "De Dentro")
  })
})

describe("normalizeCityName", () => {
  it("restaura grafia canônica só via dicionário", () => {
    assert.equal(normalizeCityName("carapicuiba"), "Carapicuíba")
    assert.equal(normalizeCityName("CARAPICUÍBA"), "Carapicuíba")
    assert.equal(normalizeCityName("sao paulo"), "São Paulo")
  })
  it("fora do dicionário, só capitalização segura — sem inventar acento", () => {
    assert.equal(normalizeCityName("mogi das cruzes"), "Mogi das Cruzes")
    assert.equal(normalizeCityName("taboao da serra"), "Taboao da Serra")
  })
  it("vazio/whitespace/null viram null", () => {
    assert.equal(normalizeCityName(""), null)
    assert.equal(normalizeCityName("   "), null)
    assert.equal(normalizeCityName(null), null)
    assert.equal(normalizeCityName(undefined), null)
  })
})

describe("normalizeNeighborhoodName", () => {
  it("capitaliza preservando acentos", () => {
    assert.equal(normalizeNeighborhoodName("vila martins"), "Vila Martins")
    assert.equal(normalizeNeighborhoodName("CENTRO"), "Centro")
  })
  it("bairro vazio vira null", () => {
    assert.equal(normalizeNeighborhoodName(""), null)
    assert.equal(normalizeNeighborhoodName("  "), null)
  })
})

describe("normalizeStateCode", () => {
  it("UF minúscula vira maiúscula", () => {
    assert.equal(normalizeStateCode("sp"), "SP")
    assert.equal(normalizeStateCode(" rj "), "RJ")
  })
  it("sigla inexistente ou texto por extenso viram null", () => {
    assert.equal(normalizeStateCode("XX"), null)
    assert.equal(normalizeStateCode("São Paulo"), null)
    assert.equal(normalizeStateCode(""), null)
    assert.equal(normalizeStateCode(null), null)
  })
})

describe("formatPublicLocation", () => {
  it("bairro + cidade + UF", () => {
    assert.equal(
      formatPublicLocation({ city: "Carapicuíba", state: "SP", neighborhood: "Centro" }),
      "Centro, Carapicuíba — SP"
    )
  })
  it("cidade + UF", () => {
    assert.equal(
      formatPublicLocation({ city: "Carapicuíba", state: "SP" }),
      "Carapicuíba — SP"
    )
  })
  it("só cidade", () => {
    assert.equal(formatPublicLocation({ city: "Carapicuíba", state: null }), "Carapicuíba")
  })
  it("sem cidade → label de não informado, nunca null/undefined/vírgula sobrando", () => {
    assert.equal(
      formatPublicLocation({ city: null, state: "SP", neighborhood: "Centro" }),
      LOCATION_NOT_INFORMED_LABEL
    )
    assert.equal(formatPublicLocation({ city: null, state: null }), LOCATION_NOT_INFORMED_LABEL)
  })
})

describe("resolvePublicLocation", () => {
  it("texto completo normalizado", () => {
    const r = resolvePublicLocation({ city: "carapicuiba", state: "sp", neighborhood: "CENTRO" })
    assert.equal(r.city, "Carapicuíba")
    assert.equal(r.state, "SP")
    assert.equal(r.neighborhood, "Centro")
    assert.equal(r.label, "Centro, Carapicuíba — SP")
    assert.equal(r.hasLocation, true)
    assert.equal(r.source, "text")
  })
  it("entidade estruturada tem precedência sobre o texto e também é normalizada", () => {
    const r = resolvePublicLocation({
      city: "outra cidade",
      state: "RJ",
      neighborhood: "outro bairro",
      neighborhoodEntity: { name: "centro", city: "Carapicuiba", state: "sp" },
    })
    assert.equal(r.city, "Carapicuíba")
    assert.equal(r.state, "SP")
    assert.equal(r.neighborhood, "Centro")
    assert.equal(r.source, "structured")
  })
  it("parcial: cidade sem UF legível", () => {
    const r = resolvePublicLocation({ city: "Osasco", state: "estado de são paulo" })
    assert.equal(r.city, "Osasco")
    assert.equal(r.state, null)
    assert.equal(r.label, "Osasco")
    assert.equal(r.source, "partial")
  })
  it("dados nulos → missing, label seguro", () => {
    const r = resolvePublicLocation({ city: null, state: null, neighborhood: null })
    assert.equal(r.hasLocation, false)
    assert.equal(r.source, "missing")
    assert.equal(r.label, LOCATION_NOT_INFORMED_LABEL)
  })
  it("nunca vaza null/undefined no label", () => {
    const r = resolvePublicLocation({ city: "Cotia", state: undefined, neighborhood: "" })
    assert.equal(r.label.includes("null"), false)
    assert.equal(r.label.includes("undefined"), false)
    assert.equal(r.label, "Cotia")
  })
})

describe("resolveLocationCompleteness", () => {
  it("COMPLETE", () => {
    assert.equal(
      resolveLocationCompleteness({ city: "Carapicuíba", state: "SP", neighborhood: "Centro" }),
      "COMPLETE"
    )
  })
  it("NEIGHBORHOOD_MISSING", () => {
    assert.equal(
      resolveLocationCompleteness({ city: "Carapicuíba", state: "SP" }),
      "NEIGHBORHOOD_MISSING"
    )
  })
  it("CITY_ONLY", () => {
    assert.equal(resolveLocationCompleteness({ city: "Carapicuíba", state: "" }), "CITY_ONLY")
  })
  it("MISSING", () => {
    assert.equal(resolveLocationCompleteness({ city: "", state: "SP" }), "MISSING")
  })
})
