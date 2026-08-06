/**
 * Testes focados — buildRelationshipSummary.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/relationship-history/domain/build-summary.test.ts
 *
 * Só função pura — nenhum acesso a banco, rede ou Next.js.
 *
 * O que estes testes protegem:
 *   `totalRequests` deixou de ser contador materializado e passou a ser
 *   derivado de ServiceRequest. A regressão que importa é alguém voltar a ler
 *   a coluna legada do vínculo — o que reintroduziria o card exibindo
 *   "4 concluídos / 3 solicitações".
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildRelationshipSummary,
  type RelationshipSummarySource,
  type RelationshipSummaryDerived,
} from "./build-summary.ts"

const derivado = (
  over: Partial<RelationshipSummaryDerived> = {}
): RelationshipSummaryDerived => ({
  completedServices: 0,
  totalRequests: 0,
  lastServiceAt: null,
  ...over,
})

const vinculo = (
  over: Partial<RelationshipSummarySource> = {}
): RelationshipSummarySource => ({
  completedServices: 0,
  lastServiceAt: null,
  relationshipLevel: "NEW",
  ...over,
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Vínculo ausente — tudo vem do derivado
// ─────────────────────────────────────────────────────────────────────────────

describe("vínculo ausente", () => {
  it("usa as contagens derivadas", () => {
    const s = buildRelationshipSummary(
      null,
      derivado({ completedServices: 2, totalRequests: 5 })
    )
    assert.equal(s.completedServices, 2)
    assert.equal(s.totalRequests, 5)
    assert.equal(s.relationshipLevel, "NEW")
  })

  it("totalRequests derivado aparece mesmo sem nenhuma conclusão", () => {
    // Par que só tem solicitações pendentes/canceladas: 0 concluídas, 3 criadas.
    const s = buildRelationshipSummary(
      null,
      derivado({ completedServices: 0, totalRequests: 3 })
    )
    assert.equal(s.completedServices, 0)
    assert.equal(s.totalRequests, 3)
    assert.equal(s.isRecurring, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vínculo presente e coerente
// ─────────────────────────────────────────────────────────────────────────────

describe("vínculo presente e coerente", () => {
  it("mantém completedServices/level do vínculo e totalRequests do derivado", () => {
    const last = new Date("2026-07-01T12:00:00.000Z")
    const s = buildRelationshipSummary(
      vinculo({ completedServices: 4, lastServiceAt: last, relationshipLevel: "RECURRING" }),
      derivado({ completedServices: 4, totalRequests: 7, lastServiceAt: last })
    )
    assert.equal(s.completedServices, 4)
    assert.equal(s.totalRequests, 7)
    assert.equal(s.lastServiceAt, last)
    assert.equal(s.relationshipLevel, "RECURRING")
    assert.equal(s.isRecurring, true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 e 4. A coluna legada é ignorada em qualquer circunstância
// ─────────────────────────────────────────────────────────────────────────────

describe("coluna legada totalRequests é ignorada", () => {
  it("valor obsoleto no vínculo não contamina o resultado", () => {
    // Mesmo que alguém volte a passar o campo legado, ele não é lido: o tipo
    // RelationshipSummarySource nem o declara mais.
    const comLegado = {
      ...vinculo({ completedServices: 4, relationshipLevel: "RECURRING" }),
      totalRequests: 3, // legado, obsoleto
    } as RelationshipSummarySource
    const s = buildRelationshipSummary(comLegado, derivado({ completedServices: 4, totalRequests: 7 }))
    assert.equal(s.totalRequests, 7, "deve vir do derivado, não do legado")
  })

  it("caso real: legado MENOR que completedServices não produz mais o card absurdo", () => {
    // Reprodução dos 2 registros encontrados em produção: a coluna dizia 3
    // enquanto havia 4 conclusões reais, e o card exibia "4 concluídos / 3
    // solicitações". O derivado (5 solicitações reais) corrige isso.
    const s = buildRelationshipSummary(
      vinculo({ completedServices: 4, relationshipLevel: "RECURRING" }),
      derivado({ completedServices: 4, totalRequests: 5 })
    )
    assert.equal(s.completedServices, 4)
    assert.equal(s.totalRequests, 5)
    assert.ok(
      s.completedServices <= s.totalRequests,
      `invariante violada: ${s.completedServices} concluídos > ${s.totalRequests} solicitações`
    )
  })

  it("invariante geral: concluídos nunca excedem o total derivado", () => {
    // O derivado conta TODAS as statuses, então necessariamente inclui as
    // concluídas. Varre uma faixa de combinações coerentes.
    for (let total = 0; total <= 10; total++) {
      for (let concluidas = 0; concluidas <= total; concluidas++) {
        const s = buildRelationshipSummary(
          vinculo({ completedServices: concluidas }),
          derivado({ completedServices: concluidas, totalRequests: total })
        )
        assert.ok(
          s.completedServices <= s.totalRequests,
          `falhou em ${concluidas}/${total}`
        )
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Todas as statuses contam no total derivado
// ─────────────────────────────────────────────────────────────────────────────

describe("todas as statuses contam", () => {
  it("total reflete a soma de todos os desfechos, não só conclusões", () => {
    // 1 concluída + 1 pendente + 1 aceita + 1 em andamento + 1 cancelada pelo
    // tutor + 1 cancelada pelo pro + 1 disputada + 1 expirada = 8 criadas.
    const s = buildRelationshipSummary(
      vinculo({ completedServices: 1 }),
      derivado({ completedServices: 1, totalRequests: 8 })
    )
    assert.equal(s.totalRequests, 8)
    assert.equal(s.completedServices, 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coerência de level/label e pureza
// ─────────────────────────────────────────────────────────────────────────────

describe("level, label e pureza", () => {
  it("sem vínculo o level é NEW e tem label", () => {
    const s = buildRelationshipSummary(null, derivado())
    assert.equal(s.relationshipLevel, "NEW")
    assert.ok(typeof s.relationshipLevelLabel === "string" && s.relationshipLevelLabel.length > 0)
  })

  it("isRecurring segue completedServices, não totalRequests", () => {
    // Muitas solicitações criadas, poucas concluídas: NÃO é recorrente.
    const s = buildRelationshipSummary(
      vinculo({ completedServices: 1 }),
      derivado({ completedServices: 1, totalRequests: 20 })
    )
    assert.equal(s.isRecurring, false, "volume criado não deve promover a recorrente")
  })

  it("não muta as entradas", () => {
    const v = vinculo({ completedServices: 2 })
    const d = derivado({ completedServices: 2, totalRequests: 4 })
    const copiaV = { ...v }
    const copiaD = { ...d }
    buildRelationshipSummary(v, d)
    assert.deepEqual(v, copiaV)
    assert.deepEqual(d, copiaD)
  })

  it("determinístico", () => {
    const v = vinculo({ completedServices: 3, relationshipLevel: "RECURRING" })
    const d = derivado({ completedServices: 3, totalRequests: 6 })
    assert.deepEqual(buildRelationshipSummary(v, d), buildRelationshipSummary(v, d))
  })
})
