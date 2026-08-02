/**
 * Testes focados — contagem elegível de conclusões para o bônus de recorrência.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/trust-engine/domain/scoring.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  countEligibleCompletions,
  eligibleSessionsByTutor,
  recurrenceBonusForCount,
  totalRecurrenceBonus,
} from "./scoring.ts"

const HOUR_MS = 60 * 60 * 1000
const WINDOW = 24 * HOUR_MS

function at(iso: string): Date {
  return new Date(iso)
}

// ─────────────────────────────────────────────────────────────────────────────
// countEligibleCompletions — janela deslizante a partir do último CRÉDITO
// ─────────────────────────────────────────────────────────────────────────────

describe("countEligibleCompletions", () => {
  it("lista vazia → zero", () => {
    assert.equal(countEligibleCompletions([], WINDOW), 0)
  })

  it("uma conclusão → sempre elegível", () => {
    assert.equal(countEligibleCompletions([at("2026-08-01T08:00:00Z")], WINDOW), 1)
  })

  it("exemplo da missão: 08:00 elegível, 14:00 não, 08:01 do dia seguinte elegível", () => {
    const dates = [
      at("2026-08-01T08:00:00Z"), // elegível  → relógio = 08:00 dia 1
      at("2026-08-01T14:00:00Z"), // 6h depois → operacional, sem crédito
      at("2026-08-02T08:01:00Z"), // 24h01 do ÚLTIMO CRÉDITO → elegível
    ]
    assert.equal(countEligibleCompletions(dates, WINDOW), 2)
  })

  it("conclusão não elegível NÃO empurra o relógio para frente", () => {
    // Se o relógio reiniciasse a cada conclusão, a 3ª (24h após a 2ª) seria
    // elegível e a contagem daria 2 pelo motivo errado. O relógio tem que
    // continuar ancorado no último CRÉDITO (08:00 dia 1), então a 3ª — que
    // está a 25h do crédito — é elegível, e a 4ª (logo depois) não é.
    const dates = [
      at("2026-08-01T08:00:00Z"), // crédito
      at("2026-08-01T20:00:00Z"), // 12h → sem crédito
      at("2026-08-02T09:00:00Z"), // 25h do crédito → crédito
      at("2026-08-02T10:00:00Z"), // 1h do crédito → sem crédito
    ]
    assert.equal(countEligibleCompletions(dates, WINDOW), 2)
  })

  it("encadear conclusões a cada 23h não impede créditos futuros", () => {
    // Cenário de abuso: tentar manter o relógio sempre 'quente'. Como a
    // âncora é o último crédito (e não a última conclusão), o crédito volta
    // a acontecer assim que a janela do crédito anterior fecha.
    const dates = [
      at("2026-08-01T00:00:00Z"), // crédito  (âncora = dia 1 00:00)
      at("2026-08-01T23:00:00Z"), // 23h      → sem crédito
      at("2026-08-02T22:00:00Z"), // 46h do crédito → crédito (âncora = dia 2 22:00)
      at("2026-08-03T21:00:00Z"), // 23h do crédito → sem crédito
    ]
    assert.equal(countEligibleCompletions(dates, WINDOW), 2)
  })

  it("exatamente na fronteira da janela (24h cravadas) → elegível", () => {
    const dates = [at("2026-08-01T08:00:00Z"), at("2026-08-02T08:00:00Z")]
    assert.equal(countEligibleCompletions(dates, WINDOW), 2)
  })

  it("um milissegundo antes da fronteira → não elegível", () => {
    const first = at("2026-08-01T08:00:00Z")
    const justBefore = new Date(first.getTime() + WINDOW - 1)
    assert.equal(countEligibleCompletions([first, justBefore], WINDOW), 1)
  })

  it("independe da ordem de entrada (ordena internamente)", () => {
    const ordered = [
      at("2026-08-01T08:00:00Z"),
      at("2026-08-01T14:00:00Z"),
      at("2026-08-02T08:01:00Z"),
    ]
    const shuffled = [ordered[2]!, ordered[0]!, ordered[1]!]
    assert.equal(
      countEligibleCompletions(shuffled, WINDOW),
      countEligibleCompletions(ordered, WINDOW)
    )
  })

  it("não muta o array recebido", () => {
    const dates = [at("2026-08-02T08:00:00Z"), at("2026-08-01T08:00:00Z")]
    const snapshot = dates.map((d) => d.toISOString())
    countEligibleCompletions(dates, WINDOW)
    assert.deepEqual(dates.map((d) => d.toISOString()), snapshot)
  })

  it("conclusões bem espaçadas contam todas", () => {
    const dates = [
      at("2026-08-01T08:00:00Z"),
      at("2026-08-03T08:00:00Z"),
      at("2026-08-05T08:00:00Z"),
    ]
    assert.equal(countEligibleCompletions(dates, WINDOW), 3)
  })

  it("dez conclusões no mesmo dia contam como uma", () => {
    const dates = Array.from({ length: 10 }, (_, i) =>
      new Date(at("2026-08-01T08:00:00Z").getTime() + i * HOUR_MS)
    )
    assert.equal(countEligibleCompletions(dates, WINDOW), 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// eligibleSessionsByTutor + integração com o bônus
// ─────────────────────────────────────────────────────────────────────────────

describe("eligibleSessionsByTutor", () => {
  it("aplica a janela por tutor, de forma independente", () => {
    const byTutor = new Map<string, Date[]>([
      // tutor A: 3 conclusões no mesmo dia → 1 elegível
      ["tutorA", [
        at("2026-08-01T08:00:00Z"),
        at("2026-08-01T12:00:00Z"),
        at("2026-08-01T18:00:00Z"),
      ]],
      // tutor B: 3 conclusões em dias distintos → 3 elegíveis
      ["tutorB", [
        at("2026-08-01T08:00:00Z"),
        at("2026-08-02T09:00:00Z"),
        at("2026-08-03T10:00:00Z"),
      ]],
    ])

    const eligible = eligibleSessionsByTutor(byTutor, WINDOW)
    assert.equal(eligible.get("tutorA"), 1)
    assert.equal(eligible.get("tutorB"), 3)
  })

  it("bônus final reflete a elegibilidade, não o número bruto", () => {
    // Mesmo volume operacional (3 conclusões cada), reputação bem diferente:
    // concentrar tudo num dia vale +1; distribuir vale 1+3+5 = 9.
    const concentrado = new Map<string, Date[]>([
      ["t", [
        at("2026-08-01T08:00:00Z"),
        at("2026-08-01T12:00:00Z"),
        at("2026-08-01T18:00:00Z"),
      ]],
    ])
    const distribuido = new Map<string, Date[]>([
      ["t", [
        at("2026-08-01T08:00:00Z"),
        at("2026-08-02T09:00:00Z"),
        at("2026-08-03T10:00:00Z"),
      ]],
    ])

    assert.equal(totalRecurrenceBonus(eligibleSessionsByTutor(concentrado, WINDOW)), 1)
    assert.equal(totalRecurrenceBonus(eligibleSessionsByTutor(distribuido, WINDOW)), 9)
  })

  it("mapa vazio → bônus zero", () => {
    assert.equal(totalRecurrenceBonus(eligibleSessionsByTutor(new Map(), WINDOW)), 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regressão — a progressão do bônus em si não mudou
// ─────────────────────────────────────────────────────────────────────────────

describe("recurrenceBonusForCount (progressão preservada)", () => {
  it("mantém 1 / 3 / 5 / 7 / 10 acumulativos", () => {
    assert.equal(recurrenceBonusForCount(0), 0)
    assert.equal(recurrenceBonusForCount(1), 1)
    assert.equal(recurrenceBonusForCount(2), 4)   // 1+3
    assert.equal(recurrenceBonusForCount(3), 9)   // 1+3+5
    assert.equal(recurrenceBonusForCount(4), 16)  // 1+3+5+7
    assert.equal(recurrenceBonusForCount(5), 26)  // +10
    assert.equal(recurrenceBonusForCount(6), 36)  // +10
  })
})
