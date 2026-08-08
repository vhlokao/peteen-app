/**
 * Testes focados — funções puras de nível e score de relacionamento.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/relationship/domain/relationship-levels.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 *
 * Estas são as MESMAS funções usadas por `applyRelationshipEvent` (dentro da
 * transação de conclusão) e pela reconciliação. Se as duas usam a mesma
 * fonte, o resultado converge — é isso que garante que reconciliar não muda
 * nada quando o fluxo transacional funcionou.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  resolveRelationshipLevel,
  computeRelationshipScore,
  getEarnedBadges,
} from "./relationship-levels.ts"
import { RELATIONSHIP_SCORE_WEIGHTS } from "./constants.ts"

// ─────────────────────────────────────────────────────────────────────────────
// resolveRelationshipLevel — limiares 1 / 2 / 3 / 5 / 10
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveRelationshipLevel", () => {
  it("0 atendimentos → NEW (vínculo ainda não existe de fato)", () => {
    assert.equal(resolveRelationshipLevel(0), "NEW")
  })

  it("progressão nos limiares exatos", () => {
    assert.equal(resolveRelationshipLevel(1), "NEW")
    assert.equal(resolveRelationshipLevel(2), "KNOWN")
    assert.equal(resolveRelationshipLevel(3), "RECURRING")
    assert.equal(resolveRelationshipLevel(4), "RECURRING")
    assert.equal(resolveRelationshipLevel(5), "TRUSTED")
    assert.equal(resolveRelationshipLevel(9), "TRUSTED")
    assert.equal(resolveRelationshipLevel(10), "PARTNER")
    assert.equal(resolveRelationshipLevel(50), "PARTNER")
  })

  it("um a menos que o limiar não promove", () => {
    assert.notEqual(resolveRelationshipLevel(2), "RECURRING")
    assert.notEqual(resolveRelationshipLevel(4), "TRUSTED")
    assert.notEqual(resolveRelationshipLevel(9), "PARTNER")
  })

  it("depende SÓ de completedServices — nunca de score ou nota", () => {
    // Assinatura de um argumento só: não há como a percepção (review)
    // influenciar o nível do vínculo.
    assert.equal(resolveRelationshipLevel.length, 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeRelationshipScore
// ─────────────────────────────────────────────────────────────────────────────

// `disputedServices` NÃO faz parte da assinatura — disputa é histórico
// operacional, não entra no score (ver constants.ts).
const zerado = {
  completedServices: 0,
  reviewsGiven: 0,
  cancelledByTutor: 0,
  cancelledByPro: 0,
}

describe("computeRelationshipScore", () => {
  it("tudo zerado → 0", () => {
    assert.equal(computeRelationshipScore(zerado), 0)
  })

  it("nunca retorna negativo — vínculo fraco não é vínculo ruim", () => {
    const score = computeRelationshipScore({
      ...zerado,
      cancelledByTutor: 10,
      cancelledByPro: 10,
    })
    assert.ok(score >= 0, `esperado >= 0, veio ${score}`)
    assert.equal(score, 0)
  })

  it("disputa NÃO entra no score — nem como parâmetro aceito", () => {
    // A assinatura declara exatamente o que afeta o score. Se alguém tentar
    // reintroduzir disputas aqui, o typecheck quebra — foi assim que este
    // arquivo mesmo teve de ser ajustado quando o peso foi removido.
    const esperado = ["completedServices", "reviewsGiven", "cancelledByTutor", "cancelledByPro"]
    assert.deepEqual(Object.keys(zerado), esperado)
  })

  it("é monotônico em completedServices", () => {
    const a = computeRelationshipScore({ ...zerado, completedServices: 1 })
    const b = computeRelationshipScore({ ...zerado, completedServices: 2 })
    const c = computeRelationshipScore({ ...zerado, completedServices: 3 })
    assert.ok(a < b && b < c, `esperado crescente, veio ${a}/${b}/${c}`)
  })

  it("é monotônico em reviewsGiven", () => {
    const base = { ...zerado, completedServices: 2 }
    const a = computeRelationshipScore(base)
    const b = computeRelationshipScore({ ...base, reviewsGiven: 1 })
    assert.ok(b > a, `esperado ${b} > ${a}`)
  })

  it("determinístico — mesma entrada, mesmo resultado", () => {
    const entrada = { ...zerado, completedServices: 4, reviewsGiven: 3 }
    assert.equal(computeRelationshipScore(entrada), computeRelationshipScore(entrada))
  })

  it("não muta a entrada", () => {
    const entrada = { ...zerado, completedServices: 2, reviewsGiven: 1 }
    const copia = { ...entrada }
    computeRelationshipScore(entrada)
    assert.deepEqual(entrada, copia)
  })

  it("arredonda a uma casa decimal", () => {
    const score = computeRelationshipScore({ ...zerado, completedServices: 3, reviewsGiven: 1 })
    assert.equal(score, Math.round(score * 10) / 10)
  })

  it("os pesos são exatamente os 4 atribuíveis — DISPUTE foi removido", () => {
    // Trava a decisão: disputa não tem peso. Se alguém readicionar `DISPUTE`
    // em RELATIONSHIP_SCORE_WEIGHTS, este teste falha e força ler o porquê.
    assert.deepEqual(Object.keys(RELATIONSHIP_SCORE_WEIGHTS).sort(), [
      "CANCELLATION_BY_PRO",
      "CANCELLATION_BY_TUTOR",
      "REVIEW_GIVEN",
      "SERVICE_COMPLETED",
    ])
    assert.equal("DISPUTE" in RELATIONSHIP_SCORE_WEIGHTS, false)
  })

  it("cancelamentos CONTINUAM penalizando (autoria é estrutural)", () => {
    const base = { ...zerado, completedServices: 4, reviewsGiven: 3 }
    const semCancel = computeRelationshipScore(base)
    const comTutor = computeRelationshipScore({ ...base, cancelledByTutor: 1 })
    const comPro = computeRelationshipScore({ ...base, cancelledByPro: 1 })
    assert.equal(semCancel, 9.5)
    assert.equal(comTutor, 9, "cancelamento do tutor deve custar -0.5")
    assert.equal(comPro, 8.5, "cancelamento do profissional deve custar -1.0")
  })

  it("conclusão e review CONTINUAM pontuando", () => {
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 1 }), 2)
    assert.equal(computeRelationshipScore({ ...zerado, reviewsGiven: 1 }), 0.5)
  })

  it("reproduz os valores reconciliados em produção", () => {
    // Casos observados na base após o saneamento — servem de regressão para
    // o par (contadores → score) que a reconciliação também calcula.
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 4, reviewsGiven: 4 }), 10)
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 4, reviewsGiven: 3 }), 9.5)
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 2, reviewsGiven: 1 }), 4.5)
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 2, reviewsGiven: 2 }), 5)
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 1, reviewsGiven: 1 }), 2.5)
    assert.equal(computeRelationshipScore({ ...zerado, completedServices: 1, reviewsGiven: 0 }), 2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coerência entre nível e score — o par que a reconciliação persiste
// ─────────────────────────────────────────────────────────────────────────────

describe("coerência nível × score", () => {
  it("dois caminhos com os mesmos contadores derivam o mesmo par", () => {
    // Simula: fluxo transacional (incrementou até 3) vs reconciliação
    // (recontou 3 do zero). Ambos precisam chegar ao mesmo resultado.
    const contadores = { ...zerado, completedServices: 3, reviewsGiven: 2 }
    const viaFluxo = {
      score: computeRelationshipScore(contadores),
      level: resolveRelationshipLevel(contadores.completedServices),
    }
    const viaReconciliacao = {
      score: computeRelationshipScore(contadores),
      level: resolveRelationshipLevel(contadores.completedServices),
    }
    assert.deepEqual(viaFluxo, viaReconciliacao)
    assert.equal(viaFluxo.level, "RECURRING")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getEarnedBadges — regressão leve (usado no perfil público)
// ─────────────────────────────────────────────────────────────────────────────

describe("getEarnedBadges", () => {
  it("0 atendimentos → nenhum badge", () => {
    assert.deepEqual(getEarnedBadges(0), [])
  })

  it("é determinístico e cresce (ou mantém) com mais atendimentos", () => {
    const a = getEarnedBadges(1)
    const b = getEarnedBadges(1)
    assert.deepEqual(a, b)
    assert.ok(getEarnedBadges(10).length >= 1)
  })
})
