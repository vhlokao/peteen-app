/**
 * Testes unitários — Agenda Foundation V0.3 (fundação temporal).
 *
 * Runner: node:test nativo (mesmo padrão de modules/location).
 * Rodar: npm run test:agenda
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  zonedCivilDateTimeToInstant,
  formatZonedTime,
  scheduledDayTimeZone,
  formatScheduledCivilDate,
} from "./zoned-datetime.ts"
import {
  canDisplayScheduledTime,
  canDisplayEndTime,
  getSchedulePrecision,
} from "../../modules/service-request/domain/schedule-precision.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Conversão civil (BRT) → instante UTC
// ─────────────────────────────────────────────────────────────────────────────

describe("zonedCivilDateTimeToInstant", () => {
  it("08:00 BRT vira 11:00 UTC", () => {
    const instant = zonedCivilDateTimeToInstant("2026-08-01", "08:00")
    assert.equal(instant?.toISOString(), "2026-08-01T11:00:00.000Z")
  })

  it("09:00 BRT vira 12:00 UTC — mesmo instante da âncora legada", () => {
    // Este é o caso que torna QUALQUER heurística de hora insegura: um
    // compromisso real às 09:00 é indistinguível da âncora de meio-dia UTC
    // olhando só para o timestamp. Só scheduledHasTime separa os dois.
    const instant = zonedCivilDateTimeToInstant("2026-08-01", "09:00")
    assert.equal(instant?.toISOString(), "2026-08-01T12:00:00.000Z")
  })

  it("21:00 BRT vira 00:00 UTC do dia seguinte — colide com a outra âncora", () => {
    const instant = zonedCivilDateTimeToInstant("2026-08-01", "21:00")
    assert.equal(instant?.toISOString(), "2026-08-02T00:00:00.000Z")
  })

  it("00:00 BRT é convertido corretamente", () => {
    const instant = zonedCivilDateTimeToInstant("2026-08-01", "00:00")
    assert.equal(instant?.toISOString(), "2026-08-01T03:00:00.000Z")
  })

  it("23:30 BRT é convertido corretamente", () => {
    const instant = zonedCivilDateTimeToInstant("2026-08-01", "23:30")
    assert.equal(instant?.toISOString(), "2026-08-02T02:30:00.000Z")
  })

  it("round-trip: o instante reproduz o horário de parede pedido", () => {
    for (const time of ["00:00", "06:15", "09:00", "12:00", "18:45", "23:59"]) {
      const instant = zonedCivilDateTimeToInstant("2026-08-01", time)
      assert.ok(instant, `falhou ao converter ${time}`)
      assert.equal(formatZonedTime(instant), time, `round-trip divergiu em ${time}`)
    }
  })

  it("não usa offset fixo: deriva o offset do próprio fuso", () => {
    // Se houvesse -03:00 hardcoded, um fuso com offset diferente daria o
    // mesmo resultado. Aqui o fuso é respeitado de fato.
    const brt = zonedCivilDateTimeToInstant("2026-08-01", "12:00", "America/Sao_Paulo")
    const utc = zonedCivilDateTimeToInstant("2026-08-01", "12:00", "UTC")
    assert.notEqual(brt?.toISOString(), utc?.toISOString())
    assert.equal(utc?.toISOString(), "2026-08-01T12:00:00.000Z")
  })

  it("entradas inválidas retornam null", () => {
    assert.equal(zonedCivilDateTimeToInstant("2026-08-01", "25:00"), null)
    assert.equal(zonedCivilDateTimeToInstant("2026-08-01", "12:60"), null)
    assert.equal(zonedCivilDateTimeToInstant("01/08/2026", "12:00"), null)
    assert.equal(zonedCivilDateTimeToInstant("2026-08-01", "8:00"), null)
    assert.equal(zonedCivilDateTimeToInstant("", ""), null)
  })

  it("duração que atravessa a meia-noite produz endAt no dia seguinte", () => {
    const start = zonedCivilDateTimeToInstant("2026-08-01", "23:00")!
    const end = new Date(start.getTime() + 120 * 60_000) // 2h
    assert.equal(end.toISOString(), "2026-08-02T04:00:00.000Z")
    assert.equal(formatZonedTime(end), "01:00")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dia civil por precisão — date-only (UTC) vs. horário real (fuso do piloto)
// ─────────────────────────────────────────────────────────────────────────────

describe("scheduledDayTimeZone", () => {
  it("date-only renderiza em UTC; horário real no fuso do piloto", () => {
    assert.equal(scheduledDayTimeZone(false), "UTC")
    assert.equal(scheduledDayTimeZone(true), "America/Sao_Paulo")
  })
})

describe("formatScheduledCivilDate", () => {
  const numeric = { day: "2-digit", month: "2-digit", year: "numeric" } as const

  it("legado 00:00 UTC preserva o dia gravado (não desliza para o anterior)", () => {
    // 2026-08-03T00:00Z em BRT seria 02/08 21:00 — o bug que motivou o fix.
    const d = new Date("2026-08-03T00:00:00.000Z")
    assert.equal(formatScheduledCivilDate(d, false, numeric), "03/08/2026")
  })

  it("legado 12:00 UTC (âncora de meio-dia) mantém o dia", () => {
    const d = new Date("2026-08-02T12:00:00.000Z")
    assert.equal(formatScheduledCivilDate(d, false, numeric), "02/08/2026")
  })

  it("horário real às 09:00 BRT (12:00 UTC) mostra o dia local", () => {
    const d = new Date("2026-08-01T12:00:00.000Z")
    assert.equal(formatScheduledCivilDate(d, true, numeric), "01/08/2026")
  })

  it("horário real perto da meia-noite vira o dia no fuso local, não em UTC", () => {
    // 22:00 BRT de 01/08 = 01:00 UTC de 02/08. Em UTC daria 02/08 (errado);
    // no fuso do piloto, 01/08.
    const d = new Date("2026-08-02T01:00:00.000Z")
    assert.equal(formatScheduledCivilDate(d, true, numeric), "01/08/2026")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de precisão temporal — legado vs. horário real
// ─────────────────────────────────────────────────────────────────────────────

describe("schedule-precision", () => {
  const legacyNoonAnchor = {
    // Exatamente a âncora legada: 12:00 UTC.
    scheduledAt: new Date("2026-07-30T12:00:00.000Z"),
    scheduledHasTime: false,
    endAt: null,
  }

  const legacyMidnightAnchor = {
    // Âncora legada ainda mais antiga: 00:00 UTC.
    scheduledAt: new Date("2026-07-30T00:00:00.000Z"),
    scheduledHasTime: false,
    endAt: null,
  }

  const realNineAm = {
    // Compromisso REAL às 09:00 BRT — mesmo timestamp da âncora de meio-dia.
    scheduledAt: new Date("2026-07-30T12:00:00.000Z"),
    scheduledHasTime: true,
    endAt: new Date("2026-07-30T12:45:00.000Z"),
  }

  it("legado 12:00 UTC não exibe horário", () => {
    assert.equal(canDisplayScheduledTime(legacyNoonAnchor), false)
    assert.equal(canDisplayEndTime(legacyNoonAnchor), false)
    assert.equal(getSchedulePrecision(legacyNoonAnchor), "day")
  })

  it("legado 00:00 UTC não exibe horário", () => {
    assert.equal(canDisplayScheduledTime(legacyMidnightAnchor), false)
    assert.equal(getSchedulePrecision(legacyMidnightAnchor), "day")
  })

  it("compromisso real às 09:00 BRT exibe horário, apesar do timestamp idêntico ao legado", () => {
    assert.equal(canDisplayScheduledTime(realNineAm), true)
    assert.equal(canDisplayEndTime(realNineAm), true)
    assert.equal(getSchedulePrecision(realNineAm), "minute")

    // Prova de que a distinção NÃO vem do timestamp:
    assert.equal(
      realNineAm.scheduledAt.getTime(),
      legacyNoonAnchor.scheduledAt.getTime()
    )
    assert.notEqual(
      canDisplayScheduledTime(realNineAm),
      canDisplayScheduledTime(legacyNoonAnchor)
    )
  })

  it("sem data → precisão 'none' e nada é exibido", () => {
    const unscheduled = { scheduledAt: null, scheduledHasTime: false, endAt: null }
    assert.equal(getSchedulePrecision(unscheduled), "none")
    assert.equal(canDisplayScheduledTime(unscheduled), false)
  })

  it("horário real sem endAt exibe só o início", () => {
    const noDuration = {
      scheduledAt: new Date("2026-07-30T11:00:00.000Z"),
      scheduledHasTime: true,
      endAt: null,
    }
    assert.equal(canDisplayScheduledTime(noDuration), true)
    assert.equal(canDisplayEndTime(noDuration), false)
  })

  it("scheduledHasTime true nunca é derivado da hora — 12:00 UTC pode ser qualquer um dos dois", () => {
    const sameInstant = new Date("2026-07-30T12:00:00.000Z")
    assert.equal(
      getSchedulePrecision({ scheduledAt: sameInstant, scheduledHasTime: false }),
      "day"
    )
    assert.equal(
      getSchedulePrecision({ scheduledAt: sameInstant, scheduledHasTime: true }),
      "minute"
    )
  })
})
