/**
 * Testes focados — regra de conflito de Agenda.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/service-request/domain/agenda-conflict.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 *
 * Cobre os cenários 1–11 e 14–15 da missão. Os cenários 12 (aceitações
 * concorrentes) e 13 (retry) dependem de banco real e da proteção definitiva
 * de concorrência, que está proposta e aguardando aprovação — não são
 * testáveis aqui.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  resolveAgendaInterval,
  intervalsConflict,
  findAgendaConflict,
  isAgendaBlockingStatus,
  AGENDA_BLOCKING_STATUSES,
  type ExistingAppointment,
} from "./agenda-conflict.ts"

/** Helper: instante UTC a partir de um horário de parede em BRT (UTC-3). */
const brt = (dia: string, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(`${dia}T${String(h! + 3).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`)
}

const comHorario = (inicio: Date, fim: Date | null) => ({
  scheduledAt: inicio,
  scheduledHasTime: true,
  endAt: fim,
})

const agendado = (
  id: string,
  inicio: Date,
  fim: Date | null,
  status = "ACCEPTED"
): ExistingAppointment => ({ id, status, ...comHorario(inicio, fim) })

// ─────────────────────────────────────────────────────────────────────────────
// Cenários 1–4 — sobreposição de intervalos
// ─────────────────────────────────────────────────────────────────────────────

