/**
 * GATE-12-PROFESSIONAL-SHARE-INVITE-E2E-001 — o contexto do profissional
 * sobrevive de ponta a ponta?
 *
 * Este arquivo PERCORRE a jornada em vez de testar funções soltas: cada
 * cenário da missão (A a E) é uma sequência de saltos, e cada salto usa a
 * MESMA função pura que a rota real usa. Se um salto perder o `/p/<id>`, o
 * cenário quebra aqui — que era exatamente o tipo de perda que só aparecia
 * abrindo o produto com quatro sessões diferentes.
 *
 * O que este arquivo NÃO prova: a troca de code por sessão no Supabase e os
 * guards que dependem de banco. Esses estão listados no QA físico do RESULT.
 *
 * Rodar: npm run test:invite
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildInviteProfessionalHref,
  OUTRA_PERSONA_DETALHE,
  resolveInviteCta,
  type InviteViewer,
} from "./invite-cta.ts"
import { buildInviteLandingPath } from "./invite-visit.ts"
import {
  onboardingConclusionCopy,
  parseNextParam,
  resolveOnboardingDestination,
  terminaEmConvite,
  withNext,
} from "./onboarding-next.ts"
import { isSafeRedirectPath } from "../../identity/domain/safe-redirect.ts"
import { resolvePostLoginDestination } from "../../identity/domain/post-login-destination.ts"
import { resolvePublicPageBackLink } from "../../partner-portal/domain/navigation.ts"

const PRO = "cmqishhuf0001t4sckixc5mdg"
const LANDING = `/p/${PRO}`

const ANONIMO: InviteViewer = { authenticated: false, isTutor: false, primaryRole: null }
const SEM_PERSONA: InviteViewer = { authenticated: true, isTutor: false, primaryRole: null }
const TUTOR: InviteViewer = { authenticated: true, isTutor: true, primaryRole: "TUTOR" }
const PROFISSIONAL: InviteViewer = {
  authenticated: true,
  isTutor: false,
  primaryRole: "PROFESSIONAL",
}

/** Extrai o `next` de uma URL de saída, como a rota de destino faria. */
function nextDe(href: string): string | null {
  const query = href.split("?")[1]
  if (!query) return null
  return parseNextParam(new URLSearchParams(query).get("next") ?? undefined)
}

/**
 * Simula `/auth/callback`: `next` seguro vence a persona.
 * Espelha app/auth/callback/route.ts, que não roda sob `node --test` por
 * importar `next/server`.
 */
function callback(next: string | null, persona: Parameters<typeof resolvePostLoginDestination>[0]) {
  return isSafeRedirectPath(next) ? next : resolvePostLoginDestination(persona)
}

const SEM_NENHUMA_PERSONA = {
  activePrimaryRole: null,
  adminProfile: null,
  partnerProfile: null,
  professionalProfile: null,
  tutorProfile: null,
}
const JA_TUTOR = { ...SEM_NENHUMA_PERSONA, activePrimaryRole: "TUTOR" }

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO A — novo tutor via Google
// ─────────────────────────────────────────────────────────────────────────────

