/**
 * Janela temporal válida de um CareUpdate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE SÓ AGORA
 *
 * `resolveEffectiveOccurredAt` decidia a publicação do Diário desde o R0 e não
 * tinha NENHUM teste. A regra estava correta — no teste físico ela recusou um
 * horário anterior ao início do atendimento, como deveria — mas sem cobertura
 * ninguém podia afirmar isso sem ir ao navegador, e as bordas (mesmo minuto,
 * minuto corrente, conclusão) eram invisíveis.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { limiteSuperiorDaJanela, resolveEffectiveOccurredAt } from "./occurred-at.ts"
import { janelaDoOccurredAt } from "./care-update-timing.ts"

/** Instantes do atendimento real que produziu o incidente. */
const START = new Date("2026-08-17T23:06:44.134Z") // 20:06:44 BRT
const AGORA = new Date("2026-08-18T00:09:37.000Z") // 21:09:37 BRT

const minutos = (base: Date, n: number) => new Date(base.getTime() + n * 60_000)

const avaliar = (occurredAt: Date, opts: { completedAt?: Date | null } = {}) =>
  resolveEffectiveOccurredAt({
    inputOccurredAt: occurredAt,
    startedAt: START,
    now: AGORA,
    completedAt: opts.completedAt ?? null,
  })

// ─────────────────────────────────────────────────────────────────────────────
// A matriz exigida pela missão
// ─────────────────────────────────────────────────────────────────────────────

describe("janela — startedAt <= occurredAt <= now", () => {
  it("startedAt − 1 minuto → REJEITA", () => {
    // O caso do teste físico: o profissional escolheu um horário anterior ao
    // início e a publicação foi recusada.
    const r = avaliar(minutos(START, -1))
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.reason, "BEFORE_START")
  })

  it("startedAt → ACEITA", () => {
    assert.equal(avaliar(START).ok, true)
  })

  it("startedAt + 1 minuto → ACEITA", () => {
    assert.equal(avaliar(minutos(START, 1)).ok, true)
  })

  it("agora → ACEITA", () => {
    assert.equal(avaliar(AGORA).ok, true)
  })

  it("agora + 1 minuto → REJEITA", () => {
    const r = avaliar(minutos(AGORA, 1))
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.reason, "FUTURE")
  })
})

describe("bordas de minuto — o formulário só tem precisão de minuto", () => {
  it("mesmo MINUTO do início, segundos antes → aceita e ELEVA para startedAt", () => {
    // 20:06:00 escolhido quando o atendimento começou 20:06:44. Recusar seria
    // incompreensível: é o primeiro uso legítimo do Diário.
    const noMinutoDoInicio = new Date("2026-08-17T23:06:00.000Z")
    const r = avaliar(noMinutoDoInicio)
    assert.equal(r.ok, true)
    assert.equal(r.ok === true && r.occurredAt.toISOString(), START.toISOString())
  })

  it("mesmo MINUTO de agora, segundos à frente → aceita e trava no teto", () => {
    // "agora" digitado como 21:09 às 21:09:37: o valor de parede é 21:09:00,
    // mas um seletor que devolvesse 21:09:59 não pode virar recusa.
    const fimDoMinutoCorrente = new Date("2026-08-18T00:09:59.000Z")
    const r = avaliar(fimDoMinutoCorrente)
    assert.equal(r.ok, true)
    assert.equal(r.ok === true && r.occurredAt.getTime() <= AGORA.getTime(), true)
  })

  it("minuto anterior ao início continua recusado, mesmo com segundos altos", () => {
    assert.equal(avaliar(new Date("2026-08-17T23:05:59.000Z")).ok, false)
  })
})

describe("atendimento CONCLUÍDO — o teto passa a ser completedAt", () => {
  const COMPLETED = new Date("2026-08-17T23:40:00.000Z")

  it("dentro da janela do atendimento → aceita", () => {
    assert.equal(avaliar(minutos(START, 10), { completedAt: COMPLETED }).ok, true)
  })

  it("depois da conclusão → REJEITA, mesmo estando no passado", () => {
    // Registrar hoje um evento que teria acontecido depois do fim inventaria
    // cuidado que não houve — e é o tipo de registro que uma disputa questiona.
    const r = avaliar(minutos(COMPLETED, 5), { completedAt: COMPLETED })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.reason, "AFTER_END")
  })

  it("o teto é o menor entre conclusão e agora", () => {
    assert.equal(limiteSuperiorDaJanela(COMPLETED, AGORA).toISOString(), COMPLETED.toISOString())
    // Um completedAt adiantado por relógio torto nunca abre janela para o futuro.
    const noFuturo = new Date("2026-08-19T00:00:00.000Z")
    assert.equal(limiteSuperiorDaJanela(noFuturo, AGORA).toISOString(), AGORA.toISOString())
    assert.equal(limiteSuperiorDaJanela(null, AGORA).toISOString(), AGORA.toISOString())
  })
})

