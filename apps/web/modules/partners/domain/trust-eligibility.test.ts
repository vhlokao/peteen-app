/**
 * SA-001 (Superaudit pré-piloto) — elegibilidade de parceiro para produzir
 * efeito de confiança pública.
 *
 * Trava dois contratos:
 *   1. `partnerIsTrustEligible` exige as três condições simultaneamente
 *      (isVerified, verificationStatus === "VERIFIED", isActive) — nenhuma
 *      isolada basta.
 *   2. `PARTNER_TRUST_ELIGIBLE_WHERE` (o shape usado no `where` do Prisma)
 *      nunca diverge de `partnerIsTrustEligible` — um objeto que satisfaz
 *      literalmente o shape precisa ser aceito pela função pura, e mudar
 *      qualquer um dos três campos precisa reprovar nos dois.
 *
 * Rodar: node --experimental-strip-types --test modules/partners/domain/trust-eligibility.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { partnerIsTrustEligible, PARTNER_TRUST_ELIGIBLE_WHERE } from "./trust-eligibility.ts"

function base() {
  return { isVerified: true, verificationStatus: "VERIFIED", isActive: true }
}

describe("partnerIsTrustEligible", () => {
  it("verificado + status VERIFIED + ativo → elegível", () => {
    assert.equal(partnerIsTrustEligible(base()), true)
  })

  it("isVerified=false reprova, mesmo com status VERIFIED e ativo", () => {
    assert.equal(partnerIsTrustEligible({ ...base(), isVerified: false }), false)
  })

  it("verificationStatus diferente de VERIFIED reprova, mesmo com isVerified=true", () => {
    for (const status of ["NONE", "PENDING_VERIFICATION", "REJECTED", ""]) {
      assert.equal(
        partnerIsTrustEligible({ ...base(), verificationStatus: status }),
        false,
        `status "${status}" não deveria ser elegível`
      )
    }
  })

  it("isActive=false reprova, mesmo verificado", () => {
    assert.equal(partnerIsTrustEligible({ ...base(), isActive: false }), false)
  })

  it("nenhuma das três condições sozinha é suficiente", () => {
    assert.equal(
      partnerIsTrustEligible({ isVerified: true, verificationStatus: "NONE", isActive: false }),
      false
    )
    assert.equal(
      partnerIsTrustEligible({ isVerified: false, verificationStatus: "VERIFIED", isActive: true }),
      false
    )
  })
})

describe("PARTNER_TRUST_ELIGIBLE_WHERE — travado em sincronia com partnerIsTrustEligible", () => {
  it("um objeto que satisfaz literalmente o shape é aceito pela função pura", () => {
    assert.equal(partnerIsTrustEligible({ ...PARTNER_TRUST_ELIGIBLE_WHERE }), true)
  })

  it("mudar qualquer campo do shape reprova nos dois — nunca diverge", () => {
    for (const campo of Object.keys(PARTNER_TRUST_ELIGIBLE_WHERE) as Array<
      keyof typeof PARTNER_TRUST_ELIGIBLE_WHERE
    >) {
      const violado = { ...PARTNER_TRUST_ELIGIBLE_WHERE }
      if (typeof violado[campo] === "boolean") {
        // @ts-expect-error -- mutação deliberada para o teste negativo
        violado[campo] = !violado[campo]
      } else {
        // @ts-expect-error -- mutação deliberada para o teste negativo
        violado[campo] = "OUTRO_VALOR"
      }
      assert.equal(
        partnerIsTrustEligible(violado),
        false,
        `violar "${campo}" deveria reprovar`
      )
    }
  })

  it("o shape tem exatamente os três campos do predicado — nenhum a mais, nenhum a menos", () => {
    assert.deepEqual(
      Object.keys(PARTNER_TRUST_ELIGIBLE_WHERE).sort(),
      ["isActive", "isVerified", "verificationStatus"]
    )
  })
})
