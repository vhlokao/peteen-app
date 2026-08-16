/**
 * R2B.3 item 14 — matriz de copy da central in-app.
 *
 * O bug que originou esta suíte: `["ACCEPTED","IN_PROGRESS","COMPLETED"]
 * .includes(status)` datado por `updatedAt` fazia o tutor receber
 * "Fulano aceitou sua solicitação" quando o evento real era início ou
 * conclusão. Os testes abaixo travam isso nos dois eixos — a COPY de cada
 * evento e o INSTANTE de cada evento.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  ACCEPT_FALLBACK_MIN_DELTA_MS,
  deriveTutorLifecycleEvents,
  tutorLifecycleCopy,
  type TutorLifecycleEventKind,
  type TutorLifecycleFacts,
} from "./inapp-copy.ts"

const PROF = "Maria Eduarda"
const SINCE = new Date("2026-08-01T00:00:00.000Z")

const CRIADO = new Date("2026-08-16T10:00:00.000Z")
const ACEITO = new Date("2026-08-16T11:00:00.000Z")
const INICIADO = new Date("2026-08-16T12:00:00.000Z")
const CONCLUIDO = new Date("2026-08-16T13:00:00.000Z")

function facts(over: Partial<TutorLifecycleFacts> = {}): TutorLifecycleFacts {
  return {
    status: "ACCEPTED",
    createdAt: CRIADO,
    updatedAt: ACEITO,
    acceptedAt: ACEITO,
    startedAt: null,
    completedAt: null,
    ...over,
  }
}

const kinds = (f: TutorLifecycleFacts) =>
  deriveTutorLifecycleEvents(f, SINCE).map((e) => e.kind)

// ─────────────────────────────────────────────────────────────────────────────
// A MATRIZ — nenhum evento pode reaproveitar a frase de outro
// ─────────────────────────────────────────────────────────────────────────────

describe("item 14 — matriz de copy: ACCEPTED != IN_PROGRESS != COMPLETED", () => {
  const TODOS: TutorLifecycleEventKind[] = [
    "accepted",
    "started",
    "completed",
    "cancelled_by_professional",
  ]

  it("cada evento tem título E descrição próprios", () => {
    const titulos = TODOS.map((k) => tutorLifecycleCopy(k, PROF).title)
    const descricoes = TODOS.map((k) => tutorLifecycleCopy(k, PROF).description)
    assert.equal(new Set(titulos).size, TODOS.length, "há título duplicado entre eventos")
    assert.equal(new Set(descricoes).size, TODOS.length, "há descrição duplicada entre eventos")
  })

  it("PROIBIDO — início nunca diz 'aceitou sua solicitação'", () => {
    const c = tutorLifecycleCopy("started", PROF)
    assert.ok(!/aceit/i.test(c.description), `início disse: ${c.description}`)
    assert.ok(!/aceit/i.test(c.title))
  })

  it("PROIBIDO — conclusão nunca diz 'aceitou sua solicitação'", () => {
    const c = tutorLifecycleCopy("completed", PROF)
    assert.ok(!/aceit/i.test(c.description), `conclusão disse: ${c.description}`)
    assert.ok(!/aceit/i.test(c.title))
  })

  it("PROIBIDO — cancelamento nunca diz 'aceitou' nem 'concluído'", () => {
    const c = tutorLifecycleCopy("cancelled_by_professional", PROF)
    assert.ok(!/aceit/i.test(c.description))
    assert.ok(!/conclu/i.test(c.description))
    assert.match(c.description, /cancel/i)
  })

  it("contrato mínimo da missão, frase a frase", () => {
    assert.equal(
      tutorLifecycleCopy("accepted", PROF).description,
      `${PROF} aceitou sua solicitação.`
    )
    assert.equal(tutorLifecycleCopy("started", PROF).description, "O atendimento foi iniciado.")
    assert.equal(
      tutorLifecycleCopy("completed", PROF).description,
      "O atendimento foi concluído."
    )
  })

  it("só o aceite usa o nome do profissional — os demais são genéricos", () => {
    assert.match(tutorLifecycleCopy("accepted", PROF).description, /Maria Eduarda/)
    for (const k of ["started", "completed", "cancelled_by_professional"] as const) {
      assert.ok(
        !tutorLifecycleCopy(k, PROF).description.includes(PROF),
        `${k} vazou o nome do profissional`
      )
    }
  })

  it("nenhuma copy fica com marcador de interpolação solto", () => {
    for (const k of TODOS) {
      const c = tutorLifecycleCopy(k, PROF)
      for (const texto of [c.title, c.description]) {
        assert.ok(!/\$\{|\{\{|undefined|null|\[object/.test(texto), `${k}: ${texto}`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A INFERÊNCIA — o evento certo, no instante certo
// ─────────────────────────────────────────────────────────────────────────────

describe("item 14 — inferência de eventos por estado", () => {
  it("ACCEPTED gera só o aceite", () => {
    assert.deepEqual(kinds(facts()), ["accepted"])
  })

  it("REGRESSÃO DO BUG — IN_PROGRESS gera início, e o aceite fica com a data do aceite", () => {
    const eventos = deriveTutorLifecycleEvents(
      facts({ status: "IN_PROGRESS", updatedAt: INICIADO, startedAt: INICIADO }),
      SINCE
    )
    assert.deepEqual(
      eventos.map((e) => e.kind),
      ["accepted", "started"]
    )
    // O ponto exato do bug: o aceite NÃO pode ser carimbado com updatedAt
    // (que avançou para o início).
    const aceite = eventos.find((e) => e.kind === "accepted")!
    assert.equal(aceite.at.getTime(), ACEITO.getTime())
    assert.notEqual(aceite.at.getTime(), INICIADO.getTime())
  })

  it("REGRESSÃO DO BUG — COMPLETED gera os três, cada um no seu instante", () => {
    const eventos = deriveTutorLifecycleEvents(
      facts({
        status: "COMPLETED",
        updatedAt: CONCLUIDO,
        startedAt: INICIADO,
        completedAt: CONCLUIDO,
      }),
      SINCE
    )
    assert.deepEqual(
      eventos.map((e) => e.kind),
      ["accepted", "started", "completed"]
    )
    assert.equal(eventos[0]!.at.getTime(), ACEITO.getTime())
    assert.equal(eventos[1]!.at.getTime(), INICIADO.getTime())
    assert.equal(eventos[2]!.at.getTime(), CONCLUIDO.getTime())
  })

  it("eventos saem em ordem cronológica", () => {
    const eventos = deriveTutorLifecycleEvents(
      facts({
        status: "COMPLETED",
        updatedAt: CONCLUIDO,
        startedAt: INICIADO,
        completedAt: CONCLUIDO,
      }),
      SINCE
    )
    for (let i = 1; i < eventos.length; i++) {
      assert.ok(eventos[i]!.at.getTime() >= eventos[i - 1]!.at.getTime())
    }
  })

  it("PENDING não gera nenhum evento", () => {
    assert.deepEqual(
      kinds(facts({ status: "PENDING", updatedAt: CRIADO, acceptedAt: null })),
      []
    )
  })

  it("CANCELLED_BY_PROFESSIONAL avisa o tutor", () => {
    const k = kinds(
      facts({ status: "CANCELLED_BY_PROFESSIONAL", updatedAt: CONCLUIDO, acceptedAt: ACEITO })
    )
    assert.ok(k.includes("cancelled_by_professional"))
  })

  it("CANCELLED_BY_TUTOR não avisa o próprio tutor", () => {
    const k = kinds(
      facts({ status: "CANCELLED_BY_TUTOR", updatedAt: CONCLUIDO, acceptedAt: ACEITO })
    )
    assert.ok(!k.includes("cancelled_by_professional"))
  })
})

describe("item 14 — fallback de aceite sem AuditLog (dados legados)", () => {
  it("sem AuditLog mas ACCEPTED agora: infere pelo updatedAt", () => {
    assert.deepEqual(
      kinds(
        facts({
          acceptedAt: null,
          status: "ACCEPTED",
          updatedAt: new Date(CRIADO.getTime() + ACCEPT_FALLBACK_MIN_DELTA_MS + 1),
        })
      ),
      ["accepted"]
    )
  })

  it("sem AuditLog e updatedAt colado no createdAt: NÃO infere aceite", () => {
    assert.deepEqual(
      kinds(
        facts({
          acceptedAt: null,
          status: "ACCEPTED",
          updatedAt: new Date(CRIADO.getTime() + 1_000),
        })
      ),
      []
    )
  })

  it("O CORAÇÃO DO BUG — sem AuditLog e já em COMPLETED, o aceite é OMITIDO", () => {
    // Era exatamente aqui que nascia "aceitou sua solicitação" datado de agora:
    // omitir é melhor que datar errado. Início e conclusão contam a história,
    // com instantes confiáveis.
    const eventos = deriveTutorLifecycleEvents(
      facts({
        acceptedAt: null,
        status: "COMPLETED",
        updatedAt: CONCLUIDO,
        startedAt: INICIADO,
        completedAt: CONCLUIDO,
      }),
      SINCE
    )
    assert.deepEqual(
      eventos.map((e) => e.kind),
      ["started", "completed"]
    )
  })

  it("sem AuditLog e em IN_PROGRESS, o aceite também é omitido", () => {
    assert.deepEqual(
      kinds(
        facts({
          acceptedAt: null,
          status: "IN_PROGRESS",
          updatedAt: INICIADO,
          startedAt: INICIADO,
        })
      ),
      ["started"]
    )
  })
})

describe("item 14 — janela `since`", () => {
  it("eventos anteriores à janela são descartados", () => {
    const antigo = new Date("2026-07-01T00:00:00.000Z")
    assert.deepEqual(
      kinds(
        facts({
          status: "COMPLETED",
          acceptedAt: antigo,
          startedAt: antigo,
          completedAt: antigo,
          updatedAt: antigo,
        })
      ),
      []
    )
  })

  it("evento exatamente no limite da janela é incluído", () => {
    assert.deepEqual(
      kinds(facts({ status: "ACCEPTED", acceptedAt: SINCE, updatedAt: SINCE })),
      ["accepted"]
    )
  })

  it("mistura: conclusão recente entra, aceite antigo não", () => {
    const antigo = new Date("2026-07-01T00:00:00.000Z")
    assert.deepEqual(
      kinds(
        facts({
          status: "COMPLETED",
          acceptedAt: antigo,
          startedAt: INICIADO,
          completedAt: CONCLUIDO,
          updatedAt: CONCLUIDO,
        })
      ),
      ["started", "completed"]
    )
  })
})
