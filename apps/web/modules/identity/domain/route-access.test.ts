/**
 * Classificação de acesso por rota.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CONFLITO QUE ORIGINOU ISTO
 *
 * `/onboarding/partner` é um funil PÚBLICO — quem preenche é um negócio que
 * ainda não tem conta. Mas `/onboarding` inteiro estava na lista de prefixos
 * protegidos, por causa de tutor e profissional, e `startsWith` não separa os
 * três. Visitante anônimo caía em `/login?next=/onboarding/partner`: um funil
 * público atrás de uma parede de login.
 *
 * A metade que importa destes testes são os NÃO-casos. "partner é público"
 * sozinho não diz nada; é "…e tutor continua protegido, e professional
 * continua protegido, e /partner do portal continua protegido" que transforma
 * a exceção em contrato. Uma correção que abrisse `/onboarding` inteiro
 * passaria no primeiro teste e falharia nestes.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  INFRA_PREFIXES,
  PROTECTED_PREFIXES,
  PUBLIC_EXACT_PATHS,
  classifyRoute,
  isPartnerPortalRoute,
  requiresSession,
} from "./route-access.ts"

// ─────────────────────────────────────────────────────────────────────────────
// O caso corrigido
// ─────────────────────────────────────────────────────────────────────────────

describe("/onboarding/partner — público", () => {
  it("visitante anônimo entra sem sessão", () => {
    assert.equal(requiresSession("/onboarding/partner"), false)
    assert.equal(classifyRoute("/onboarding/partner"), "public")
  })

  it("a exceção é EXATA — sub-rota futura não herda acesso público", () => {
    // Liberar por prefixo abriria `/onboarding/partner/qualquer-coisa` sem
    // ninguém decidir isso. Uma sub-rota nova precisa ser adicionada à mão.
    assert.equal(requiresSession("/onboarding/partner/dados"), true)
    assert.equal(requiresSession("/onboarding/partnerX"), true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Os NÃO-casos — o contrato que a exceção não pode quebrar
// ─────────────────────────────────────────────────────────────────────────────

describe("os demais /onboarding continuam protegidos", () => {
  const protegidas = [
    "/onboarding",
    "/onboarding/tutor",
    "/onboarding/tutor/pet",
    "/onboarding/professional",
    "/onboarding/professional/service",
    "/onboarding/professional/availability",
  ]

  for (const rota of protegidas) {
    it(`${rota} exige sessão`, () => {
      assert.equal(requiresSession(rota), true, `${rota} não pode ficar público`)
    })
  }

  it("abrir /onboarding inteiro reprovaria esta suíte", () => {
    // Trava explícita contra a "correção" mais tentadora: tirar /onboarding da
    // lista de protegidos resolveria o sintoma e abriria seis rotas.
    const aindaProtegido = PROTECTED_PREFIXES.includes("/onboarding" as never)
    assert.equal(aindaProtegido, true)
  })
})

describe("demais áreas autenticadas seguem protegidas", () => {
  const protegidas = [
    "/me",
    "/me/pets",
    "/tutor",
    "/tutor/requests",
    "/professional",
    "/professional/metricas",
    "/admin",
    "/admin/invites",
    "/discover",
    "/discover/pro-123",
    "/requests",
    "/pets",
    "/profile",
    "/dashboard",
  ]

  for (const rota of protegidas) {
    it(`${rota} exige sessão`, () => {
      assert.equal(requiresSession(rota), true)
    })
  }
})

describe("portal do parceiro autenticado", () => {
  it("/partner e sub-rotas exigem sessão", () => {
    assert.equal(requiresSession("/partner"), true)
    assert.equal(requiresSession("/partner/dashboard"), true)
    assert.equal(isPartnerPortalRoute("/partner"), true)
    assert.equal(isPartnerPortalRoute("/partner/x"), true)
  })

  it("/partners (listagem pública) NÃO é capturado pelo portal", () => {
    // O prefixo exato existe justamente para não colidir com a rota pública.
    assert.equal(isPartnerPortalRoute("/partners"), false)
    assert.equal(requiresSession("/partners"), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Infra e público
// ─────────────────────────────────────────────────────────────────────────────

describe("infraestrutura passa direto", () => {
  for (const rota of ["/auth/callback", "/api/invite/visit", "/p/pro-123"]) {
    it(`${rota} é infra`, () => {
      assert.equal(classifyRoute(rota), "infra")
      assert.equal(requiresSession(rota), false)
    })
  }

  it("a landing de convite continua aberta — é o ponto do canal", () => {
    assert.equal(requiresSession("/p/qualquer-id"), false)
  })
})

describe("rotas públicas de marketing", () => {
  for (const rota of ["/", "/login", "/sobre", "/como-funciona", "/termos", "/privacidade"]) {
    it(`${rota} não exige sessão`, () => {
      assert.equal(requiresSession(rota), false)
    })
  }

  it("/login é público mas NÃO é infra — o middleware precisa continuar avaliando", () => {
    // Se /login saísse como "infra", o middleware retornaria cedo e o redirect
    // de "já autenticado → /dashboard" deixaria de acontecer. Foi uma regressão
    // real introduzida e revertida durante esta correção.
    assert.equal(classifyRoute("/login"), "public")
    assert.notEqual(classifyRoute("/login"), "infra")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ordem da decisão
// ─────────────────────────────────────────────────────────────────────────────

describe("ordem: infra → exceção exata → prefixo protegido", () => {
  it("a exceção pública vence o prefixo protegido que a contém", () => {
    // `/onboarding/partner` casa com o prefixo protegido `/onboarding`. Só
    // vence porque a exceção é avaliada ANTES.
    assert.ok(PROTECTED_PREFIXES.some((p) => "/onboarding/partner".startsWith(p)))
    assert.equal(requiresSession("/onboarding/partner"), false)
  })

  it("as listas não têm sobreposição acidental com infra", () => {
    for (const infra of INFRA_PREFIXES) {
      assert.ok(
        !PROTECTED_PREFIXES.some((p) => infra.startsWith(p)),
        `${infra} colide com um prefixo protegido`
      )
    }
  })

  it("toda exceção pública exata está sob um prefixo protegido", () => {
    // Uma exceção para rota que já era pública seria ruído — e sinal de que
    // alguém entendeu errado o mecanismo.
    for (const excecao of PUBLIC_EXACT_PATHS) {
      assert.ok(
        PROTECTED_PREFIXES.some((p) => excecao.startsWith(p)),
        `${excecao} não precisa de exceção: já seria público`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Isto NÃO é autorização
// ─────────────────────────────────────────────────────────────────────────────

describe("fronteira de responsabilidade", () => {
  it("classificar rota decide se a UI abre, não o que se pode ler ou mutar", () => {
    // `/onboarding/partner` ser público significa que o formulário carrega.
    // Ler ou alterar um Partner continua exigindo a capability assinada,
    // verificada dentro de cada Server Action — ver
    // modules/partners/application/onboarding-session.ts e a suíte
    // test:partner-capability. Abrir a página e poder operar sobre um parceiro
    // são coisas diferentes, e é por isso que tornar a rota pública não
    // afrouxa nada do servidor.
    assert.equal(requiresSession("/onboarding/partner"), false)
    assert.equal(classifyRoute("/onboarding/partner"), "public")
  })
})
