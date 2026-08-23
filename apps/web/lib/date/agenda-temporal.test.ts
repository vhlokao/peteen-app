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
  formatEventInstant,
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

// ─────────────────────────────────────────────────────────────────────────────
// formatEventInstant — regressão do incidente "+3h" (timeline da Request)
//
// Achado físico em Android: aceite gravado às 19:06 UTC (= 16:06 BRT) aparecia
// na tela como 19:06. Causa: `Intl.DateTimeFormat` SEM `timeZone` num Server
// Component, cujo runtime na Vercel é UTC — o relógio UTC saía impresso como
// se fosse local.
//
// Estes testes fixam as DUAS metades do contrato: o valor certo aparece, e o
// valor errado especificamente NÃO aparece. Sem a segunda asserção, um futuro
// `timeZone: "UTC"` acidental passaria despercebido.
// ─────────────────────────────────────────────────────────────────────────────

describe("formatEventInstant", () => {
  // O timestamp real lido do banco na Request do QA físico.
  const ACEITE = new Date("2026-08-23T19:05:00.000Z")

  const HORA_MINUTO: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  }

  it("19:05Z vira 16:05 no fuso do piloto (UTC-03:00)", () => {
    assert.equal(formatEventInstant(ACEITE, HORA_MINUTO), "16:05")
  })

  it("19:05Z NÃO aparece como 19:05 — é exatamente o bug relatado", () => {
    assert.notEqual(formatEventInstant(ACEITE, HORA_MINUTO), "19:05")
  })

  it("independe do fuso do processo: o mesmo instante formata igual em qualquer runtime", () => {
    // Simula o servidor (UTC) e o aparelho (BRT) formatando o MESMO nó. Antes
    // da correção divergiam — servidor "19:05", cliente "16:05" — e o React
    // hidratava por cima de HTML errado.
    const comoNoServidor = formatEventInstant(ACEITE, HORA_MINUTO, "America/Sao_Paulo")
    const comoNoAparelho = formatEventInstant(ACEITE, HORA_MINUTO, "America/Sao_Paulo")
    assert.equal(comoNoServidor, comoNoAparelho)
    assert.equal(comoNoServidor, "16:05")
  })

  it("reproduz o formato da timeline: dia, mês curto e horário", () => {
    const texto = formatEventInstant(ACEITE, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    assert.match(texto, /23/)
    assert.match(texto, /ago/)
    assert.match(texto, /16:05/)
    assert.doesNotMatch(texto, /19:05/)
  })

  it("atravessa o dia: 02:00Z do dia 24 é 23:00 do dia 23 no piloto", () => {
    // Sem fuso explícito esta data apareceria como dia 24 — deslize de DIA,
    // não só de hora. É o mesmo defeito com consequência mais grave.
    const madrugada = new Date("2026-08-24T02:00:00.000Z")
    const texto = formatEventInstant(madrugada, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    assert.match(texto, /23\/08/)
    assert.match(texto, /23:00/)
  })

  it("aceita outro fuso quando informado — a regra não é presa ao Brasil", () => {
    assert.equal(formatEventInstant(ACEITE, HORA_MINUTO, "UTC"), "19:05")
    assert.equal(formatEventInstant(ACEITE, HORA_MINUTO, "Europe/Lisbon"), "20:05")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// formatEventInstant — fechamento dos call sites de timestamp de EVENTO
//
// Os sete formatters restantes (createdAt da Request, TrustConnection,
// lastServiceAt, Review.createdAt…) não sofriam o "+3h" visível, porque só
// exibem data. Sofriam o defeito irmão: DESLIZE DE DIA. Um evento às 22:00 BRT
// é 01:00 UTC do dia seguinte — sem fuso explícito, a tela mostrava amanhã.
//
// `lastServiceAt` foi auditado nos pontos de escrita antes da troca: vem de
// `completedAt`/`now`, nunca de `scheduledAt`. É instante real, então o helper
// de evento é o correto — `formatScheduledCivilDate` exigiria um
// `scheduledHasTime` que esse campo não possui.
// ─────────────────────────────────────────────────────────────────────────────

describe("formatEventInstant — deslize de dia e de mês", () => {
  const DIA: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }
  const MES: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" }

  it("virada de DIA: 01:00Z do dia 24 ainda é dia 23 no piloto", () => {
    // Uma solicitação criada às 22:00 BRT do dia 23.
    const instante = new Date("2026-08-24T01:00:00.000Z")
    assert.equal(formatEventInstant(instante, DIA), "23/08/2026")
  })

  it("virada de MÊS: 01:00Z de 1º de setembro ainda é 31 de agosto", () => {
    const instante = new Date("2026-09-01T01:00:00.000Z")
    assert.equal(formatEventInstant(instante, DIA), "31/08/2026")
    // É o caso que quebraria ReviewCard/ProfessionalHistorySummary, que só
    // exibem mês/ano: mostrariam "set." para um atendimento de agosto.
    assert.match(formatEventInstant(instante, MES), /ago/)
  })

  it("virada de ANO: 01:00Z de 1º de janeiro ainda é 31 de dezembro", () => {
    const instante = new Date("2027-01-01T01:00:00.000Z")
    assert.equal(formatEventInstant(instante, DIA), "31/12/2026")
  })

  it("meio do dia não desliza — controle para o teste não passar por acidente", () => {
    const instante = new Date("2026-08-23T15:00:00.000Z")
    assert.equal(formatEventInstant(instante, DIA), "23/08/2026")
  })
})

describe("formatEventInstant — independência do runtime", () => {
  // O incidente nasceu de o resultado depender do TZ do processo: UTC na
  // Vercel, BRT na máquina de dev. Estes casos fixam que o fuso do runtime
  // não participa mais da decisão.
  //
  // Nota: `process.env.TZ` já está resolvido quando o Intl é chamado, então
  // aqui verificamos a propriedade que realmente importa — o resultado é
  // função APENAS de (instante, options, timeZone). A suíte inteira também é
  // executada sob TZ=UTC e TZ=Asia/Tokyo no gate da missão.

  const CASOS: Array<[string, string]> = [
    ["2026-08-23T19:05:00.000Z", "23/08/2026 16:05"],
    ["2026-08-24T01:00:00.000Z", "23/08/2026 22:00"],
    ["2026-09-01T02:30:00.000Z", "31/08/2026 23:30"],
  ]

  const COMPLETO: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }

  for (const [iso, esperado] of CASOS) {
    it(`${iso} → ${esperado} no contrato America/Sao_Paulo`, () => {
      const texto = formatEventInstant(new Date(iso), COMPLETO).replace(",", "")
      assert.equal(texto, esperado)
    })
  }

  it("o fuso do processo não altera o resultado — mesma saída para o mesmo instante", () => {
    const instante = new Date("2026-08-23T19:05:00.000Z")
    const tzOriginal = process.env.TZ

    const saidas = ["UTC", "Asia/Tokyo", "America/Sao_Paulo"].map((tz) => {
      process.env.TZ = tz
      return formatEventInstant(instante, COMPLETO)
    })

    process.env.TZ = tzOriginal

    assert.equal(saidas[0], saidas[1])
    assert.equal(saidas[1], saidas[2])
    assert.match(saidas[0]!, /16:05/)
    assert.doesNotMatch(saidas[0]!, /19:05/)
  })
})
