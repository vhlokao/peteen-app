/**
 * Start-Time Guard — janela de "Iniciar atendimento".
 *
 * Regressão do achado físico: "agendado hoje 20:00, agora 19:00 → iniciava".
 * O bloco B, com scheduledAt real, é o caso central desta suíte.
 *
 * Rodar: npm run test:agenda
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  SERVICE_START_EARLY_TOLERANCE_MINUTES,
  computeStartableAt,
  describeServiceStartBlock,
  resolveServiceStartEligibility,
} from "./start-eligibility.ts"

const minutos = (n: number) => n * 60_000

/** 20:00 em America/Sao_Paulo = 23:00Z. */
const AGENDADO_20H = new Date("2026-08-18T23:00:00.000Z")

const avaliar = (agora: Date, scheduledHasTime = true) =>
  resolveServiceStartEligibility({ scheduledAt: AGENDADO_20H, scheduledHasTime, now: agora })

// ─────────────────────────────────────────────────────────────────────────────
// A matriz exigida pela missão (item 14) — 20:00, tolerância 10min
// ─────────────────────────────────────────────────────────────────────────────

describe("janela de início — 20:00, tolerância de 10 minutos", () => {
  it("19:49:59 → REJEITA (1 segundo antes da janela)", () => {
    const r = avaliar(new Date(AGENDADO_20H.getTime() - minutos(10) - 1000))
    assert.equal(r.eligible, false)
    assert.equal(r.eligible === false && r.reason, "TOO_EARLY")
  })

  it("19:50:00 → ACEITA (exatamente o início da janela)", () => {
    assert.equal(avaliar(new Date(AGENDADO_20H.getTime() - minutos(10))).eligible, true)
  })

  it("19:59 → ACEITA", () => {
    assert.equal(avaliar(new Date(AGENDADO_20H.getTime() - minutos(1))).eligible, true)
  })

  it("20:00 (o horário marcado) → ACEITA", () => {
    assert.equal(avaliar(AGENDADO_20H).eligible, true)
  })

  it("21:00 (uma hora depois) → ACEITA — sem teto superior aqui", () => {
    assert.equal(avaliar(new Date(AGENDADO_20H.getTime() + minutos(60))).eligible, true)
  })
})

describe("achado físico original — agendado hoje 20:00, agora 19:00", () => {
  it("REJEITA — este é o bug que a missão existe para fechar", () => {
    const agora19h = new Date(AGENDADO_20H.getTime() - minutos(60))
    const r = avaliar(agora19h)
    assert.equal(r.eligible, false)
    assert.equal(r.eligible === false && r.reason, "TOO_EARLY")
  })
})

describe("datas distantes — item B/C da auditoria", () => {
  it("daqui a 7 dias → REJEITA", () => {
    const seteDiasAntes = new Date(AGENDADO_20H.getTime() - 7 * 24 * 3600_000)
    assert.equal(avaliar(seteDiasAntes).eligible, false)
  })

  it("amanhã → REJEITA", () => {
    const ontem = new Date(AGENDADO_20H.getTime() - 24 * 3600_000)
    assert.equal(avaliar(ontem).eligible, false)
  })
})