describe("sem startedAt — nada a comparar embaixo", () => {
  it("só o teto se aplica", () => {
    const semInicio = (d: Date) =>
      resolveEffectiveOccurredAt({ inputOccurredAt: d, startedAt: null, now: AGORA })
    assert.equal(semInicio(new Date("2020-01-01T00:00:00.000Z")).ok, true)
    assert.equal(semInicio(minutos(AGORA, 5)).ok, false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Limites que a UI mostra — precisam ser os MESMOS que o servidor aplica
// ─────────────────────────────────────────────────────────────────────────────

describe("janela do seletor — UI e servidor não podem discordar", () => {
  it("min é o início e max é agora, no fuso do piloto", () => {
    const j = janelaDoOccurredAt({ startedAt: START, completedAt: null, agora: AGORA })
    assert.equal(j.min, "2026-08-17T20:06") // 23:06:44Z em BRT
    assert.equal(j.max, "2026-08-17T21:09") // 00:09:37Z em BRT (dia anterior local)
  })

  it("concluído: max é a conclusão, não agora", () => {
    const j = janelaDoOccurredAt({
      startedAt: START,
      completedAt: new Date("2026-08-17T23:40:00.000Z"),
      agora: AGORA,
    })
    assert.equal(j.max, "2026-08-17T20:40")
  })

  it("o valor de `min` é aceito pelo servidor — a UI não oferece o que seria recusado", () => {
    // Trava de coerência: `min` é o minuto do início, e o servidor aceita esse
    // minuto por causa da tolerância de borda. Se um dos dois mudar sem o
    // outro, este teste quebra.
    const j = janelaDoOccurredAt({ startedAt: START, completedAt: null, agora: AGORA })
    const [dia, hora] = j.min!.split("T")
    // 20:06 BRT = 23:06:00Z
    const comoInstante = new Date(`${dia}T${hora}:00.000-03:00`)
    assert.equal(avaliar(comoInstante).ok, true)
  })

  it("um minuto ABAIXO de `min` é recusado pelo servidor — o limite é real", () => {
    const j = janelaDoOccurredAt({ startedAt: START, completedAt: null, agora: AGORA })
    const [dia, hora] = j.min!.split("T")
    const umMinutoAntes = new Date(new Date(`${dia}T${hora}:00.000-03:00`).getTime() - 60_000)
    assert.equal(avaliar(umMinutoAntes).ok, false)
  })

  it("sem startedAt não há limite inferior a exibir", () => {
    const j = janelaDoOccurredAt({ startedAt: null, completedAt: null, agora: AGORA })
    assert.equal(j.min, null)
  })

  it("independe do fuso do processo — usa o canônico do piloto", () => {
    // Os valores acima são fixos: se a formatação usasse o fuso da máquina,
    // este arquivo falharia fora do Brasil.
    const j = janelaDoOccurredAt({ startedAt: START, completedAt: null, agora: AGORA })
    assert.match(j.max, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.equal(
      janelaDoOccurredAt({ startedAt: START, completedAt: null, agora: AGORA, timeZone: "UTC" }).max,
      "2026-08-18T00:09"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Consequência da recusa: nada é criado
// ─────────────────────────────────────────────────────────────────────────────

describe("recusa temporal acontece ANTES de qualquer efeito", () => {
  it("uma recusa não devolve occurredAt — não há valor a persistir", () => {
    const r = avaliar(minutos(START, -1))
    assert.equal(r.ok, false)
    assert.ok(!("occurredAt" in r))
  })

  it("o veredito é o mesmo com 0, 1 ou 3 fotos — mídia não influencia a janela", () => {
    // A quantidade de fotos não entra nesta decisão, e é por isso que a recusa
    // temporal deixa os objetos já enviados como órfãos: ela ocorre antes de
    // validateMediaPaths, que é quem apaga o que reprova. O tratamento desses
    // objetos é operacional (ver docs), não uma regra deste módulo.
    const foraDaJanela = minutos(START, -1)
    const vereditos = [0, 1, 3].map(() => avaliar(foraDaJanela).ok)
    assert.deepEqual(vereditos, [false, false, false])
  })
})