describe("A — novo tutor pelo Google chega ao MESMO profissional", () => {
  it("a jornada inteira preserva /p/<id>, salto a salto", () => {
    // 1. Visitante anônimo abre a landing.
    const cta = resolveInviteCta(ANONIMO, PRO)
    assert.equal(cta.kind, "login")
    assert.equal(cta.href, `/login?next=${encodeURIComponent(LANDING)}`)

    // 2. `/login` lê o next e o repassa ao provedor (buildMagicLinkRedirectUrl
    //    usa o mesmo isSafeRedirectPath nas duas vias — Google e Magic Link).
    const nextNoLogin = nextDe(cta.href!)
    assert.equal(nextNoLogin, LANDING)
    assert.equal(isSafeRedirectPath(nextNoLogin), true)

    // 3. `/auth/callback` — usuário novo, sem nenhuma persona. O `next` vence
    //    o destino de persona (que seria /onboarding).
    assert.equal(callback(nextNoLogin, SEM_NENHUMA_PERSONA), LANDING)
    assert.equal(resolvePostLoginDestination(SEM_NENHUMA_PERSONA), "/onboarding")

    // 4. De volta à landing, agora autenticado e sem persona.
    const cta2 = resolveInviteCta(SEM_PERSONA, PRO)
    assert.equal(cta2.kind, "criar-tutor")
    assert.equal(cta2.href, `/onboarding/tutor?next=${encodeURIComponent(LANDING)}`)

    // 5. Onboarding: perfil → pet, carregando o next em cada etapa.
    const nextOnboarding = nextDe(cta2.href!)
    assert.equal(nextOnboarding, LANDING)
    const passoPet = withNext("/onboarding/tutor/pet", nextOnboarding)
    assert.equal(passoPet, `/onboarding/tutor/pet?next=${encodeURIComponent(LANDING)}`)
    assert.equal(parseNextParam(new URLSearchParams(passoPet.split("?")[1]).get("next")!), LANDING)

    // 6. Fim do onboarding — volta para o convite, não para o Discovery.
    assert.equal(resolveOnboardingDestination(nextOnboarding), LANDING)

    // 7. Landing outra vez, agora como tutor: segue para o profissional.
    const cta3 = resolveInviteCta(TUTOR, PRO)
    assert.equal(cta3.kind, "continuar")
    assert.ok(cta3.href!.startsWith(`/discover/${PRO}`))
  })

  it("o destino final NUNCA é o Discovery genérico", () => {
    const destino = resolveOnboardingDestination(LANDING)
    assert.notEqual(destino, "/discover")
    assert.equal(destino, LANDING)
  })

  it("sem convite, o Gate 6 continua valendo: tutor vai para /tutor", () => {
    assert.equal(callback(null, JA_TUTOR), "/tutor")
    assert.equal(resolveOnboardingDestination(null), "/discover")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO B — Magic Link
// ─────────────────────────────────────────────────────────────────────────────

describe("B — Magic Link percorre exatamente o mesmo caminho", () => {
  it("as duas vias entram no callback com o mesmo next", () => {
    // `signInWithGoogle` e `signInWithMagicLink` chamam o MESMO
    // buildMagicLinkRedirectUrl, que valida com isSafeRedirectPath. Do ponto de
    // vista do contexto, as duas vias são indistinguíveis a partir daqui.
    const next = nextDe(resolveInviteCta(ANONIMO, PRO).href!)
    assert.equal(callback(next, SEM_NENHUMA_PERSONA), LANDING)
  })

  it("um next hostil não sobrevive a nenhuma das vias", () => {
    for (const hostil of ["//evil.com", "https://evil.com", "http://evil.com/p/x"]) {
      assert.equal(isSafeRedirectPath(hostil), false, hostil)
      assert.equal(callback(hostil, SEM_NENHUMA_PERSONA), "/onboarding", hostil)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO C — tutor existente
// ─────────────────────────────────────────────────────────────────────────────

describe("C — tutor existente permanece vinculado ao profissional certo", () => {
  it("vai direto ao profissional, sem passar pelo Discovery", () => {
    const cta = resolveInviteCta(TUTOR, PRO)
    assert.equal(cta.kind, "continuar")
    assert.match(cta.href!, new RegExp(`^/discover/${PRO}(\\?|$)`))
    assert.equal(cta.label, "Solicitar atendimento")
  })

  it("o link carrega a volta para o convite", () => {
    const href = buildInviteProfessionalHref(PRO)
    const returnTo = new URLSearchParams(href.split("?")[1]).get("returnTo")
    assert.equal(returnTo, LANDING)
  })

  it("o Voltar do perfil resolve para o convite — não para /discover", () => {
    // ANTES: sem returnTo, `resolvePublicPageBackLink` devolvia null e o
    // BackButton caía no fallbackHref="/discover" — a busca genérica, com
    // todos os concorrentes de quem convidou.
    assert.equal(resolvePublicPageBackLink({}), null)

    const back = resolvePublicPageBackLink({ returnTo: LANDING })
    assert.ok(back, "o convite continua não sendo um destino de volta válido")
    assert.equal(back!.href, LANDING)
  })

  it("o id do profissional atravessa o ciclo sem se perder", () => {
    const back = resolvePublicPageBackLink({
      returnTo: new URLSearchParams(
        buildInviteProfessionalHref(PRO).split("?")[1]
      ).get("returnTo")!,
    })
    assert.equal(back!.href, buildInviteLandingPath(PRO))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO D — refresh / deep link
// ─────────────────────────────────────────────────────────────────────────────

describe("D — refresh e deep link não apagam o contexto", () => {
  it("o contexto vive na URL, então refresh é idempotente em cada etapa", () => {
    const etapas = [
      `/onboarding/tutor?next=${encodeURIComponent(LANDING)}`,
      `/onboarding/tutor/pet?next=${encodeURIComponent(LANDING)}`,
    ]
    for (const etapa of etapas) {
      const next = nextDe(etapa)
      assert.equal(next, LANDING, etapa)
      // Reprocessar a mesma URL devolve a mesma coisa — sem estado de servidor.
      assert.equal(nextDe(etapa), next, etapa)
    }
  })

  it("a landing re-decide a cada visita, em vez de pré-calcular a jornada", () => {
    // A mesma URL, três sessões diferentes, três próximos passos corretos.
    assert.equal(resolveInviteCta(ANONIMO, PRO).kind, "login")
    assert.equal(resolveInviteCta(SEM_PERSONA, PRO).kind, "criar-tutor")
    assert.equal(resolveInviteCta(TUTOR, PRO).kind, "continuar")
  })

  it("entrar pelo meio do fluxo não quebra: todo next aponta para a âncora", () => {
    for (const viewer of [ANONIMO, SEM_PERSONA]) {
      const href = resolveInviteCta(viewer, PRO).href!
      assert.equal(nextDe(href), LANDING, JSON.stringify(viewer))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO E — Back
// ─────────────────────────────────────────────────────────────────────────────

describe("E — Back não cria laço nem troca de persona", () => {
  it("o Voltar do perfil leva ao convite, e o convite não volta para o perfil", () => {
    const back = resolvePublicPageBackLink({ returnTo: LANDING })!
    assert.equal(back.href, LANDING)
    // Da landing, o próximo passo do tutor é o perfil — um ciclo de duas telas
    // que a pessoa controla, não um redirect automático de ida e volta.
    assert.ok(resolveInviteCta(TUTOR, PRO).href!.startsWith("/discover/"))
  })

  it("um returnTo de outra persona não é aceito como volta do convite", () => {
    // A landing é de tutor. Um returnTo apontando para área de profissional
    // não pode virar a volta desta tela.
    const back = resolvePublicPageBackLink({ returnTo: "/professional/agenda" })
    assert.notEqual(back?.href, LANDING)
  })

  it("returnTo hostil nunca vira destino", () => {
    for (const hostil of ["//evil.com", "https://evil.com/p/x", "javascript:alert(1)"]) {
      const back = resolvePublicPageBackLink({ returnTo: hostil })
      assert.ok(back === null || back.href.startsWith("/"), hostil)
      assert.ok(!(back?.href ?? "").includes("evil.com"), hostil)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O caso que faltava — autenticado com OUTRA persona
// ─────────────────────────────────────────────────────────────────────────────

describe("autenticado com outra persona não recebe um CTA que mente", () => {
  it("não há href — o botão desaparece em vez de levar ao painel da pessoa", () => {
    const cta = resolveInviteCta(PROFISSIONAL, PRO)
    assert.equal(cta.kind, "outra-persona")
    assert.equal(cta.href, null)
    assert.equal(cta.label, null)
  })

  it("vale para toda persona que não seja tutor", () => {
    for (const role of ["PROFESSIONAL", "PARTNER", "ADMIN"]) {
      const cta = resolveInviteCta(
        { authenticated: true, isTutor: false, primaryRole: role },
        PRO
      )
      assert.equal(cta.kind, "outra-persona", role)
      assert.equal(cta.href, null, role)
    }
  })

  it("a explicação diz o que fazer, sem prometer ação que não existe", () => {
    assert.match(OUTRA_PERSONA_DETALHE, /tutor/i)
    assert.doesNotMatch(OUTRA_PERSONA_DETALHE, /em breve|aguarde/i)
  })

  it("nenhum outro estado perdeu o CTA", () => {
    for (const viewer of [ANONIMO, SEM_PERSONA, TUTOR]) {
      const cta = resolveInviteCta(viewer, PRO)
      assert.ok(cta.href, JSON.stringify(viewer))
      assert.ok(cta.label, JSON.stringify(viewer))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A copy do fim do onboarding
// ─────────────────────────────────────────────────────────────────────────────

describe("a conclusão do cadastro não oferece busca genérica a quem veio por convite", () => {
  it("com convite, o botão fala em voltar ao profissional", () => {
    assert.equal(terminaEmConvite(LANDING), true)
    const copy = onboardingConclusionCopy(LANDING)
    assert.match(copy.cta, /voltar ao profissional/i)
    assert.doesNotMatch(copy.cta, /encontrar/i)
    assert.doesNotMatch(copy.descricao, /encontrar quem/i)
  })

  it("sem convite, a copy de sempre continua intacta", () => {
    assert.equal(terminaEmConvite(null), false)
    const copy = onboardingConclusionCopy(null)
    assert.equal(copy.cta, "Encontrar profissional")
    assert.match(copy.descricao, /encontrar quem cuida/i)
  })

  it("um next hostil não é tratado como convite", () => {
    for (const hostil of ["//evil.com/p/x", "https://evil.com/p/x"]) {
      assert.equal(terminaEmConvite(hostil), false, hostil)
      assert.equal(onboardingConclusionCopy(hostil).cta, "Encontrar profissional", hostil)
    }
  })

  it("a copy acompanha o destino real — nunca discorda dele", () => {
    for (const next of [LANDING, null, "/tutor/requests", "//evil.com"]) {
      const destino = resolveOnboardingDestination(next as string | null)
      const copy = onboardingConclusionCopy(next as string | null)
      const falaEmVoltar = /voltar ao profissional/i.test(copy.cta)
      assert.equal(falaEmVoltar, destino.startsWith("/p/"), String(next))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Segurança do contexto
// ─────────────────────────────────────────────────────────────────────────────

describe("todo contexto vindo de URL é validado", () => {
  it("o next gerado pela landing é sempre um caminho interno", () => {
    for (const viewer of [ANONIMO, SEM_PERSONA]) {
      const next = nextDe(resolveInviteCta(viewer, PRO).href!)
      assert.equal(isSafeRedirectPath(next), true)
      assert.ok(next!.startsWith("/p/"))
    }
  })

  it("parseNextParam recusa tudo que não seja caminho interno", () => {
    for (const hostil of ["//evil.com", "https://evil.com", "javascript:alert(1)", "evil"]) {
      assert.equal(parseNextParam(hostil), null, hostil)
    }
  })

  it("withNext não anexa contexto vazio", () => {
    assert.equal(withNext("/onboarding/tutor/pet", null), "/onboarding/tutor/pet")
  })

  it("o id do profissional é codificado no next — nada de query injection", () => {
    const cta = resolveInviteCta(ANONIMO, "abc?x=1&y=2")
    assert.ok(!cta.href!.includes("&y=2"), "id vazou como parâmetro extra")
    assert.equal(nextDe(cta.href!), "/p/abc?x=1&y=2")
  })
})
