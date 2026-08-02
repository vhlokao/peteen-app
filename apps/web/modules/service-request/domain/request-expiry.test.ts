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

  it("scheduledAt exatamente 1h após createdAt → ainda usa a margem (não é 'menos de 1h')", () => {
    const scheduledAt = hoursAfterCreation(1)
    const expiry = calculateEffectiveExpiry(CREATED_AT, scheduledAt)
    // gapMs === margem exata: cai no ramo normal (min), não na exceção.
    // min(createdAt+24h, scheduledAt-1h=createdAt) = createdAt.
    assert.equal(expiry.getTime(), CREATED_AT.getTime())
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
