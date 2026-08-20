/**
 * Ordem de leitura do Diário — mais recente primeiro, por occurredAt.
 *
 * Regressão do achado físico: a atualização mais recente aparecia no fim da
 * lista. Regressão do achado silencioso que a correção poderia ter causado:
 * CareTimelineSummary assumia a ordem antiga (oldest-first) com um
 * `.slice(-max).reverse()` inline — corrigido para usar a mesma fonte única.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  compareTimelineNewestFirst,
  selectTimelineSummary,
  sortCareUpdatesNewestFirst,
  type TimelineOrderable,
} from "./timeline-order.ts"

const item = (id: string, occurredAt: string, createdAt: string): TimelineOrderable => ({
  id,
  occurredAt: new Date(occurredAt),
  createdAt: new Date(createdAt),
})

// ─────────────────────────────────────────────────────────────────────────────
// A matriz exigida pela missão (item 7)
// ─────────────────────────────────────────────────────────────────────────────

describe("3 CareUpdates com horários diferentes → newest-first", () => {
  it("ordena por occurredAt, do mais recente para o mais antigo", () => {
    const a = item("a", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:05.000Z")
    const b = item("b", "2026-08-18T21:10:00.000Z", "2026-08-18T21:10:05.000Z")
    const c = item("c", "2026-08-18T20:30:00.000Z", "2026-08-18T20:30:05.000Z")

    const ordenado = sortCareUpdatesNewestFirst([a, b, c])
    assert.deepEqual(ordenado.map((i) => i.id), ["b", "a", "c"])
  })
})

describe("createdAt diferente de occurredAt → occurredAt determina a ordem", () => {
  it("o exemplo da missão: publicado às 21:20 um evento ocorrido às 21:00, depois de um publicado às 21:10 ocorrido às 21:10", () => {
    // Evento das 21:10, publicado no próprio minuto.
    const ocorridoAs2110 = item("evento-21h10", "2026-08-18T21:10:00.000Z", "2026-08-18T21:10:00.000Z")
    // Evento das 21:00, mas só REGISTRADO às 21:20 — createdAt é o mais tardio dos dois.
    const ocorridoAs2100PublicadoDepois = item(
      "evento-21h00",
      "2026-08-18T21:00:00.000Z",
      "2026-08-18T21:20:00.000Z"
    )

    const ordenado = sortCareUpdatesNewestFirst([ocorridoAs2100PublicadoDepois, ocorridoAs2110])
    // A leitura correta é 21:10 primeiro, 21:00 depois — mesmo o de 21:00
    // tendo o createdAt mais recente dos dois.
    assert.deepEqual(ordenado.map((i) => i.id), ["evento-21h10", "evento-21h00"])
  })

  it("createdAt sozinho NÃO decide quando occurredAt já desempata", () => {
    const maisAntigoOccurredAt = item("antigo", "2026-08-18T10:00:00.000Z", "2026-08-18T23:00:00.000Z")
    const maisRecenteOccurredAt = item("recente", "2026-08-18T20:00:00.000Z", "2026-08-18T10:00:00.000Z")
    assert.equal(compareTimelineNewestFirst(maisRecenteOccurredAt, maisAntigoOccurredAt) < 0, true)
  })
})

describe("empate de occurredAt → ordem determinística", () => {
  it("desempata por createdAt DESC quando occurredAt é idêntico", () => {
    const publicadoPrimeiro = item("p1", "2026-08-18T21:00:00.000Z", "2026-08-18T21:05:00.000Z")
    const publicadoDepois = item("p2", "2026-08-18T21:00:00.000Z", "2026-08-18T21:15:00.000Z")
    const ordenado = sortCareUpdatesNewestFirst([publicadoPrimeiro, publicadoDepois])
    assert.deepEqual(ordenado.map((i) => i.id), ["p2", "p1"])
  })

  it("desempata por id quando occurredAt E createdAt são idênticos", () => {
    const x = item("bbb", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z")
    const y = item("aaa", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z")
    // A mesma entrada, id maior primeiro — e SEMPRE o mesmo resultado,
    // independente da ordem de entrada.
    assert.deepEqual(sortCareUpdatesNewestFirst([x, y]).map((i) => i.id), ["bbb", "aaa"])
    assert.deepEqual(sortCareUpdatesNewestFirst([y, x]).map((i) => i.id), ["bbb", "aaa"])
  })

  it("o comparador é uma ordem TOTAL — nunca 0 para itens com ids diferentes", () => {
    const x = item("x", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z")
    const y = item("y", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z")
    assert.notEqual(compareTimelineNewestFirst(x, y), 0)
  })

  it("estável entre múltiplas ordenações do mesmo conjunto (embaralhado)", () => {
    const itens = [
      item("m1", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
      item("m2", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
      item("m3", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
    ]
    const resultado1 = sortCareUpdatesNewestFirst(itens).map((i) => i.id)
    const resultado2 = sortCareUpdatesNewestFirst([itens[2]!, itens[0]!, itens[1]!]).map((i) => i.id)
    assert.deepEqual(resultado1, resultado2)
  })
})

describe("sortCareUpdatesNewestFirst não muta a entrada", () => {
  it("devolve uma cópia — o array original permanece na ordem recebida", () => {
    const original = [
      item("a", "2026-08-18T10:00:00.000Z", "2026-08-18T10:00:00.000Z"),
      item("b", "2026-08-18T20:00:00.000Z", "2026-08-18T20:00:00.000Z"),
    ]
    const copia = [...original]
    sortCareUpdatesNewestFirst(original)
    assert.deepEqual(original, copia)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Resumo — recorta, nunca reordena
// ─────────────────────────────────────────────────────────────────────────────

describe("selectTimelineSummary — recorta os N primeiros, na ordem recebida", () => {
  it("2 mais recentes de uma lista já newest-first, na ordem correta", () => {
    const newestFirst = sortCareUpdatesNewestFirst([
      item("antigo", "2026-08-18T09:00:00.000Z", "2026-08-18T09:00:00.000Z"),
      item("recente", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
      item("meio", "2026-08-18T15:00:00.000Z", "2026-08-18T15:00:00.000Z"),
    ])
    assert.deepEqual(
      selectTimelineSummary(newestFirst, 2).map((i) => i.id),
      ["recente", "meio"]
    )
  })

  it("lista menor que o teto devolve tudo, sem erro", () => {
    const newestFirst = sortCareUpdatesNewestFirst([
      item("unico", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
    ])
    assert.equal(selectTimelineSummary(newestFirst, 2).length, 1)
  })

  it("lista vazia devolve vazio", () => {
    assert.deepEqual(selectTimelineSummary([], 2), [])
  })

  it("NÃO reordena — se a entrada já está errada, o recorte reflete isso (a garantia de ordem é de quem chama)", () => {
    const oldestFirst = [
      item("a", "2026-08-18T09:00:00.000Z", "2026-08-18T09:00:00.000Z"),
      item("b", "2026-08-18T21:00:00.000Z", "2026-08-18T21:00:00.000Z"),
    ]
    // Passar a lista na ordem errada de propósito: selectTimelineSummary não
    // tem como saber e não deve tentar adivinhar — é só slice(0, max).
    assert.deepEqual(selectTimelineSummary(oldestFirst, 1).map((i) => i.id), ["a"])
  })
})
