/**
 * GATE-11-ACCOUNT-SETTINGS-MOBILE-UX-001 — volta de Configurações.
 *
 * Cobre as três coisas que um botão Voltar precisa garantir: sempre ter
 * destino, nunca sair da área da persona, e nunca virar um vetor de redirect
 * aberto (`returnTo` vem da URL).
 *
 * Rodar: npm run test:routing
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  accountHomeHref,
  accountHref,
  buildAccountHrefComRetorno,
  personaPossuiCaminho,
  resolveAccountBackHref,
  type AccountPersona,
} from "./account-navigation.ts"

const PERSONAS: readonly AccountPersona[] = ["tutor", "professional"]

// ─────────────────────────────────────────────────────────────────────────────
// Sempre há destino
// ─────────────────────────────────────────────────────────────────────────────

describe("o Voltar de Configurações sempre tem para onde ir", () => {
  it("sem returnTo cai na home da persona", () => {
    assert.equal(resolveAccountBackHref("tutor", undefined), "/tutor")
    assert.equal(resolveAccountBackHref("professional", undefined), "/professional")
  })

  it("returnTo vazio, em branco ou array vazio cai na home", () => {
    for (const persona of PERSONAS) {
      const home = accountHomeHref(persona)
      assert.equal(resolveAccountBackHref(persona, ""), home)
      assert.equal(resolveAccountBackHref(persona, "   "), home)
      assert.equal(resolveAccountBackHref(persona, []), home)
    }
  })

  it("nunca devolve string vazia — um Voltar sem destino é pior que nenhum", () => {
    const entradas = ["", "  ", "//evil.com", "http://evil.com", "/professional", "/tutor/requests"]
    for (const persona of PERSONAS) {
      for (const entrada of entradas) {
        const href = resolveAccountBackHref(persona, entrada)
        assert.ok(href.startsWith("/"), `${persona} + "${entrada}" → "${href}"`)
        assert.ok(href.length > 1)
      }
    }
  })

  it("query string repetida usa o primeiro valor", () => {
    assert.equal(resolveAccountBackHref("tutor", ["/tutor/requests", "/tutor/pets"]), "/tutor/requests")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Volta de verdade — o caminho de onde a pessoa saiu
// ─────────────────────────────────────────────────────────────────────────────

describe("volta para a tela de origem quando ela é da própria área", () => {
  it("tutor volta para telas de tutor", () => {
    for (const caminho of [
      "/tutor",
      "/tutor/requests",
      "/tutor/requests/abc123",
      "/tutor/requests/abc123/diario",
      "/tutor/perfil",
      "/discover",
      "/discover/prof-1",
      "/me/pets",
    ]) {
      assert.equal(resolveAccountBackHref("tutor", caminho), caminho, caminho)
    }
  })

  it("profissional volta para telas de profissional", () => {
    for (const caminho of [
      "/professional",
      "/professional/agenda",
      "/professional/clients/xyz",
      "/requests",
      "/requests/abc123",
      "/requests/abc123/diario",
    ]) {
      assert.equal(resolveAccountBackHref("professional", caminho), caminho, caminho)
    }
  })

  it("preserva query e hash da tela de origem", () => {
    assert.equal(
      resolveAccountBackHref("tutor", "/tutor/requests?tab=ativas"),
      "/tutor/requests?tab=ativas"
    )
  })

  it("returnTo codificado é decodificado", () => {
    assert.equal(resolveAccountBackHref("tutor", "%2Ftutor%2Frequests"), "/tutor/requests")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Nunca cruza a fronteira da persona
// ─────────────────────────────────────────────────────────────────────────────

describe("nunca atravessa para a área da outra persona", () => {
  it("tutor não volta para rota de profissional", () => {
    for (const caminho of ["/professional", "/professional/agenda", "/requests/abc"]) {
      assert.equal(resolveAccountBackHref("tutor", caminho), "/tutor", caminho)
    }
  })

  it("profissional não volta para rota de tutor", () => {
    for (const caminho of ["/tutor", "/tutor/requests", "/discover", "/me/pets"]) {
      assert.equal(resolveAccountBackHref("professional", caminho), "/professional", caminho)
    }
  })

  it("rotas fora de qualquer área autenticada caem na home", () => {
    for (const persona of PERSONAS) {
      for (const caminho of ["/", "/login", "/termos", "/admin", "/partner", "/onboarding"]) {
        assert.equal(resolveAccountBackHref(persona, caminho), accountHomeHref(persona), caminho)
      }
    }
  })

  it("prefixo parecido não conta como área — `/tutorial` não é `/tutor`", () => {
    assert.equal(personaPossuiCaminho("tutor", "/tutorial"), false)
    assert.equal(personaPossuiCaminho("tutor", "/tutor-x"), false)
    assert.equal(personaPossuiCaminho("professional", "/requestsomething"), false)
    assert.equal(resolveAccountBackHref("tutor", "/tutorial"), "/tutor")
  })

  it("barra final não muda a decisão", () => {
    assert.equal(resolveAccountBackHref("tutor", "/tutor/requests/"), "/tutor/requests/")
    assert.equal(personaPossuiCaminho("tutor", "/tutor/"), true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Segurança — returnTo vem da URL
// ─────────────────────────────────────────────────────────────────────────────

describe("returnTo não vira redirect aberto", () => {
  const HOSTIS = [
    "//evil.com",
    "///evil.com",
    "http://evil.com",
    "https://evil.com/tutor",
    "javascript:alert(1)",
    "/\\evil.com",
    "%2F%2Fevil.com",
    "%252F%252Fevil.com",
    "tutor",
    "../tutor",
  ]

  it("toda entrada hostil cai na home da persona", () => {
    for (const persona of PERSONAS) {
      for (const entrada of HOSTIS) {
        assert.equal(
          resolveAccountBackHref(persona, entrada),
          accountHomeHref(persona),
          `${persona} aceitou "${entrada}"`
        )
      }
    }
  })

  it("a validação acontece depois de decodificar, não antes", () => {
    // `%2F%2Fevil.com` decodifica para `//evil.com`. Validar a forma
    // codificada deixaria passar.
    assert.equal(resolveAccountBackHref("tutor", "%2F%2Fevil.com"), "/tutor")
  })

  it("percent-encoding inválido não explode — só recusa", () => {
    assert.equal(resolveAccountBackHref("tutor", "%E0%A4%A"), "/tutor")
    assert.equal(resolveAccountBackHref("tutor", "%"), "/tutor")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sem laço
// ─────────────────────────────────────────────────────────────────────────────

describe("Voltar nunca leva de volta para a própria Conta", () => {
  it("a própria Conta como returnTo cai na home", () => {
    // Acontece de verdade: o menu de conta pode ser aberto de dentro da Conta.
    assert.equal(resolveAccountBackHref("tutor", "/tutor/conta"), "/tutor")
    assert.equal(resolveAccountBackHref("professional", "/professional/conta"), "/professional")
  })

  it("o link para Conta aberto de dentro da Conta não carrega returnTo", () => {
    assert.equal(buildAccountHrefComRetorno("tutor", "/tutor/conta"), "/tutor/conta")
    assert.equal(
      buildAccountHrefComRetorno("professional", "/professional/conta"),
      "/professional/conta"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O link de ida
// ─────────────────────────────────────────────────────────────────────────────

describe("o menu carimba a origem no link de Configurações", () => {
  it("rota da própria área vira returnTo codificado", () => {
    assert.equal(
      buildAccountHrefComRetorno("tutor", "/tutor/requests"),
      "/tutor/conta?returnTo=%2Ftutor%2Frequests"
    )
    assert.equal(
      buildAccountHrefComRetorno("professional", "/requests/abc"),
      "/professional/conta?returnTo=%2Frequests%2Fabc"
    )
  })

  it("ida e volta fecham o ciclo", () => {
    for (const [persona, origem] of [
      ["tutor", "/tutor/requests/abc/diario"],
      ["professional", "/professional/clients/xyz"],
    ] as const) {
      const href = buildAccountHrefComRetorno(persona, origem)
      const returnTo = new URLSearchParams(href.split("?")[1]).get("returnTo")
      assert.equal(resolveAccountBackHref(persona, returnTo ?? undefined), origem)
    }
  })

  it("sem pathname, ou fora da área, o link vai limpo", () => {
    assert.equal(buildAccountHrefComRetorno("tutor", null), "/tutor/conta")
    assert.equal(buildAccountHrefComRetorno("tutor", undefined), "/tutor/conta")
    assert.equal(buildAccountHrefComRetorno("tutor", "/professional"), "/tutor/conta")
    assert.equal(buildAccountHrefComRetorno("tutor", "//evil.com"), "/tutor/conta")
  })

  it("o destino base é a Conta da persona", () => {
    assert.equal(accountHref("tutor"), "/tutor/conta")
    assert.equal(accountHref("professional"), "/professional/conta")
  })
})