describe("sobreposição de intervalos", () => {
  it("1. 10:00–11:00 vs 10:30–11:30 → conflito (parcial)", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = comHorario(brt("2026-09-01", "10:30"), brt("2026-09-01", "11:30"))
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("2. 10:00–11:00 vs 11:00–12:00 → permitido (encostados)", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = comHorario(brt("2026-09-01", "11:00"), brt("2026-09-01", "12:00"))
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("2b. encostados na ordem inversa também são permitidos", () => {
    const existente = [agendado("a", brt("2026-09-01", "11:00"), brt("2026-09-01", "12:00"))]
    const novo = comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("3. intervalo totalmente contido → conflito", () => {
    const existente = [agendado("a", brt("2026-09-01", "09:00"), brt("2026-09-01", "13:00"))]
    const novo = comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("4. intervalo que contém outro → conflito", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = comHorario(brt("2026-09-01", "09:00"), brt("2026-09-01", "13:00"))
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("intervalos idênticos → conflito", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("dias diferentes, mesmo horário → permitido", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = comHorario(brt("2026-09-02", "10:00"), brt("2026-09-02", "11:00"))
    assert.equal(findAgendaConflict(novo, existente), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenários 6–9 — quais status bloqueiam
// ─────────────────────────────────────────────────────────────────────────────

describe("status que bloqueiam", () => {
  const novo = comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))
  const mesmoIntervalo = (status: string) =>
    [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"), status)]

  it("7. ACCEPTED sobreposta → bloqueia", () => {
    assert.ok(findAgendaConflict(novo, mesmoIntervalo("ACCEPTED")))
  })

  it("8. IN_PROGRESS sobreposta → bloqueia", () => {
    assert.ok(findAgendaConflict(novo, mesmoIntervalo("IN_PROGRESS")))
  })

  it("6. PENDING sobreposta → não bloqueia", () => {
    assert.equal(findAgendaConflict(novo, mesmoIntervalo("PENDING")), null)
  })

  it("9. terminais não bloqueiam", () => {
    for (const status of [
      "COMPLETED",
      "CANCELLED_BY_TUTOR",
      "CANCELLED_BY_PROFESSIONAL",
      "EXPIRED",
      "DISPUTED",
    ]) {
      assert.equal(
        findAgendaConflict(novo, mesmoIntervalo(status)),
        null,
        `${status} não deveria bloquear`
      )
    }
  })

  it("a lista de status bloqueantes é exatamente ACCEPTED e IN_PROGRESS", () => {
    assert.deepEqual([...AGENDA_BLOCKING_STATUSES], ["ACCEPTED", "IN_PROGRESS"])
    assert.equal(isAgendaBlockingStatus("ACCEPTED"), true)
    assert.equal(isAgendaBlockingStatus("IN_PROGRESS"), true)
    assert.equal(isAgendaBlockingStatus("PENDING"), false)
    assert.equal(isAgendaBlockingStatus("COMPLETED"), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 10 — precisão de data civil não participa
// ─────────────────────────────────────────────────────────────────────────────

describe("scheduledHasTime = false", () => {
  const ancora = new Date("2026-09-01T12:00:00.000Z") // meio-dia UTC, âncora legada

  it("10. candidato sem horário real → nunca conflita", () => {
    const existente = [agendado("a", brt("2026-09-01", "09:00"), brt("2026-09-01", "10:00"))]
    const novo = { scheduledAt: ancora, scheduledHasTime: false, endAt: null }
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("10b. existente sem horário real → não ocupa a agenda", () => {
    const existente: ExistingAppointment[] = [
      { id: "a", status: "ACCEPTED", scheduledAt: ancora, scheduledHasTime: false, endAt: null },
    ]
    // Candidato real exatamente sobre a âncora das 12:00 UTC — não deve
    // conflitar, senão toda request legada bloquearia o meio-dia.
    const novo = comHorario(ancora, new Date(ancora.getTime() + 60 * 60_000))
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("duas requests legadas nunca conflitam entre si", () => {
    const existente: ExistingAppointment[] = [
      { id: "a", status: "ACCEPTED", scheduledAt: ancora, scheduledHasTime: false, endAt: null },
    ]
    const novo = { scheduledAt: ancora, scheduledHasTime: false, endAt: null }
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("scheduledAt null → não participa", () => {
    const existente = [agendado("a", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    assert.equal(
      findAgendaConflict({ scheduledAt: null, scheduledHasTime: true, endAt: null }, existente),
      null
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 11 — endAt null (sem duração declarada). Comportamento documentado.
// ─────────────────────────────────────────────────────────────────────────────

describe("endAt null — sem duração declarada", () => {
  it("11. mesmo instante de início → conflito (dupla-reserva inequívoca)", () => {
    const existente = [agendado("a", brt("2026-09-01", "14:00"), null)]
    const novo = comHorario(brt("2026-09-01", "14:00"), null)
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("11b. instantes diferentes sem duração → NÃO conflita (indecidível)", () => {
    // Sem duração não há como afirmar sobreposição: 14:00 e 14:30 podem ou
    // não colidir. A regra não inventa minutos — deixa passar.
    const existente = [agendado("a", brt("2026-09-01", "14:00"), null)]
    const novo = comHorario(brt("2026-09-01", "14:30"), null)
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("11c. um com duração e outro sem, mesmo início → conflito", () => {
    const existente = [agendado("a", brt("2026-09-01", "14:00"), brt("2026-09-01", "15:00"))]
    const novo = comHorario(brt("2026-09-01", "14:00"), null)
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("11d. um com duração e outro sem, início dentro do intervalo → NÃO conflita", () => {
    // Limitação conhecida e aceita: o candidato sem duração é um ponto, e a
    // regra de ponto só casa por igualdade de início. Documentado na entrega.
    const existente = [agendado("a", brt("2026-09-01", "14:00"), brt("2026-09-01", "15:00"))]
    const novo = comHorario(brt("2026-09-01", "14:30"), null)
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("endAt inconsistente (anterior ao início) degrada para ponto", () => {
    const inicio = brt("2026-09-01", "14:00")
    const fimInvalido = brt("2026-09-01", "13:00")
    assert.deepEqual(resolveAgendaInterval(comHorario(inicio, fimInvalido)), {
      start: inicio.getTime(),
      end: inicio.getTime(),
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenário 5 — isolamento por profissional (responsabilidade do chamador)
// ─────────────────────────────────────────────────────────────────────────────

describe("isolamento por profissional e por request", () => {
  it("5. lista vazia (outro profissional já filtrado) → permitido", () => {
    const novo = comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))
    assert.equal(findAgendaConflict(novo, []), null)
  })

  it("ignora o próprio id — reaceite não conflita consigo mesmo", () => {
    const existente = [agendado("mesma", brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00"))]
    const novo = {
      id: "mesma",
      ...comHorario(brt("2026-09-01", "10:00"), brt("2026-09-01", "11:00")),
    }
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("devolve o primeiro conflito com dados para a mensagem", () => {
    const inicio = brt("2026-09-01", "10:00")
    const fim = brt("2026-09-01", "11:00")
    const existente = [agendado("a", inicio, fim)]
    const conflito = findAgendaConflict(comHorario(inicio, fim), existente)
    assert.equal(conflito?.conflictingRequestId, "a")
    assert.equal(conflito?.start.getTime(), inicio.getTime())
    assert.equal(conflito?.end?.getTime(), fim.getTime())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cenários 14–15 — fronteira de dia e horário de verão
// ─────────────────────────────────────────────────────────────────────────────

describe("fronteira de dia e DST", () => {
  it("14. compromisso que cruza a meia-noite conflita corretamente", () => {
    const existente = [
      agendado(
        "a",
        new Date("2026-09-01T23:00:00.000Z"),
        new Date("2026-09-02T01:00:00.000Z")
      ),
    ]
    const novo = comHorario(
      new Date("2026-09-02T00:00:00.000Z"),
      new Date("2026-09-02T02:00:00.000Z")
    )
    assert.equal(findAgendaConflict(novo, existente)?.conflictingRequestId, "a")
  })

  it("14b. 23:00–00:00 e 00:00–01:00 são encostados, não conflitam", () => {
    const existente = [
      agendado(
        "a",
        new Date("2026-09-01T23:00:00.000Z"),
        new Date("2026-09-02T00:00:00.000Z")
      ),
    ]
    const novo = comHorario(
      new Date("2026-09-02T00:00:00.000Z"),
      new Date("2026-09-02T01:00:00.000Z")
    )
    assert.equal(findAgendaConflict(novo, existente), null)
  })

  it("15. DST é irrelevante: a comparação é entre instantes absolutos", () => {
    // Data histórica dentro do antigo horário de verão brasileiro
    // (2017-10-15, quando o offset virou -02:00). Como scheduledAt já é um
    // instante UTC resolvido na criação, a regra não reconverte nada — dois
    // instantes distintos por 1h não se sobrepõem se as durações não alcançam.
    const a = new Date("2017-10-15T12:00:00.000Z")
    const b = new Date("2017-10-15T13:00:00.000Z")
    const existente = [agendado("a", a, new Date(a.getTime() + 60 * 60_000))]
    assert.equal(findAgendaConflict(comHorario(b, new Date(b.getTime() + 60 * 60_000)), existente), null)

    // E 30 minutos depois, sim.
    const c = new Date("2017-10-15T12:30:00.000Z")
    assert.ok(findAgendaConflict(comHorario(c, new Date(c.getTime() + 60 * 60_000)), existente))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Propriedades da regra
// ─────────────────────────────────────────────────────────────────────────────

describe("propriedades", () => {
  it("conflito é simétrico", () => {
    const x = { start: 100, end: 200 }
    const y = { start: 150, end: 250 }
    assert.equal(intervalsConflict(x, y), intervalsConflict(y, x))
    assert.equal(intervalsConflict(x, y), true)
  })

  it("encostados são simétricos e nunca conflitam", () => {
    const x = { start: 100, end: 200 }
    const y = { start: 200, end: 300 }
    assert.equal(intervalsConflict(x, y), false)
    assert.equal(intervalsConflict(y, x), false)
  })

  it("um intervalo sempre conflita consigo mesmo (quando tem duração)", () => {
    const x = { start: 100, end: 200 }
    assert.equal(intervalsConflict(x, x), true)
  })

  it("um ponto conflita consigo mesmo", () => {
    const p = { start: 100, end: 100 }
    assert.equal(intervalsConflict(p, p), true)
  })
})
