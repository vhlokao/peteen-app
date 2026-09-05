/**
 * GATE-14-BACKOFFICE-OPERATIONS-CLEANUP-FIX-002 — filtrar pelo status operacional.
 *
 * O gate anterior fez a TABELA dizer a verdade e deixou o FILTRO lendo a coluna
 * crua. As duas mentiras que sobraram:
 *   - `status=PENDING` devolvia linhas que a própria tabela desenhava EXPIRED;
 *   - `status=EXPIRED` escondia as PENDING vencidas não sincronizadas — o caso
 *     que o gate existe para tornar visível.
 *
 * Aqui ficam as três garantias que sustentam a correção: a semântica dos dois
 * recortes, a propriedade de SUPERCONJUNTO da janela de candidatos (sem ela a
 * tela omite em silêncio), e a coleta em lotes (sem ela o limite vira omissão).
 *
 * Rodar: npm run test:backoffice
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  coletarEmLotes,
  isOperationalStatusFilter,
  matchesOperationalStatus,
  OPERATIONAL_STATUS_FILTERS,
  pendingExpiryCandidateWindow,
} from "./request-operational-status.ts"
import {
  calculateEffectiveExpiry,
  PENDING_MAX_AGE_HOURS,
  SCHEDULED_SAFETY_MARGIN_HOURS,
} from "../../service-request/domain/request-expiry.ts"

const H = 60 * 60 * 1000
const CRIADA = new Date("2026-09-05T12:00:00.000Z")

function req(
  over: Partial<{ status: string; createdAt: Date; scheduledAt: Date | null }> = {}
) {
  return { status: "PENDING", createdAt: CRIADA, scheduledAt: null, ...over }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quais status são operacionais
// ─────────────────────────────────────────────────────────────────────────────

describe("só PENDING e EXPIRED dependem do relógio", () => {
  it("a lista de status operacionais é exatamente essa", () => {
    assert.deepEqual([...OPERATIONAL_STATUS_FILTERS], ["PENDING", "EXPIRED"])
    assert.equal(isOperationalStatusFilter("PENDING"), true)
    assert.equal(isOperationalStatusFilter("EXPIRED"), true)
  })

  it("os demais seguem lidos da coluna persistida — o tempo não os move", () => {
    for (const s of [
      "ACCEPTED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED_BY_TUTOR",
      "CANCELLED_BY_PROFESSIONAL",
      "DISPUTED",
      "",
      undefined,
      null,
    ]) {
      assert.equal(isOperationalStatusFilter(s as string), false, String(s))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Semântica dos dois recortes
// ─────────────────────────────────────────────────────────────────────────────

describe("recorte PENDING — só o que está pendente AGORA", () => {
  const agora = new Date(CRIADA.getTime() + 25 * H)

  it("uma PENDING vencida NÃO entra", () => {
    assert.equal(matchesOperationalStatus(req(), "PENDING", agora), false)
  })

  it("uma PENDING dentro do prazo entra", () => {
    const recente = req({ createdAt: new Date(agora.getTime() - 1 * H) })
    assert.equal(matchesOperationalStatus(recente, "PENDING", agora), true)
  })

  it("nenhum outro status entra", () => {
    for (const status of ["ACCEPTED", "COMPLETED", "EXPIRED", "DISPUTED"]) {
      assert.equal(matchesOperationalStatus(req({ status }), "PENDING", agora), false, status)
    }
  })
})

describe("recorte EXPIRED — persistidas MAIS vencidas não sincronizadas", () => {
  const agora = new Date(CRIADA.getTime() + 25 * H)

  it("inclui a EXPIRED já gravada", () => {
    const gravada = req({ status: "EXPIRED", createdAt: new Date(agora.getTime() - 1 * H) })
    assert.equal(matchesOperationalStatus(gravada, "EXPIRED", agora), true)
  })

  it("inclui a PENDING vencida ainda não sincronizada", () => {
    assert.equal(matchesOperationalStatus(req(), "EXPIRED", agora), true)
  })

  it("não inclui PENDING dentro do prazo", () => {
    const recente = req({ createdAt: new Date(agora.getTime() - 1 * H) })
    assert.equal(matchesOperationalStatus(recente, "EXPIRED", agora), false)
  })

  it("os dois recortes são disjuntos e juntos cobrem toda PENDING", () => {
    const casos = [
      req(),
      req({ createdAt: new Date(agora.getTime() - 1 * H) }),
      req({
        createdAt: new Date(agora.getTime() - 1 * H),
        scheduledAt: new Date(agora.getTime() + 30 * 60 * 1000),
      }),
      req({
        createdAt: new Date(agora.getTime() - 1 * H),
        scheduledAt: new Date(agora.getTime() - 30 * 60 * 1000),
      }),
    ]
    for (const c of casos) {
      const p = matchesOperationalStatus(c, "PENDING", agora)
      const e = matchesOperationalStatus(c, "EXPIRED", agora)
      assert.notEqual(p, e, "toda PENDING cai em exatamente um dos dois")
    }
  })

  it("fronteira exata: no instante do prazo troca de recorte", () => {
    const prazo = calculateEffectiveExpiry(CRIADA, null)
    const antes = new Date(prazo.getTime() - 1)
    assert.equal(matchesOperationalStatus(req(), "PENDING", antes), true)
    assert.equal(matchesOperationalStatus(req(), "EXPIRED", antes), false)
    assert.equal(matchesOperationalStatus(req(), "PENDING", prazo), false)
    assert.equal(matchesOperationalStatus(req(), "EXPIRED", prazo), true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A propriedade que impede OMISSÃO silenciosa
// ─────────────────────────────────────────────────────────────────────────────

describe("janela de candidatos — precisa ser SUPERCONJUNTO da regra real", () => {
  /** Reproduz o predicado que a query aplica no banco. */
  function bancoAceitaComoCandidata(
    r: { createdAt: Date; scheduledAt: Date | null },
    agora: Date
  ): boolean {
    const j = pendingExpiryCandidateWindow(agora)
    return (
      r.createdAt.getTime() <= j.createdAtAteh.getTime() ||
      (r.scheduledAt !== null && r.scheduledAt.getTime() <= j.scheduledAtAteh.getTime())
    )
  }

  it("toda PENDING realmente vencida é candidata — senão a tela OMITE em silêncio", () => {
    const agora = new Date("2026-09-06T12:00:00.000Z")
    const criacoes = [-72, -48, -30, -25, -24.001, -24, -23, -12, -2, -1, -0.5, 0]
    const agendamentos: Array<Date | null> = [
      null,
      ...[-48, -2, -1, -0.5, 0, 0.5, 0.9, 1, 1.5, 2, 24, 72].map(
        (h) => new Date(agora.getTime() + h * H)
      ),
    ]

    let vencidasExercitadas = 0
    for (const dh of criacoes) {
      for (const scheduledAt of agendamentos) {
        const linha = req({ createdAt: new Date(agora.getTime() + dh * H), scheduledAt })
        if (!matchesOperationalStatus(linha, "EXPIRED", agora)) continue
        vencidasExercitadas++
        assert.ok(
          bancoAceitaComoCandidata(linha, agora),
          `vencida FORA da janela: criada ${dh}h, agendada ${scheduledAt?.toISOString() ?? "null"}`
        )
      }
    }
    // Trava contra o teste esvaziar e passar à toa.
    assert.ok(vencidasExercitadas > 30, `poucos casos vencidos: ${vencidasExercitadas}`)
  })

  it("é superconjunto ESTRITO — o falso positivo existe e é esperado", () => {
    // Agendamento a menos de 1h da criação e ainda no futuro: o banco deixa
    // passar, o domínio descarta. É este ramo (que compara duas colunas) que
    // impede o predicado de ser exato — e é por isso que o refino em memória
    // não pode ser removido.
    const agora = new Date("2026-09-06T12:00:00.000Z")
    const linha = req({
      createdAt: new Date(agora.getTime() - 10 * 60 * 1000),
      scheduledAt: new Date(agora.getTime() + 20 * 60 * 1000),
    })
    assert.equal(bancoAceitaComoCandidata(linha, agora), true)
    assert.equal(matchesOperationalStatus(linha, "EXPIRED", agora), false)
  })

  it("os limites saem das constantes oficiais, não de números soltos", () => {
    const agora = new Date("2026-09-06T12:00:00.000Z")
    const j = pendingExpiryCandidateWindow(agora)
    assert.equal(agora.getTime() - j.createdAtAteh.getTime(), PENDING_MAX_AGE_HOURS * H)
    assert.equal(j.scheduledAtAteh.getTime() - agora.getTime(), SCHEDULED_SAFETY_MARGIN_HOURS * H)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coleta em lotes — o limite não pode virar omissão
// ─────────────────────────────────────────────────────────────────────────────

type Item = { id: string; ok: boolean }

function fonteFalsa(itens: Item[], tamanhoDoLote: number) {
  let idas = 0
  return {
    get idas() {
      return idas
    },
    lerLote: async (depoisDe: string | undefined) => {
      idas++
      const inicio = depoisDe ? itens.findIndex((i) => i.id === depoisDe) + 1 : 0
      return itens.slice(inicio, inicio + tamanhoDoLote)
    },
  }
}

async function coletar(itens: Item[], limite: number, lote: number, maxLotes = 20) {
  const f = fonteFalsa(itens, lote)
  const r = await coletarEmLotes<Item>({
    lerLote: f.lerLote,
    aceita: (i) => i.ok,
    idDe: (i) => i.id,
    limite,
    tamanhoDoLote: lote,
    maxLotes,
  })
  return { r, idas: f.idas }
}

describe("coleta em lotes", () => {
  it("NÃO omite a linha aceita que estava logo depois do primeiro lote", async () => {
    // Exatamente o erro que a missão manda auditar: com `take: 5` seguido de
    // filtro, o resultado seria vazio — e a linha mais antiga sumiria.
    const itens: Item[] = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, ok: false })),
      { id: "achada", ok: true },
    ]
    const { r } = await coletar(itens, 300, 5)
    assert.deepEqual(r.map((i) => i.id), ["achada"])
  })

  it("volta ao banco enquanto faltar linha aceita", async () => {
    const itens: Item[] = Array.from({ length: 100 }, (_, i) => ({
      id: `i${i}`,
      ok: i % 10 === 0,
    }))
    const { r, idas } = await coletar(itens, 3, 10)
    assert.equal(r.length, 3)
    assert.ok(idas >= 3, `deveria ter buscado mais lotes: ${idas}`)
  })

  it("para exatamente no limite, sem ler além do necessário", async () => {
    const itens: Item[] = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, ok: true }))
    const { r, idas } = await coletar(itens, 10, 50)
    assert.equal(r.length, 10)
    assert.equal(idas, 1)
  })

  it("fonte esgotada devolve o que há, sem laço infinito", async () => {
    const { r, idas } = await coletar([{ id: "a", ok: true }, { id: "b", ok: false }], 300, 10)
    assert.deepEqual(r.map((i) => i.id), ["a"])
    assert.equal(idas, 1)
  })

  it("fonte vazia devolve lista vazia", async () => {
    const { r } = await coletar([], 300, 10)
    assert.deepEqual(r, [])
  })

  it("nada se perde quando o lote divide a fonte exatamente", async () => {
    const itens: Item[] = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, ok: i >= 20 }))
    const { r } = await coletar(itens, 300, 10)
    assert.equal(r.length, 10)
  })

  it("nunca devolve mais que o limite", async () => {
    const itens: Item[] = Array.from({ length: 500 }, (_, i) => ({ id: `i${i}`, ok: true }))
    const { r } = await coletar(itens, 300, 300)
    assert.equal(r.length, 300)
  })

  it("respeita o teto de lotes em vez de rodar para sempre", async () => {
    const itens: Item[] = Array.from({ length: 1000 }, (_, i) => ({ id: `i${i}`, ok: false }))
    const { r, idas } = await coletar(itens, 300, 10, 5)
    assert.deepEqual(r, [])
    assert.equal(idas, 5)
  })
})
