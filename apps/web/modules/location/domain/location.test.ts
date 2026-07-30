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
  normalizeLocationInput,
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

describe("normalizeLocationInput", () => {
  // 1-4: "São Paulo" em variações de caixa/espaço convergem para a forma canônica
  it("1. já canônico permanece idêntico", () => {
    assert.equal(normalizeLocationInput({ city: "São Paulo" }).city, "São Paulo")
  })
  it("2. minúsculo converge para canônico", () => {
    assert.equal(normalizeLocationInput({ city: "sao paulo" }).city, "São Paulo")
  })
  it("3. caixa alta converge para canônico", () => {
    assert.equal(normalizeLocationInput({ city: "SÃO PAULO" }).city, "São Paulo")
  })
  it("4. espaços extras convergem para canônico", () => {
    assert.equal(normalizeLocationInput({ city: " São  Paulo " }).city, "São Paulo")
  })

  // 5-7: Carapicuiba sem acento, em variações de caixa, restaura grafia canônica
  it("5. sem acento converge para canônico", () => {
    assert.equal(normalizeLocationInput({ city: "Carapicuiba" }).city, "Carapicuíba")
  })
  it("6. minúsculo sem acento converge para canônico", () => {
    assert.equal(normalizeLocationInput({ city: "carapicuiba" }).city, "Carapicuíba")
  })
  it("7. caixa alta com acento converge para canônico", () => {
    assert.equal(normalizeLocationInput({ city: "CARAPICUÍBA" }).city, "Carapicuíba")
  })

  // 8-9: UF
  it("8. UF minúscula vira maiúscula", () => {
    assert.equal(normalizeLocationInput({ state: "sp" }).state, "SP")
  })
  it("9. UF com espaços e caixa mista vira maiúscula", () => {
    assert.equal(normalizeLocationInput({ state: " Sp " }).state, "SP")
  })

  // 10-14: bairro
  it("10. bairro em caixa baixa recebe capitalização segura", () => {
    assert.equal(normalizeLocationInput({ neighborhood: "vila martins" }).neighborhood, "Vila Martins")
  })
  it("11. bairro em caixa alta recebe capitalização segura", () => {
    assert.equal(normalizeLocationInput({ neighborhood: "VILA CAMPESTRE" }).neighborhood, "Vila Campestre")
  })
  it("12. bairro com espaços extras é colapsado e capitalizado", () => {
    assert.equal(normalizeLocationInput({ neighborhood: "  vila   isa " }).neighborhood, "Vila Isa")
  })
  it("13. bairro vazio vira null, nunca valor artificial", () => {
    assert.equal(normalizeLocationInput({ neighborhood: "" }).neighborhood, null)
  })
  it("14. bairro null permanece null", () => {
    assert.equal(normalizeLocationInput({ neighborhood: null }).neighborhood, null)
  })

  // 15-17: cidades fora do dicionário — nunca bloqueadas, nunca inventadas
  it("15. cidade válida desconhecida recebe só capitalização segura", () => {
    assert.equal(normalizeLocationInput({ city: "mogi das cruzes" }).city, "Mogi das Cruzes")
  })
  it("16. cidade de outro estado é normalizada independentemente do catálogo local", () => {
    assert.equal(normalizeLocationInput({ city: "rio de janeiro", state: "rj" }).city, "Rio de Janeiro")
    assert.equal(normalizeLocationInput({ city: "rio de janeiro", state: "rj" }).state, "RJ")
  })
  it("17. acento fora do catálogo é preservado, nunca removido", () => {
    assert.equal(normalizeLocationInput({ city: "Águas de São Pedro" }).city, "Águas de São Pedro")
  })

  // 18-19: idempotência
  it("18. valor já canônico permanece idêntico ao normalizar de novo", () => {
    const once = normalizeLocationInput({ city: "Carapicuíba", state: "SP", neighborhood: "Centro" })
    assert.equal(once.city, "Carapicuíba")
    assert.equal(once.state, "SP")
    assert.equal(once.neighborhood, "Centro")
  })
  it("19. aplicar duas vezes produz o mesmo resultado (idempotente)", () => {
    const raw = { city: "  carapicuiba ", state: " sp ", neighborhood: "  vila martins " }
    const once = normalizeLocationInput(raw)
    const twice = normalizeLocationInput({
      city: once.city,
      state: once.state,
      neighborhood: once.neighborhood,
    })
    assert.deepEqual(twice, once)
  })

  // 20: nunca mapeia por similaridade — cidade desconhecida não vira uma cidade do catálogo
  it("20. não mapeia cidade desconhecida por semelhança a uma cidade conhecida", () => {
    // "Carapicu" é prefixo de "Carapicuíba" mas NÃO deve ser mapeado — só dicionário exato.
    assert.equal(normalizeLocationInput({ city: "Carapicu" }).city, "Carapicu")
    // Cidade sem qualquer relação com o dicionário permanece exatamente o que foi digitado
    // (com capitalização segura), nunca vira uma das 8 cidades conhecidas.
    assert.equal(normalizeLocationInput({ city: "taboao da serra" }).city, "Taboao da Serra")
  })

  // Contrato de update parcial: campo ausente (undefined) permanece ausente.
  it("campo ausente (undefined) permanece ausente — preserva update parcial", () => {
    const result = normalizeLocationInput({ city: "São Paulo" })
    assert.equal(result.state, undefined)
    assert.equal(result.neighborhood, undefined)
    assert.equal("state" in result, true) // chave existe, valor é undefined
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
