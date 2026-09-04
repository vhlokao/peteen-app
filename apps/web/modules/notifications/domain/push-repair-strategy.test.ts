/**
 * deveRenegociarAoReparar — trava de regressão do gap 404/410 (GATE-2-PUSH-FIX-002).
 *
 * O bug que este teste existe para travar: reaproveitar um endpoint que o
 * push service já declarou morto, em vez de descartá-lo e negociar um novo.
 * Ver o comentário grande em push-repair-strategy.ts para o mecanismo completo.
 *
 * Rodar: node --experimental-strip-types --test modules/notifications/domain/push-repair-strategy.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { deveRenegociarAoReparar } from "./push-repair-strategy.ts"

describe("deveRenegociarAoReparar", () => {
  it("endpoint local + revogado como gone => renegociar (descartar e criar novo)", () => {
    assert.equal(
      deveRenegociarAoReparar({ endpointAtual: "https://fcm.googleapis.com/x", revogadoComoGone: true }),
      true
    )
  })

  it("endpoint local + NÃO revogado como gone => reaproveitar (comportamento atual, intacto)", () => {
    assert.equal(
      deveRenegociarAoReparar({ endpointAtual: "https://fcm.googleapis.com/x", revogadoComoGone: false }),
      false
    )
  })

  it("sem endpoint local => nunca renegociar por este motivo — nada para descartar, assinar() já cria do zero", () => {
    assert.equal(deveRenegociarAoReparar({ endpointAtual: null, revogadoComoGone: true }), false)
  })

  it("CONTROLE NEGATIVO: sem endpoint e sem histórico de gone => false, não true por acidente", () => {
    assert.equal(deveRenegociarAoReparar({ endpointAtual: null, revogadoComoGone: false }), false)
  })
})
