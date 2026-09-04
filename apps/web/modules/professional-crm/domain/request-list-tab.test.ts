/**
 * Testes focados — normalização da aba de /requests (visão do profissional)
 * e construção dos hrefs de contexto (GATE-5-NAV-CONTEXT-001).
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/professional-crm/domain/request-list-tab.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  parseProfessionalRequestsTab,
  professionalRequestsListHref,
  professionalRequestDetailHref,
  professionalRequestsBackHref,
} from "./request-list-tab.ts"

describe("parseProfessionalRequestsTab", () => {
  it("sem parâmetro e com novas pendentes → new (default sensível a dados preservado)", () => {
    assert.equal(parseProfessionalRequestsTab(undefined, 3), "new")
  })

  it("sem parâmetro e sem novas pendentes → ongoing", () => {
    assert.equal(parseProfessionalRequestsTab(undefined, 0), "ongoing")
  })

  it("'history' explícito vence o default sensível a dados", () => {
    assert.equal(parseProfessionalRequestsTab("history", 5), "history")
  })

  it("array usa o primeiro valor", () => {
    assert.equal(parseProfessionalRequestsTab(["ongoing", "history"], 0), "ongoing")
  })

  it("valor arbitrário/hostil cai no default sensível a dados, nunca propaga o valor cru", () => {
    assert.equal(parseProfessionalRequestsTab("https://evil.example", 0), "ongoing")
    assert.equal(parseProfessionalRequestsTab("<script>", 2), "new")
  })
})

describe("professionalRequestsListHref", () => {
  it("new → sem query string (default limpo)", () => {
    assert.equal(professionalRequestsListHref("new"), "/requests")
  })

  it("ongoing/history → preservam a aba na URL", () => {
    assert.equal(professionalRequestsListHref("ongoing"), "/requests?tab=ongoing")
    assert.equal(professionalRequestsListHref("history"), "/requests?tab=history")
  })
})

describe("professionalRequestDetailHref", () => {
  it("new → detalhe sem contexto extra na URL", () => {
    assert.equal(professionalRequestDetailHref("req-1", "new"), "/requests/req-1")
  })

  it("ongoing/history → detalhe carrega a aba de origem", () => {
    assert.equal(professionalRequestDetailHref("req-1", "ongoing"), "/requests/req-1?tab=ongoing")
    assert.equal(professionalRequestDetailHref("req-1", "history"), "/requests/req-1?tab=history")
  })
})

describe("professionalRequestsBackHref", () => {
  it("sem tab (deep link direto) → lista sem parâmetro, decide o default ao montar", () => {
    assert.equal(professionalRequestsBackHref(undefined), "/requests")
  })

  it("tab válido → preserva a aba de origem", () => {
    assert.equal(professionalRequestsBackHref("ongoing"), "/requests?tab=ongoing")
    assert.equal(professionalRequestsBackHref("history"), "/requests?tab=history")
  })

  it("tab arbitrário/hostil → cai no fallback seguro /requests", () => {
    assert.equal(professionalRequestsBackHref("https://evil.example"), "/requests")
    assert.equal(professionalRequestsBackHref("<script>"), "/requests")
  })
})
