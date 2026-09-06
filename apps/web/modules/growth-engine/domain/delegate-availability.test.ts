/**
 * GATE-15-LOCATION-DISCOVERY-GROWTH-TRUTH-FIX-002 — indisponibilidade não é zero.
 *
 * A distinção inteira que este fix protege cabe em duas linhas:
 *
 *   delegate AUSENTE   → falha técnica   → LANÇA
 *   delegate PRESENTE  → resposta normal → `0`/`[]` legítimos quando não há linhas
 *
 * Colapsar as duas era o defeito: `/admin/growth` afirmava "Regiões cadastradas:
 * 0" a partir de um Prisma Client gerado sem os modelos territoriais.
 *
 * Rodar: npm run test:location
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  exigirDelegate,
  GROWTH_DELEGATE_UNAVAILABLE,
  GrowthDelegateUnavailableError,
} from "./delegate-availability.ts"

describe("delegate ausente FALHA — nunca vira dado", () => {
  it("null lança", () => {
    assert.throws(() => exigirDelegate(null, "Region"), GrowthDelegateUnavailableError)
  })

  it("undefined lança", () => {
    assert.throws(() => exigirDelegate(undefined, "Neighborhood"), GrowthDelegateUnavailableError)
  })

  it("o erro diz QUAL modelo faltou e o que fazer", () => {
    assert.throws(
      () => exigirDelegate(null, "Region"),
      (err: GrowthDelegateUnavailableError) => {
        assert.equal(err.name, "GrowthDelegateUnavailableError")
        assert.equal(err.modelo, "Region")
        assert.match(err.message, /prisma generate/)
        return true
      }
    )
  })

  it("a mensagem é acionável, não um código opaco", () => {
    assert.match(GROWTH_DELEGATE_UNAVAILABLE, /prisma generate/)
    assert.match(GROWTH_DELEGATE_UNAVAILABLE, /Growth Engine/)
  })

  it("NUNCA devolve substituto vazio — quem recebe não tem como virar zero", () => {
    // Se devolvesse `null`/`[]`/`{}`, o chamador voltaria a ter material para
    // transformar indisponibilidade em número.
    for (const ausente of [null, undefined]) {
      let devolveu: unknown = "não lançou"
      try {
        devolveu = exigirDelegate(ausente, "Region")
      } catch {
        devolveu = "lançou"
      }
      assert.equal(devolveu, "lançou")
    }
  })
})

describe("delegate presente PASSA — e o vazio dele é legítimo", () => {
  it("devolve o próprio delegate, sem envolver", () => {
    const fake = { count: async () => 0 }
    assert.equal(exigirDelegate(fake, "Region"), fake)
  })

  it("um delegate que responde 0 continua respondendo 0", async () => {
    // Base realmente vazia COM o modelo disponível: zero é fato de negócio.
    const vazio = { count: async () => 0, findMany: async () => [] }
    const d = exigirDelegate(vazio, "Neighborhood")
    assert.equal(await d.count(), 0)
    assert.deepEqual(await d.findMany(), [])
  })

  it("valores falsy que NÃO são ausência passam", () => {
    // `0`, `""` e `false` não são delegates reais, mas a guarda precisa
    // distinguir ausência de falsy — senão volta a colapsar os dois casos.
    assert.equal(exigirDelegate(0, "X"), 0)
    assert.equal(exigirDelegate("", "X"), "")
    assert.equal(exigirDelegate(false, "X"), false)
  })
})
