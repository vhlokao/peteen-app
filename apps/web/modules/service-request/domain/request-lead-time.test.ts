/**
 * Testes focados — antecedência mínima de criação de solicitação.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/service-request/domain/request-lead-time.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 *
 * REGRESSÃO NOMEADA: existe por causa de um bug real observado em E2E
 * (request cmsmh93rt…), criada 21:12:29 para 21:13:00 — 31 segundos de janela.
 * Foi aceita pelo sistema e expirou 40s depois.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  LEAD_TIME_ERROR_MESSAGE,
  MIN_REQUEST_LEAD_TIME_MINUTES,
  primeiroHorarioValido,
  respeitaAntecedenciaMinima,
} from "./request-lead-time.ts"
import {
  SCHEDULED_SAFETY_MARGIN_HOURS,
  getRequestExpiryInfo,
} from "./request-expiry.ts"

const AGORA = new Date("2026-08-09T21:00:00.000Z")
const emMinutos = (m: number) => new Date(AGORA.getTime() + m * 60_000)
const emSegundos = (s: number) => new Date(AGORA.getTime() + s * 1000)

describe("respeitaAntecedenciaMinima — limites aprovados", () => {
  it("14min59s → REJEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(emSegundos(14 * 60 + 59), AGORA), false)
  })

  it("15min → ACEITA (limite inclusivo)", () => {
    assert.equal(respeitaAntecedenciaMinima(emMinutos(15), AGORA), true)
  })

  it("30min → ACEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(emMinutos(30), AGORA), true)
  })

  it("59min → ACEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(emMinutos(59), AGORA), true)
  })

  it("1h+ → ACEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(emMinutos(60), AGORA), true)
    assert.equal(respeitaAntecedenciaMinima(emMinutos(24 * 60), AGORA), true)
  })
})

describe("regressão do bug real observado", () => {
  it("31 segundos de antecedência (caso cmsmh93rt…) → REJEITA", () => {
    // createdAt 21:12:29 → scheduledAt 21:13:00
    const criacao = new Date("2026-08-10T00:12:29.657Z")
    const agendado = new Date("2026-08-10T00:13:00.000Z")
    assert.equal(respeitaAntecedenciaMinima(agendado, criacao), false)
  })

  it("horário no passado → REJEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(emMinutos(-1), AGORA), false)
  })

  it("exatamente agora → REJEITA", () => {
    assert.equal(respeitaAntecedenciaMinima(AGORA, AGORA), false)
  })
})

describe("primeiroHorarioValido", () => {
  it("é exatamente agora + 15 minutos", () => {
    assert.equal(primeiroHorarioValido(AGORA).getTime(), emMinutos(15).getTime())
  })

  it("o valor que ele devolve é sempre aceito pela própria regra", () => {
    // Invariante: a UI usa esta função para oferecer horários. Se ela
    // devolvesse um instante que o servidor recusa, a UI ofereceria algo
    // impossível — exatamente o tipo de incoerência que originou este arquivo.
    assert.equal(respeitaAntecedenciaMinima(primeiroHorarioValido(AGORA), AGORA), true)
  })
})

describe("coerência com a regra de EXPIRAÇÃO (não se substituem)", () => {
  it("uma request no limite (15min) nasce válida e NÃO já expirada", () => {
    const agendado = emMinutos(15)
    assert.equal(respeitaAntecedenciaMinima(agendado, AGORA), true)
    const info = getRequestExpiryInfo(AGORA, agendado, AGORA)
    assert.equal(info.isExpired, false, "não pode nascer expirada")
    assert.ok(info.msRemaining !== null && info.msRemaining > 0)
  })

  it("com gap < 1h o prazo de resposta é o próprio scheduledAt", () => {
    // Comportamento preservado de propósito: a antecedência mínima NÃO altera
    // a regra de expiração, apenas impede os casos degenerados.
    const agendado = emMinutos(30)
    const info = getRequestExpiryInfo(AGORA, agendado, AGORA)
    assert.equal(info.effectiveExpiry.getTime(), agendado.getTime())
  })

  it("com gap > 1h a margem de segurança de 1h continua valendo", () => {
    const agendado = emMinutos(180)
    const info = getRequestExpiryInfo(AGORA, agendado, AGORA)
    const esperado = agendado.getTime() - SCHEDULED_SAFETY_MARGIN_HOURS * 3600_000
    assert.equal(info.effectiveExpiry.getTime(), esperado)
  })

  it("as duas constantes são independentes — nenhuma substituiu a outra", () => {
    assert.equal(MIN_REQUEST_LEAD_TIME_MINUTES, 15)
    assert.equal(SCHEDULED_SAFETY_MARGIN_HOURS, 1)
  })
})

describe("mensagem ao usuário", () => {
  it("é única e cita o mesmo número da constante", () => {
    assert.equal(
      LEAD_TIME_ERROR_MESSAGE,
      "Escolha um horário com pelo menos 15 minutos de antecedência."
    )
    assert.ok(LEAD_TIME_ERROR_MESSAGE.includes(String(MIN_REQUEST_LEAD_TIME_MINUTES)))
  })
})