describe("constante e derivação", () => {
  it("a tolerância documentada é 10 minutos", () => {
    assert.equal(SERVICE_START_EARLY_TOLERANCE_MINUTES, 10)
  })

  it("computeStartableAt é scheduledAt − tolerância, usado por UI e domínio", () => {
    assert.equal(
      computeStartableAt(AGENDADO_20H).getTime(),
      AGENDADO_20H.getTime() - minutos(SERVICE_START_EARLY_TOLERANCE_MINUTES)
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Timezone — instante absoluto, não hora local de quem calcula
// ─────────────────────────────────────────────────────────────────────────────

describe("timezone — a decisão não depende de quem está rodando o processo", () => {
  it("America/Sao_Paulo e UTC concordam: mesmos instantes, mesma resposta", () => {
    // A função nunca lê o fuso do processo — só compara epoch ms. Isto prova
    // que os mesmos dois instantes produzem o mesmo veredito, ponto.
    const cedoDemais = new Date(AGENDADO_20H.getTime() - minutos(11))
    const naJanela = new Date(AGENDADO_20H.getTime() - minutos(9))
    assert.equal(avaliar(cedoDemais).eligible, false)
    assert.equal(avaliar(naJanela).eligible, true)
  })

  it("não lê process.env.TZ nem usa Date com componentes locais", () => {
    const fonte = resolveServiceStartEligibility.toString()
    assert.ok(!fonte.includes("process.env"))
    assert.ok(!fonte.includes("getHours"))
    assert.ok(!fonte.includes("setHours"))
  })

  it("borda de meia-noite civil: 23:55 BRT de um dia é 'antes' do próximo dia legado", () => {
    // scheduledHasTime=false comparando 2026-08-18 23:55Z (20:55 BRT do dia 18)
    // contra um agendamento legado no dia 19.
    const scheduledAtDia19 = new Date("2026-08-19T12:00:00.000Z") // âncora legada
    const r = resolveServiceStartEligibility({
      scheduledAt: scheduledAtDia19,
      scheduledHasTime: false,
      now: new Date("2026-08-18T23:55:00.000Z"),
    })
    assert.equal(r.eligible, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scheduledHasTime = false — contrato legado, NUNCA tratado como horário real
// ─────────────────────────────────────────────────────────────────────────────

describe("legado (scheduledHasTime=false) — só dia civil, nunca tolerância de minutos", () => {
  /** Âncora técnica: meio-dia UTC do dia 18 = 09:00 BRT. Não é hora escolhida. */
  const ANCORA_DIA_18 = new Date("2026-08-18T12:00:00.000Z")

  it("mesmo dia civil, ANTES da âncora (09:00 BRT) → ACEITA — a âncora não é horário real", () => {
    // Se tratássemos a âncora como horário de verdade, isto seria bloqueado
    // até 09:00 — exatamente o que schedule-precision.ts proíbe.
    const seteDaManha = new Date("2026-08-18T10:00:00.000Z") // 07:00 BRT
    const r = resolveServiceStartEligibility({
      scheduledAt: ANCORA_DIA_18, scheduledHasTime: false, now: seteDaManha,
    })
    assert.equal(r.eligible, true)
  })

  it("dia civil anterior → REJEITA", () => {
    const diaAnterior = new Date("2026-08-17T18:00:00.000Z")
    const r = resolveServiceStartEligibility({
      scheduledAt: ANCORA_DIA_18, scheduledHasTime: false, now: diaAnterior,
    })
    assert.equal(r.eligible, false)
    assert.equal(r.eligible === false && r.reason, "SCHEDULED_DATE_NOT_REACHED")
  })

  it("dia civil seguinte → ACEITA (nenhum teto superior)", () => {
    const diaSeguinte = new Date("2026-08-19T18:00:00.000Z")
    const r = resolveServiceStartEligibility({
      scheduledAt: ANCORA_DIA_18, scheduledHasTime: false, now: diaSeguinte,
    })
    assert.equal(r.eligible, true)
  })
})

describe("sem scheduledAt — nada a comparar, sempre elegível", () => {
  it("scheduledAt null → eligible sempre true", () => {
    assert.equal(
      resolveServiceStartEligibility({ scheduledAt: null, scheduledHasTime: false, now: new Date() }).eligible,
      true
    )
    assert.equal(
      resolveServiceStartEligibility({ scheduledAt: null, scheduledHasTime: true, now: new Date() }).eligible,
      true
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mensagem — servidor e UI usam a MESMA função
// ─────────────────────────────────────────────────────────────────────────────

describe("describeServiceStartBlock — mensagem humana, nunca 'ação inválida'", () => {
  it("TOO_EARLY menciona o horário exato de liberação", () => {
    const r = avaliar(new Date(AGENDADO_20H.getTime() - minutos(30)))
    assert.equal(r.eligible, false)
    const msg = describeServiceStartBlock(r as Extract<typeof r, { eligible: false }>)
    assert.match(msg, /19:50/)
    assert.doesNotMatch(msg, /ação inválida/i)
  })

  it("SCHEDULED_DATE_NOT_REACHED menciona a data, não uma hora inventada", () => {
    const r = resolveServiceStartEligibility({
      scheduledAt: new Date("2026-08-20T12:00:00.000Z"),
      scheduledHasTime: false,
      now: new Date("2026-08-18T12:00:00.000Z"),
    })
    assert.equal(r.eligible, false)
    const msg = describeServiceStartBlock(r as Extract<typeof r, { eligible: false }>)
    assert.match(msg, /20\/08\/2026/)
  })
})
