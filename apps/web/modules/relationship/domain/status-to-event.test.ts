/**
 * Testes focados — mapeamento status terminal → RelationshipEvent.
 *
 * Runner: node:test nativo. Rodar:
 *   node --experimental-strip-types --test modules/relationship/domain/status-to-event.test.ts
 *
 * Só função pura. Os cenários que dependem de banco (incremento atômico,
 * retry, rollback, concorrência, reconciliação) foram verificados ao vivo —
 * ver evidência na entrega.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { relationshipEventForStatus } from "./status-to-event.ts"

describe("relationshipEventForStatus", () => {
  it("CANCELLED_BY_TUTOR → CANCELLATION_BY_TUTOR", () => {
    assert.deepEqual(relationshipEventForStatus("CANCELLED_BY_TUTOR"), {
      type: "CANCELLATION_BY_TUTOR",
    })
  })

  it("CANCELLED_BY_PROFESSIONAL → CANCELLATION_BY_PRO", () => {
    assert.deepEqual(relationshipEventForStatus("CANCELLED_BY_PROFESSIONAL"), {
      type: "CANCELLATION_BY_PRO",
    })
  })

  it("COMPLETED → null (tem caminho proprio e atomico, nao duplicar)", () => {
    assert.equal(relationshipEventForStatus("COMPLETED"), null)
  })

  it("EXPIRED → null (ausencia de resposta nao e ato de ninguem)", () => {
    assert.equal(relationshipEventForStatus("EXPIRED"), null)
  })

  it("DISPUTED → null (status inalcancavel por construcao)", () => {
    assert.equal(relationshipEventForStatus("DISPUTED"), null)
  })

  it("estados não-terminais → null", () => {
    for (const s of ["PENDING", "ACCEPTED", "IN_PROGRESS"]) {
      assert.equal(relationshipEventForStatus(s), null, s)
    }
  })

  it("status desconhecido → null (nunca inventa evento)", () => {
    assert.equal(relationshipEventForStatus("QUALQUER_COISA"), null)
    assert.equal(relationshipEventForStatus(""), null)
  })

  it("cobre exatamente 2 status — nenhum outro produz evento", () => {
    const todos = [
      "PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED",
      "CANCELLED_BY_TUTOR", "CANCELLED_BY_PROFESSIONAL", "DISPUTED", "EXPIRED",
    ]
    const comEvento = todos.filter((s) => relationshipEventForStatus(s) !== null)
    assert.deepEqual(comEvento, ["CANCELLED_BY_TUTOR", "CANCELLED_BY_PROFESSIONAL"])
  })

  it("é determinística e não retorna a mesma referência mutável", () => {
    const a = relationshipEventForStatus("CANCELLED_BY_TUTOR")
    const b = relationshipEventForStatus("CANCELLED_BY_TUTOR")
    assert.deepEqual(a, b)
    assert.notEqual(a, b, "deve criar um objeto novo, sem estado compartilhado")
  })
})
