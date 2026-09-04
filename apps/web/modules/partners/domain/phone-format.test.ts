/**
 * Testes focados — máscara de telefone BR para Partner.
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/partners/domain/phone-format.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede ou Next.js.
 *
 * GATE-8-PARTNER-INPUT-MASKS-001: digitação progressiva, backspace, colar
 * formatado, colar só dígitos, edição no meio da string.
 *
 * GATE-8-PARTNER-INPUT-MASKS-FIX-002: a versão anterior fazia
 * `extractPhoneDigits(value).slice(0, 11)` cegamente — um telefone colado
 * COM código de país (`+55 11 99999-9999` → 13 dígitos) virava
 * `55119999999` depois do slice, lendo o "55" do DDI como DDD e perdendo os
 * 2 dígitos finais do número real. Os testes "teto de dígitos" desta versão
 * anterior EXERCITAVAM esse bug (esperavam a truncagem cega como correta) —
 * foram substituídos pelos casos abaixo, que travam a regra nova: só stripar
 * "55" quando o comprimento (12/13 dígitos) prova que é DDI, nunca truncar
 * silenciosamente uma entrada inválida para parecer um número válido.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { formatBrazilianPhone, extractPhoneDigits } from "./phone-format.ts"

describe("extractPhoneDigits", () => {
  it("remove tudo que não é dígito", () => {
    assert.equal(extractPhoneDigits("(11) 99999-9999"), "11999999999")
    assert.equal(extractPhoneDigits("+55 11 99999-9999"), "5511999999999")
  })

  it("string vazia → string vazia", () => {
    assert.equal(extractPhoneDigits(""), "")
  })
})

describe("formatBrazilianPhone — digitação progressiva", () => {
  it("vazio permanece vazio", () => {
    assert.equal(formatBrazilianPhone(""), "")
  })

  it("1-2 dígitos abre o DDD sem fechar parêntese", () => {
    assert.equal(formatBrazilianPhone("1"), "(1")
    assert.equal(formatBrazilianPhone("11"), "(11")
  })

  it("3-10 dígitos formata progressivamente sem exigir o número completo", () => {
    assert.equal(formatBrazilianPhone("119"), "(11) 9")
    assert.equal(formatBrazilianPhone("1199999"), "(11) 9999-9")
  })

  it("10 dígitos totais → fixo (DDD + 4 + 4)", () => {
    assert.equal(formatBrazilianPhone("1133334444"), "(11) 3333-4444")
  })

  it("11 dígitos totais → celular (DDD + 5 + 4)", () => {
    assert.equal(formatBrazilianPhone("11999999999"), "(11) 99999-9999")
  })
})

describe("formatBrazilianPhone — backspace", () => {
  it("apagar o último dígito do celular reformata para o estado de 10 dígitos, não deixa lixo de máscara", () => {
    // Simula o app chamando a função de novo com o valor já sem o último
    // caractere digitado — comportamento real de um input controlado.
    const comOnzeDigitos = formatBrazilianPhone("11999999999")
    assert.equal(comOnzeDigitos, "(11) 99999-9999")
    const apos_backspace = formatBrazilianPhone(extractPhoneDigits(comOnzeDigitos).slice(0, -1))
    assert.equal(apos_backspace, "(11) 9999-9999")
  })

  it("apagar até restar só o DDD não deixa parêntese ou traço soltos", () => {
    assert.equal(formatBrazilianPhone("11"), "(11")
    assert.equal(formatBrazilianPhone("1"), "(1")
    assert.equal(formatBrazilianPhone(""), "")
  })
})

describe("formatBrazilianPhone — colar valores", () => {
  it("colar um número já formatado produz o mesmo resultado (idempotente)", () => {
    assert.equal(formatBrazilianPhone("(11) 99999-9999"), "(11) 99999-9999")
    assert.equal(formatBrazilianPhone("(11) 3333-4444"), "(11) 3333-4444")
  })

  it("colar só dígitos formata igual a digitar", () => {
    assert.equal(formatBrazilianPhone("11999999999"), formatBrazilianPhone("(11) 99999-9999"))
  })

  it("colar um valor legado salvo sem pontuação (dado real do banco) formata corretamente", () => {
    // Valor real observado no banco de DEMO antes desta correção.
    assert.equal(formatBrazilianPhone("11980674064"), "(11) 98067-4064")
  })

  it("colar com espaços, hífens e parênteses variados normaliza para o mesmo formato", () => {
    assert.equal(formatBrazilianPhone("11 9 9999-9999"), "(11) 99999-9999")
    assert.equal(formatBrazilianPhone("(11)99999-9999"), "(11) 99999-9999")
  })
})

describe("formatBrazilianPhone — edição no meio da string", () => {
  it("inserir um dígito no meio de um número existente reformata a partir dos dígitos resultantes", () => {
    // "(11) 9999-999" com um dígito inserido no meio vira 8 dígitos totais —
    // o app sempre chama a função com o VALOR RESULTANTE do input, não com
    // um diff; a função só precisa formatar corretamente esse resultado.
    assert.equal(formatBrazilianPhone("11399994444"), "(11) 39999-4444")
  })
})

describe("formatBrazilianPhone — GATE-8-FIX-002: DDI +55 normalizado com segurança", () => {
  it("+55 com celular (13 dígitos) vira o doméstico correto — caso obrigatório da missão", () => {
    assert.equal(formatBrazilianPhone("+55 11 99999-9999"), "(11) 99999-9999")
  })

  it("55 sem '+' na frente, só dígitos (13 dígitos) — mesmo resultado", () => {
    assert.equal(formatBrazilianPhone("5511999999999"), "(11) 99999-9999")
  })

  it("+55 com fixo (12 dígitos) vira o doméstico correto — caso obrigatório da missão", () => {
    assert.equal(formatBrazilianPhone("+55 11 3333-4444"), "(11) 3333-4444")
  })

  it("o DDI removido é exatamente o número fornecido, não um número diferente", () => {
    // Regressão exata do review: antes, +55 11 99999-9999 virava
    // "(55) 19999-9999" (lia "55" como DDD e perdia os 2 últimos dígitos).
    const resultado = formatBrazilianPhone("+55 11 99999-9999")
    assert.notEqual(resultado, "(55) 19999-9999")
    assert.equal(extractPhoneDigits(resultado), "11999999999")
  })
})

describe("formatBrazilianPhone — GATE-8-FIX-002: DDD 55 legítimo nunca é confundido com DDI", () => {
  it("doméstico de 11 dígitos com DDD 55 (celular) preserva o DDD intacto", () => {
    // DDD 55 é real (Santa Maria/RS) — 11 dígitos é doméstico, não DDI.
    assert.equal(formatBrazilianPhone("55999999999"), "(55) 99999-9999")
  })

  it("doméstico de 10 dígitos com DDD 55 (fixo) preserva o DDD intacto", () => {
    assert.equal(formatBrazilianPhone("5533334444"), "(55) 3333-4444")
  })
})

describe("formatBrazilianPhone — GATE-8-FIX-002: entrada excedente não vira outro telefone válido silenciosamente", () => {
  it("12 dígitos que NÃO começam com 55 não são tratados como DDI — ficam visivelmente inválidos", () => {
    const resultado = formatBrazilianPhone("119999999999")
    // NÃO pode colapsar para o mesmo resultado de um celular válido de 11
    // dígitos — isso seria "virar silenciosamente outro telefone válido".
    assert.notEqual(resultado, formatBrazilianPhone("11999999999"))
    // Nenhum dígito foi descartado: todos os 12 continuam presentes no
    // resultado, prontos para a validação do schema rejeitar (teto de 11).
    assert.equal(extractPhoneDigits(resultado), "119999999999")
  })

  it("entrada bem maior que um telefone válido mantém todos os dígitos visíveis", () => {
    const resultado = formatBrazilianPhone("119999999999999")
    assert.equal(extractPhoneDigits(resultado), "119999999999999")
    assert.equal(resultado.replace(/\D/g, "").length, 15)
  })

  it("12/13 dígitos começando em 55 continuam sendo tratados como DDI (não caem na regra de excedente)", () => {
    // Garante que a regra de excedente não amplia por engano o DDI: um
    // valor de 12/13 dígitos com prefixo 55 já foi resolvido por
    // stripBrazilCountryCode ANTES de chegar na checagem de excedente.
    assert.equal(formatBrazilianPhone("551199999999"), "(11) 9999-9999")
  })
})
