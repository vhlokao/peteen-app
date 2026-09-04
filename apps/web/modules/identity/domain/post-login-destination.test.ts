/**
 * Testes focados — destino pós-login por persona (GATE-6-TUTOR-POSTLOGIN-001).
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/identity/domain/post-login-destination.test.ts
 *
 * Só função pura — nenhum acesso a banco, rede ou Next.js. `next` (quando
 * seguro) é resolvido ANTES desta função pelo chamador (isSafeRedirectPath);
 * aqui só o default por persona é exercitado.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { resolvePostLoginDestination, PERSONA_REDIRECTS } from "./post-login-destination.ts"

const NONE = null

describe("resolvePostLoginDestination", () => {
  it("usuário inexistente (sync falhou) → onboarding", () => {
    assert.equal(resolvePostLoginDestination(null), "/onboarding")
  })

  it("sem nenhuma persona → onboarding (usuário novo)", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: NONE,
        tutorProfile: NONE,
      }),
      "/onboarding"
    )
  })

  it("GATE-6: Tutor só com TutorProfile → /tutor, não /discover", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: NONE,
        tutorProfile: { id: "tutor-1" },
      }),
      PERSONA_REDIRECTS.TUTOR
    )
    assert.equal(PERSONA_REDIRECTS.TUTOR, "/tutor")
  })

  it("Professional só com ProfessionalProfile → /requests", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: { id: "pro-1" },
        tutorProfile: NONE,
      }),
      "/requests"
    )
  })

  it("Partner só com PartnerProfile → /partner", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: NONE,
        partnerProfile: { id: "partner-1" },
        professionalProfile: NONE,
        tutorProfile: NONE,
      }),
      "/partner"
    )
  })

  it("Admin só com AdminProfile → /admin", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: { id: "admin-1" },
        partnerProfile: NONE,
        professionalProfile: NONE,
        tutorProfile: NONE,
      }),
      "/admin"
    )
  })

  it("activePrimaryRole explícito vence a inferência por perfil (multi-persona)", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: "PROFESSIONAL",
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: { id: "pro-1" },
        tutorProfile: { id: "tutor-1" },
      }),
      "/requests"
    )
  })

  it("activePrimaryRole = TUTOR em multi-persona → /tutor", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: "TUTOR",
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: { id: "pro-1" },
        tutorProfile: { id: "tutor-1" },
      }),
      "/tutor"
    )
  })

  it("activePrimaryRole com valor inesperado/corrompido → onboarding (fallback seguro)", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: "NOT_A_REAL_ROLE",
        adminProfile: NONE,
        partnerProfile: NONE,
        professionalProfile: NONE,
        tutorProfile: { id: "tutor-1" },
      }),
      "/onboarding"
    )
  })

  it("prioridade de inferência sem activePrimaryRole: admin > partner > professional > tutor", () => {
    assert.equal(
      resolvePostLoginDestination({
        activePrimaryRole: null,
        adminProfile: { id: "admin-1" },
        partnerProfile: { id: "partner-1" },
        professionalProfile: { id: "pro-1" },
        tutorProfile: { id: "tutor-1" },
      }),
      "/admin"
    )
  })
})
