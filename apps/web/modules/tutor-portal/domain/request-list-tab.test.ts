/**
 * Testes focados — normalização da aba de /tutor/requests e construção dos
 * hrefs de contexto (GATE-5-NAV-CONTEXT-001).
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/tutor-portal/domain/request-list-tab.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  parseTutorRequestsTab,
  tutorRequestsListHref,
  tutorRequestDetailHref,
} from "./request-list-tab.ts"

describe("parseTutorRequestsTab", () => {
  it("undefined (deep link sem parâmetro) → active", () => {
    assert.equal(parseTutorRequestsTab(undefined), "active")
  })

  it("'previous' válido → previous", () => {
    assert.equal(parseTutorRequestsTab("previous"), "previous")
  })

  it("'active' explícito → active", () => {
    assert.equal(parseTutorRequestsTab("active"), "active")
  })

  it("array (Next entrega string[] quando o parâmetro repete) usa o primeiro valor", () => {
    assert.equal(parseTutorRequestsTab(["previous", "active"]), "previous")
  })

  it("valor arbitrário/hostil cai no default seguro, nunca propaga o valor cru", () => {
    assert.equal(parseTutorRequestsTab("https://evil.example"), "active")
    assert.equal(parseTutorRequestsTab("<script>"), "active")
    assert.equal(parseTutorRequestsTab(""), "active")
  })
})

describe("tutorRequestsListHref", () => {
  it("active → sem query string (default limpo)", () => {
    assert.equal(tutorRequestsListHref("active"), "/tutor/requests")
  })

  it("previous → preserva a aba na URL", () => {
    assert.equal(tutorRequestsListHref("previous"), "/tutor/requests?tab=previous")
  })
})

describe("tutorRequestDetailHref", () => {
  it("active → detalhe sem contexto extra na URL", () => {
    assert.equal(tutorRequestDetailHref("req-1", "active"), "/tutor/requests/req-1")
  })

  it("previous → detalhe carrega a aba de origem", () => {
    assert.equal(tutorRequestDetailHref("req-1", "previous"), "/tutor/requests/req-1?tab=previous")
  })
})
