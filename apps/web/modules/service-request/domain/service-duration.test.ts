/**
 * Testes focados — Service Duration Integrity (parte pura).
 *
 * Runner: node:test nativo. Rodar:
 *   node --experimental-strip-types --test modules/service-request/domain/service-duration.test.ts
 *
 * Cobre os cenários 6–11 e 17–19 da missão (validação de duração e
 * elegibilidade por tipo de serviço). Os cenários que dependem de banco —
 * aceite, gate de criação, snapshot 60→90, regra de remoção, concorrência —
 * foram verificados ao vivo; ver evidência na entrega.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  isReliableServiceDuration,
  canReceiveTimedBooking,
  timedBookingBlockReason,
  ServiceDurationRequiredError,
} from "./service-duration.ts"
import { SERVICE_DURATION_LIMITS } from "../../professional/domain/types.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Cenários 6–11 — validação da duração
// ─────────────────────────────────────────────────────────────────────────────

describe("isReliableServiceDuration", () => {
  it("11. limites exatos são válidos", () => {
    assert.equal(isReliableServiceDuration(SERVICE_DURATION_LIMITS.MIN_MINUTES), true)
    assert.equal(isReliableServiceDuration(SERVICE_DURATION_LIMITS.MAX_MINUTES), true)
    assert.equal(isReliableServiceDuration(5), true)
    assert.equal(isReliableServiceDuration(1440), true)
  })

  it("valores intermediários típicos são válidos", () => {
    for (const v of [15, 30, 45, 60, 90, 120, 480]) {
      assert.equal(isReliableServiceDuration(v), true, `${v} deveria ser válido`)
    }
  })

  it("6. zero é inválido", () => {
    assert.equal(isReliableServiceDuration(0), false)
  })

  it("7. negativo é inválido", () => {
    assert.equal(isReliableServiceDuration(-1), false)
    assert.equal(isReliableServiceDuration(-60), false)
  })

  it("8. decimal é inválido", () => {
    assert.equal(isReliableServiceDuration(30.5), false)
    assert.equal(isReliableServiceDuration(59.999), false)
  })

  it("9. abaixo do mínimo é inválido", () => {
    assert.equal(isReliableServiceDuration(4), false)
    assert.equal(isReliableServiceDuration(1), false)
  })

  it("10. acima do máximo é inválido", () => {
    assert.equal(isReliableServiceDuration(1441), false)
    assert.equal(isReliableServiceDuration(10_000), false)
  })

  it("null e undefined são inválidos (serviço sem duração)", () => {
    assert.equal(isReliableServiceDuration(null), false)
    assert.equal(isReliableServiceDuration(undefined), false)
  })

  it("NaN e Infinity são inválidos", () => {
    assert.equal(isReliableServiceDuration(NaN), false)
    assert.equal(isReliableServiceDuration(Infinity), false)
    assert.equal(isReliableServiceDuration(-Infinity), false)
  })

  it("usa SERVICE_DURATION_LIMITS como fonte única — sem segunda definição", () => {
    // Se alguém redefinir os limites em outro lugar, este teste continua
    // passando aqui mas o de cadastro divergiria. A garantia real é o import:
    // este módulo NÃO declara números próprios.
    assert.equal(isReliableServiceDuration(SERVICE_DURATION_LIMITS.MIN_MINUTES - 1), false)
    assert.equal(isReliableServiceDuration(SERVICE_DURATION_LIMITS.MAX_MINUTES + 1), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenários 17–19 — elegibilidade a agendamento com horário
// ─────────────────────────────────────────────────────────────────────────────

describe("canReceiveTimedBooking", () => {
  it("17. OTHER com duração válida é elegível", () => {
    assert.equal(canReceiveTimedBooking({ serviceType: "OTHER", defaultDurationMin: 60 }), true)
  })

  it("18. OTHER sem duração é inelegível", () => {
    assert.equal(canReceiveTimedBooking({ serviceType: "OTHER", defaultDurationMin: null }), false)
  })

  it("19. BOARDING sem duração é inelegível", () => {
    assert.equal(canReceiveTimedBooking({ serviceType: "BOARDING", defaultDurationMin: null }), false)
  })

  it("BOARDING COM duração explícita é elegível — número é do profissional", () => {
    assert.equal(canReceiveTimedBooking({ serviceType: "BOARDING", defaultDurationMin: 1440 }), true)
  })

  it("a regra é uniforme: nenhum serviceType tem exceção", () => {
    const tipos = [
      "DOG_WALK", "PET_SITTING", "BOARDING", "GROOMING",
      "TRAINING", "VET_ACCOMPANY", "DAY_CARE", "HOME_CARE", "OTHER",
    ]
    for (const serviceType of tipos) {
      assert.equal(canReceiveTimedBooking({ serviceType, defaultDurationMin: 60 }), true, `${serviceType} com 60min`)
      assert.equal(canReceiveTimedBooking({ serviceType, defaultDurationMin: null }), false, `${serviceType} sem duração`)
    }
  })

  it("duração inválida no banco (fora dos limites) não torna elegível", () => {
    // Não há constraint no banco: uma linha pode conter 2 ou 5000.
    assert.equal(canReceiveTimedBooking({ serviceType: "DOG_WALK", defaultDurationMin: 2 }), false)
    assert.equal(canReceiveTimedBooking({ serviceType: "DOG_WALK", defaultDurationMin: 5000 }), false)
  })

  it("campo ausente é tratado como sem duração", () => {
    assert.equal(canReceiveTimedBooking({ serviceType: "DOG_WALK" }), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Motivo do bloqueio — decide a mensagem, sem culpar o profissional
// ─────────────────────────────────────────────────────────────────────────────

describe("timedBookingBlockReason", () => {
  it("elegível → null (nenhum motivo)", () => {
    assert.equal(timedBookingBlockReason({ serviceType: "DOG_WALK", defaultDurationMin: 45 }), null)
    assert.equal(timedBookingBlockReason({ serviceType: "BOARDING", defaultDurationMin: 1440 }), null)
  })

  it("BOARDING sem duração → limitação de PRODUTO (não culpa o profissional)", () => {
    assert.equal(
      timedBookingBlockReason({ serviceType: "BOARDING", defaultDurationMin: null }),
      "PRODUCT_LIMITATION"
    )
  })

  it("demais tipos sem duração → configuração ausente", () => {
    for (const serviceType of ["DOG_WALK", "GROOMING", "OTHER", "DAY_CARE"]) {
      assert.equal(
        timedBookingBlockReason({ serviceType, defaultDurationMin: null }),
        "MISSING_DURATION",
        serviceType
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Erro de domínio
// ─────────────────────────────────────────────────────────────────────────────

describe("ServiceDurationRequiredError", () => {
  it("é Error com nome próprio e carrega ids técnicos", () => {
    const err = new ServiceDurationRequiredError("pro-123", "DOG_WALK")
    assert.ok(err instanceof Error)
    assert.ok(err instanceof ServiceDurationRequiredError)
    assert.equal(err.name, "ServiceDurationRequiredError")
    assert.equal(err.professionalId, "pro-123")
    assert.equal(err.serviceType, "DOG_WALK")
  })

  it("não vaza PII na mensagem — só ids técnicos e tipo de serviço", () => {
    const err = new ServiceDurationRequiredError("pro-123", "GROOMING")
    assert.match(err.message, /pro-123/)
    assert.match(err.message, /GROOMING/)
    // Nada de nome, e-mail, pet ou descrição pode aparecer: a mensagem é
    // construída só com os dois parâmetros técnicos.
    assert.equal(err.message.includes("@"), false)
  })

  it("distinguível de outros erros", () => {
    assert.ok(!(new Error("outro") instanceof ServiceDurationRequiredError))
  })
})
