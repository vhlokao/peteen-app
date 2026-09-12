/**
 * Testes focados — prazo efetivo de resposta de ServiceRequest.
 *
 * Runner: node:test nativo (mesmo padrão de lib/date/agenda-temporal.test.ts
 * e lib/storage/pet-photo-signature.test.ts).
 * Rodar: node --experimental-strip-types --test modules/service-request/domain/request-expiry.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  calculateEffectiveExpiry,
  getRequestExpiryInfo,
  isRequestExpired,
  PENDING_MAX_AGE_HOURS,
  SCHEDULED_SAFETY_MARGIN_HOURS,
} from "./request-expiry.ts"

const HOUR_MS = 60 * 60 * 1000
const CREATED_AT = new Date("2026-08-01T10:00:00.000Z")

function hoursAfterCreation(hours: number): Date {
  return new Date(CREATED_AT.getTime() + hours * HOUR_MS)
}

const MINUTE_MS = 60 * 1000

function minutesAfterCreation(minutes: number): Date {
  return new Date(CREATED_AT.getTime() + minutes * MINUTE_MS)
}

/** Janela de aceite em minutos: distância entre createdAt e o prazo efetivo. */
function janelaEmMinutos(scheduledAt: Date): number {
  const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
  return (expiry.getTime() - CREATED_AT.getTime()) / MINUTE_MS
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateEffectiveExpiry
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateEffectiveExpiry", () => {
  it("scheduledAt null → createdAt + 24h", () => {
    const expiry = calculateEffectiveExpiry(CREATED_AT, null)
    assert.equal(expiry.getTime(), hoursAfterCreation(PENDING_MAX_AGE_HOURS).getTime())
  })

  it("atendimento futuro distante (semanas) → limitado por createdAt + 24h", () => {
    const scheduledAt = hoursAfterCreation(24 * 30) // 30 dias no futuro
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), hoursAfterCreation(24).getTime())
  })

  it("atendimento no mesmo dia (6h depois) → scheduledAt - 1h", () => {
    const scheduledAt = hoursAfterCreation(6)
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), hoursAfterCreation(5).getTime())
  })

  it("scheduledAt exatamente 1h após createdAt → janela = gap inteiro = margem (SA-013)", () => {
    // Fronteira das duas primeiras faixas de margemEfetivaMs: gap == margem.
    // Antes da correção SA-013, isto caía no "ramo normal" e devolvia
    // expiry = createdAt (janela = 0min) — o próprio penhasco que a
    // Superaudit encontrou executando a função real. Agora a margem
    // efetiva satura em 0 exatamente neste ponto (clamp(0,0,margem)=0),
    // então a janela continua sendo o gap inteiro, igual à faixa anterior.
    const scheduledAt = hoursAfterCreation(1)
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), scheduledAt.getTime())
    assert.equal(janelaEmMinutos(scheduledAt), 60)
  })

  it("scheduledAt a menos de 1h da criação (30min) → usa o próprio scheduledAt", () => {
    const scheduledAt = hoursAfterCreation(0.5)
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), scheduledAt.getTime())
  })

  it("scheduledAt igual à criação (gap = 0) → usa o próprio scheduledAt", () => {
    const scheduledAt = new Date(CREATED_AT.getTime())
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), scheduledAt.getTime())
  })

  it("scheduledAt no passado (antes de createdAt) → usa o próprio scheduledAt", () => {
    const scheduledAt = hoursAfterCreation(-2)
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    assert.equal(expiry.getTime(), scheduledAt.getTime())
  })

  it("margem de segurança configurada é 1h", () => {
    assert.equal(SCHEDULED_SAFETY_MARGIN_HOURS, 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SA-013 — MATRIZ DE FRONTEIRA (penhasco de ~60min corrigido)
//
// Executa a função REAL numa varredura de antecedências ao redor da margem
// (1h = 60min), a mesma técnica usada pela Superaudit para provar o defeito.
// A janela (minutos entre createdAt e o prazo efetivo) precisa ser:
//   - contínua e não-decrescente em toda a varredura;
//   - nunca <= 0 para nenhum gap >= antecedência mínima de criação (15min);
//   - um platô constante de 60min (a margem cheia) para gap em [60min, 120min]
//     — é exatamente a faixa onde a fórmula antiga produzia o penhasco.
// ─────────────────────────────────────────────────────────────────────────────

describe("SA-013 — janela de aceite ao redor da margem de 1h", () => {
  const CASOS: Array<{ gapMin: number; janelaEsperadaMin: number }> = [
    { gapMin: 15, janelaEsperadaMin: 15 }, // antecedência mínima de criação
    { gapMin: 45, janelaEsperadaMin: 45 },
    { gapMin: 59, janelaEsperadaMin: 59 },
    { gapMin: 60, janelaEsperadaMin: 60 }, // fronteira: penhasco antigo (era 0)
    { gapMin: 61, janelaEsperadaMin: 60 }, // platô: antigo era 1
    { gapMin: 65, janelaEsperadaMin: 60 }, // platô: antigo era 5
    { gapMin: 75, janelaEsperadaMin: 60 }, // platô: antigo era 15
    { gapMin: 90, janelaEsperadaMin: 60 }, // platô: antigo era 30
    { gapMin: 120, janelaEsperadaMin: 60 }, // fim do platô: antigo já era 60 aqui
  ]

  for (const { gapMin, janelaEsperadaMin } of CASOS) {
    it(`gap=+${gapMin}min → janela=${janelaEsperadaMin}min`, () => {
      const scheduledAt = minutesAfterCreation(gapMin)
      assert.equal(janelaEmMinutos(scheduledAt), janelaEsperadaMin)
    })
  }

  it("nenhum gap permitido pelo produto (>= antecedência mínima de 15min) produz janela <= 0", () => {
    // Varre em passos de 1min de 15min (antecedência mínima real de
    // criação — request-lead-time.ts, inalterada nesta missão) até 4h,
    // cobrindo toda a região que antes tinha o penhasco e a que vem depois.
    for (let min = 15; min <= 240; min++) {
      const janela = janelaEmMinutos(minutesAfterCreation(min))
      assert.ok(janela > 0, `gap=+${min}min produziu janela=${janela}min (<=0)`)
    }
  })

  it("a janela é monotônica não-decrescente em toda a varredura de 0 a 4h — sem cliff", () => {
    let anterior = janelaEmMinutos(minutesAfterCreation(0))
    for (let min = 1; min <= 240; min++) {
      const atual = janelaEmMinutos(minutesAfterCreation(min))
      assert.ok(
        atual >= anterior,
        `janela caiu de ${anterior}min (gap=+${min - 1}min) para ${atual}min (gap=+${min}min)`
      )
      anterior = atual
    }
  })

  it("o platô de 60min termina em +120min — depois disso a janela volta a crescer (gap - margem)", () => {
    assert.equal(janelaEmMinutos(minutesAfterCreation(120)), 60)
    assert.equal(janelaEmMinutos(minutesAfterCreation(150)), 90) // gap=150 → 150-60=90
    assert.equal(janelaEmMinutos(minutesAfterCreation(180)), 120) // gap=180 → 180-60=120
  })

  it("expiry nunca ultrapassa scheduledAt, em toda a varredura (defesa em profundidade)", () => {
    for (let min = 0; min <= 240; min += 5) {
      const scheduledAt = minutesAfterCreation(min)
      const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
      assert.ok(
        expiry.getTime() <= scheduledAt.getTime(),
        `expiry ultrapassou scheduledAt em gap=+${min}min`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getRequestExpiryInfo / isRequestExpired — limites exatos
// ─────────────────────────────────────────────────────────────────────────────

describe("getRequestExpiryInfo", () => {
  it("exatamente no limite (now === effectiveExpiry) → expirada", () => {
    const now = hoursAfterCreation(PENDING_MAX_AGE_HOURS)
    const info = getRequestExpiryInfo(CREATED_AT, null, now)
    assert.equal(info.isExpired, true)
    assert.equal(info.msRemaining, null)
  })

  it("um milissegundo antes do limite → ainda válida", () => {
    const now = new Date(hoursAfterCreation(PENDING_MAX_AGE_HOURS).getTime() - 1)
    const info = getRequestExpiryInfo(CREATED_AT, null, now)
    assert.equal(info.isExpired, false)
    assert.equal(info.msRemaining, 1)
  })

  it("um milissegundo depois do limite → expirada", () => {
    const now = new Date(hoursAfterCreation(PENDING_MAX_AGE_HOURS).getTime() + 1)
    const info = getRequestExpiryInfo(CREATED_AT, null, now)
    assert.equal(info.isExpired, true)
  })

  it("scheduledAt no passado → expira imediatamente, mesmo 'agora' sendo createdAt", () => {
    const scheduledAt = hoursAfterCreation(-2)
    const info = getRequestExpiryInfo(CREATED_AT, scheduledAt, CREATED_AT)
    assert.equal(info.isExpired, true)
  })

  it("now >= scheduledAt bloqueia mesmo quando effectiveExpiry (teoricamente) ainda não foi alcançado", () => {
    // Cenário defensivo: scheduledAt no mesmo instante do limite calculado.
    // Confirma que a checagem por scheduledAt nunca diverge da checagem por
    // effectiveExpiry (são a mesma coisa quando gap < 1h).
    const scheduledAt = hoursAfterCreation(0.5)
    const info = getRequestExpiryInfo(CREATED_AT, scheduledAt, scheduledAt)
    assert.equal(info.isExpired, true)
  })

  it("dentro do prazo com scheduledAt no mesmo dia → não expirada e msRemaining correto", () => {
    const scheduledAt = hoursAfterCreation(6) // expiry = createdAt + 5h
    const now = hoursAfterCreation(3)
    const info = getRequestExpiryInfo(CREATED_AT, scheduledAt, now)
    assert.equal(info.isExpired, false)
    assert.equal(info.msRemaining, 2 * HOUR_MS)
  })
})

describe("isRequestExpired", () => {
  it("é equivalente a getRequestExpiryInfo(...).isExpired", () => {
    const scheduledAt = hoursAfterCreation(10)
    const now = hoursAfterCreation(9.5)
    assert.equal(
      isRequestExpired(CREATED_AT, scheduledAt, now),
      getRequestExpiryInfo(CREATED_AT, scheduledAt, now).isExpired
    )
  })
})
