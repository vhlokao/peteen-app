/**
 * GATE-14-BACKOFFICE-OPERATIONS-CLEANUP-001 — verdade operacional de EXPIRED.
 *
 * Trava a derivação que o Backoffice passou a usar, e as duas coisas que ela
 * NÃO pode fazer: reimplementar a regra de vencimento, e derivar status que
 * não seja PENDING.
 *
 * Rodar: npm run test:backoffice
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  countPendingSync,
  resolveOperationalRequestStatus,
} from "./request-operational-status.ts"
import {
  calculateEffectiveExpiry,
  PENDING_MAX_AGE_HOURS,
} from "../../service-request/domain/request-expiry.ts"

const H = 60 * 60 * 1000
const CRIADA = new Date("2026-09-05T12:00:00.000Z")

function req(over: Partial<{ status: string; createdAt: Date; scheduledAt: Date | null }> = {}) {
  return { status: "PENDING", createdAt: CRIADA, scheduledAt: null, ...over }
}

// ─────────────────────────────────────────────────────────────────────────────
// Só PENDING deriva
// ─────────────────────────────────────────────────────────────────────────────

describe("nenhum status além de PENDING é derivado", () => {
  const OUTROS = [
    "ACCEPTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED_BY_TUTOR",
    "CANCELLED_BY_PROFESSIONAL",
    "DISPUTED",
    "EXPIRED",
  ]

  it("o tempo não altera fato registrado por ação de alguém", () => {
    // Muito depois de qualquer prazo concebível.
    const daquiAUmAno = new Date(CRIADA.getTime() + 365 * 24 * H)
    for (const status of OUTROS) {
      const r = resolveOperationalRequestStatus(req({ status }), daquiAUmAno)
      assert.equal(r.effective, status, status)
      assert.equal(r.persisted, status, status)
      assert.equal(r.pendingSync, false, `${status} não pode pedir sincronização`)
    }
  })

  it("EXPIRED já persistido continua EXPIRED, sem se marcar como divergente", () => {
    const r = resolveOperationalRequestStatus(req({ status: "EXPIRED" }), new Date())
    assert.equal(r.effective, "EXPIRED")
    assert.equal(r.pendingSync, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PENDING dentro e fora do prazo
// ─────────────────────────────────────────────────────────────────────────────

describe("PENDING — a divergência que o Backoffice escondia", () => {
  it("dentro do prazo continua PENDING, sem divergência", () => {
    const r = resolveOperationalRequestStatus(req(), new Date(CRIADA.getTime() + 1 * H))
    assert.equal(r.effective, "PENDING")
    assert.equal(r.pendingSync, false)
  })

  it("vencida por idade (24h) aparece como EXPIRED e acusa a divergência", () => {
    const depois = new Date(CRIADA.getTime() + (PENDING_MAX_AGE_HOURS + 1) * H)
    const r = resolveOperationalRequestStatus(req(), depois)
    assert.equal(r.persisted, "PENDING")
    assert.equal(r.effective, "EXPIRED")
    assert.equal(r.pendingSync, true)
  })

  it("vencida pela proximidade do agendamento também é pega", () => {
    // scheduledAt daqui a 3h → prazo = scheduledAt - 1h = 2h depois da criação.
    const agendada = new Date(CRIADA.getTime() + 3 * H)
    const r = resolveOperationalRequestStatus(
      req({ scheduledAt: agendada }),
      new Date(CRIADA.getTime() + 2.5 * H)
    )
    assert.equal(r.effective, "EXPIRED")
    assert.equal(r.pendingSync, true)
  })

  it("exatamente no instante do prazo já conta como vencida", () => {
    const prazo = calculateEffectiveExpiry(CRIADA, null)
    assert.equal(resolveOperationalRequestStatus(req(), prazo).effective, "EXPIRED")
  })

  it("um milissegundo antes do prazo ainda é PENDING", () => {
    const prazo = calculateEffectiveExpiry(CRIADA, null)
    const antes = new Date(prazo.getTime() - 1)
    assert.equal(resolveOperationalRequestStatus(req(), antes).effective, "PENDING")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A regra de vencimento é a MESMA do produto
// ─────────────────────────────────────────────────────────────────────────────

describe("a derivação não reimplementa a regra — ela a reusa", () => {
  it("a fronteira bate exatamente com calculateEffectiveExpiry, com e sem agendamento", () => {
    const cenarios: Array<Date | null> = [
      null,
      new Date(CRIADA.getTime() + 30 * 60 * 1000), // 30min — abaixo da margem
      new Date(CRIADA.getTime() + 3 * H),
      new Date(CRIADA.getTime() + 48 * H), // além das 24h, quem manda é a idade
      new Date(CRIADA.getTime() - 2 * H), // agendamento no passado
    ]

    for (const scheduledAt of cenarios) {
      const prazo = calculateEffectiveExpiry(CRIADA, scheduledAt)
      const rotulo = scheduledAt ? scheduledAt.toISOString() : "sem agendamento"

      assert.equal(
        resolveOperationalRequestStatus(
          req({ scheduledAt }),
          new Date(prazo.getTime() - 1)
        ).effective,
        "PENDING",
        `${rotulo}: antes do prazo`
      )
      assert.equal(
        resolveOperationalRequestStatus(req({ scheduledAt }), prazo).effective,
        "EXPIRED",
        `${rotulo}: no prazo`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contador operacional
// ─────────────────────────────────────────────────────────────────────────────

describe("contador de linhas não sincronizadas", () => {
  const vencida = req()
  const noPrazo = req({ createdAt: new Date(CRIADA.getTime() + 20 * H) })
  const concluida = req({ status: "COMPLETED" })
  const agora = new Date(CRIADA.getTime() + 25 * H)

  it("conta só as PENDING vencidas", () => {
    assert.equal(countPendingSync([vencida, noPrazo, concluida], agora), 1)
  })

  it("lista vazia é zero, nunca erro", () => {
    assert.equal(countPendingSync([], agora), 0)
  })

  it("zero quando tudo está em dia — o número serve para alarmar, não para decorar", () => {
    assert.equal(countPendingSync([noPrazo, concluida], agora), 0)
  })

  it("conta todas quando todas venceram", () => {
    assert.equal(countPendingSync([vencida, req(), req()], agora), 3)
  })
})
