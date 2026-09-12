/**
 * SA-001 (Superaudit pré-piloto) — shape de `where` que filtra conexões de
 * origem PARTNER não elegível.
 *
 * Não executa contra Prisma/banco (comparação de objeto puro) — este
 * arquivo só importa tipos de `@prisma/client` via `import type`, apagados
 * na transpilação, então roda sob `node --test` sem `DATABASE_URL`.
 *
 * Rodar: node --experimental-strip-types --test modules/trust-graph/domain/partner-eligibility-filter.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS } from "./partner-eligibility-filter.ts"
import { PARTNER_TRUST_ELIGIBLE_WHERE } from "../../partners/domain/trust-eligibility.ts"

describe("ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS", () => {
  it("é exatamente um OR de dois ramos — não-PARTNER passa direto, PARTNER exige elegibilidade", () => {
    assert.deepEqual(ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS, {
      OR: [
        { sourceType: { not: "PARTNER" } },
        { sourceType: "PARTNER", sourcePartner: PARTNER_TRUST_ELIGIBLE_WHERE },
      ],
    })
  })

  it("o ramo PARTNER reusa PARTNER_TRUST_ELIGIBLE_WHERE por referência — nunca uma cópia que pode divergir", () => {
    // Comparação por IDENTIDADE (não deepEqual): se alguém no futuro trocar
    // por um objeto literal reescrito à mão, este teste pega a divergência
    // mesmo que os valores comecem iguais.
    const or = ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS as {
      OR: Array<Record<string, unknown>>
    }
    const ramoPartner = or.OR[1]
    assert.equal(ramoPartner?.sourcePartner, PARTNER_TRUST_ELIGIBLE_WHERE)
  })

  it("o ramo não-PARTNER usa sourceType != 'PARTNER', nunca uma allowlist de TUTOR/PROFESSIONAL que exigiria manutenção a cada novo TrustSourceType", () => {
    const or = ONLY_ELIGIBLE_PARTNER_SOURCED_CONNECTIONS as {
      OR: Array<Record<string, unknown>>
    }
    assert.deepEqual(or.OR[0], { sourceType: { not: "PARTNER" } })
  })
})
