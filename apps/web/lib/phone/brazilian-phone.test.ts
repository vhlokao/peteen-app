/**
 * PETEEN-PHONE-WHATSAPP-INPUT-FIX-001 — fonte única de telefone BR.
 *
 * Matriz do RESULT 5649543060 (auditoria) + decisões do orquestrador:
 * forma canônica = 10/11 dígitos domésticos; DDI 55 e zero de tronco removidos
 * só quando inequívocos; DDD sem 0; celular de 11 com 9; fixo de 10 aceito;
 * inválido nunca gera wa.me.
 *
 * Rodar: npm run test:phone
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  brazilianPhoneOptional,
  brazilianPhoneRequired,
  extractPhoneDigits,
  formatBrazilianPhone,
  formatStoredBrazilianPhone,
  isValidBrazilianPhone,
  normalizeBrazilianPhone,
  phoneInputInitialValue,
  toWhatsAppUrl,
} from "./brazilian-phone.ts"

/**
 * Cópia LITERAL do `buildWhatsAppUrl` removido de
 * app/(tutor)/tutor/requests/[requestId]/page.tsx — só para provar que todo
 * link que ele gerava CORRETAMENTE continua idêntico.
 */
function legacyBuildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const withCountryCode = digits.length >= 12 ? digits : `55${digits}`
  return `https://wa.me/${withCountryCode}`
}

type Caso = { nome: string; entrada: string; canonico: string | null }

const CASOS: Caso[] = [
  // válidos
  { nome: "11 dígitos (celular)", entrada: "11987654321", canonico: "11987654321" },
  { nome: "10 dígitos (fixo)", entrada: "1133334444", canonico: "1133334444" },
  { nome: "+55 formatado", entrada: "+55 11 98765-4321", canonico: "11987654321" },
  { nome: "placeholder antigo +55 11 9 …", entrada: "+55 11 9 8765-4321", canonico: "11987654321" },
  { nome: "DDI 55 colado + celular (13)", entrada: "5511987654321", canonico: "11987654321" },
  { nome: "DDI 55 colado + fixo (12)", entrada: "551133334444", canonico: "1133334444" },
  { nome: "+55 com fixo formatado", entrada: "+55 (11) 3333-4444", canonico: "1133334444" },
  { nome: "DDD 55 legítimo, celular (11)", entrada: "55987654321", canonico: "55987654321" },
  { nome: "DDD 55 legítimo, fixo (10)", entrada: "(55) 3222-1234", canonico: "5532221234" },
  { nome: "DDI 55 + DDD 55 (13)", entrada: "+55 55 98765-4321", canonico: "55987654321" },
  { nome: "máscara BR completa", entrada: "(11) 98765-4321", canonico: "11987654321" },
  { nome: "espaços nas pontas", entrada: " (11) 98765-4321 ", canonico: "11987654321" },
  { nome: "legado só dígitos (seed)", entrada: "11999990002", canonico: "11999990002" },
  { nome: "zero de tronco + celular (12)", entrada: "(011) 98765-4321", canonico: "11987654321" },
  { nome: "zero de tronco + fixo (11)", entrada: "011 3333-4444", canonico: "1133334444" },
  // inválidos
  { nome: "caractere inválido (letra)", entrada: "11 98765-43a1", canonico: null },
  { nome: "caractere inválido (ponto)", entrada: "11.98765.4321", canonico: null },
  { nome: "curto 9 dígitos sem DDD", entrada: "98765-4321", canonico: null },
  { nome: "curto 8 dígitos", entrada: "3333-4444", canonico: null },
  { nome: "excedente 12 não-55 e não-0", entrada: "119876543210", canonico: null },
  { nome: "20 dígitos", entrada: "12345678901234567890", canonico: null },
  { nome: "tronco + operadora + DDD (14)", entrada: "0 15 11 98765-4321", canonico: null },
  { nome: "tronco + operadora + fixo (13)", entrada: "015 11 3333-4444", canonico: null },
  { nome: "DDD começando com 0 (10)", entrada: "0933334444", canonico: null },
  { nome: "celular de 11 sem 9 após o DDD", entrada: "11387654321", canonico: null },
  { nome: "estrangeiro com + e DDI ≠ 55", entrada: "+1 (415) 555-2671 x", canonico: null },
  { nome: "estrangeiro +44 (12 dígitos)", entrada: "+44 20 7946 0958", canonico: null },
  { nome: "vazio", entrada: "", canonico: null },
  { nome: "só espaços", entrada: "   ", canonico: null },
  { nome: "só pontuação", entrada: "() -", canonico: null },
]

describe("normalizeBrazilianPhone — matriz", () => {
  for (const c of CASOS) {
    it(`${c.nome}: ${JSON.stringify(c.entrada)} → ${c.canonico ?? "null"}`, () => {
      assert.equal(normalizeBrazilianPhone(c.entrada), c.canonico)
      assert.equal(isValidBrazilianPhone(c.entrada), c.canonico !== null)
    })
  }

  it("null/undefined → null", () => {
    assert.equal(normalizeBrazilianPhone(null), null)
    assert.equal(normalizeBrazilianPhone(undefined), null)
  })

  it("forma canônica é sempre 10/11 dígitos, sem +55 e sem pontuação", () => {
    for (const c of CASOS) {
      if (c.canonico === null) continue
      assert.match(c.canonico, /^[1-9]\d{9,10}$/)
    }
  })

  it("normalizar a forma canônica é idempotente", () => {
    for (const c of CASOS) {
      if (c.canonico === null) continue
      assert.equal(normalizeBrazilianPhone(c.canonico), c.canonico)
    }
  })

  it("DDD 55 legítimo nunca perde o DDD", () => {
    assert.equal(normalizeBrazilianPhone("55987654321")?.slice(0, 2), "55")
    assert.equal(normalizeBrazilianPhone("5532221234")?.slice(0, 2), "55")
  })

  it("estrangeiro de 11 dígitos SEM '+' é indistinguível de BR — segue a regra BR (limitação aceita)", () => {
    // "+1 415 555 2671" → 11 dígitos "14155552671": DDD 14, 3º dígito 1 ≠ 9 → recusado.
    assert.equal(normalizeBrazilianPhone("+1 415 555 2671"), null)
  })
})

describe("toWhatsAppUrl", () => {
  it("todo telefone válido gera wa.me/55 + canônico", () => {
    for (const c of CASOS) {
      if (c.canonico === null) continue
      assert.equal(toWhatsAppUrl(c.entrada), `https://wa.me/55${c.canonico}`)
    }
  })

  it("inválido, vazio, null e undefined → null (nunca um link)", () => {
    for (const c of CASOS) {
      if (c.canonico !== null) continue
      assert.equal(toWhatsAppUrl(c.entrada), null, c.nome)
    }
    assert.equal(toWhatsAppUrl(null), null)
    assert.equal(toWhatsAppUrl(undefined), null)
  })

  it("NÃO-REGRESSÃO: todo link que o buildWhatsAppUrl antigo gerava CORRETAMENTE continua idêntico", () => {
    const corretosNoLegado = [
      "11987654321",
      "1133334444",
      "+55 11 98765-4321",
      "+55 11 9 8765-4321",
      "5511987654321",
      "551133334444",
      "55987654321",
      "(55) 3222-1234",
      "(11) 98765-4321",
      " (11) 98765-4321 ",
      "11999990002",
      "+55 55 98765-4321",
    ]
    for (const v of corretosNoLegado) {
      assert.equal(toWhatsAppUrl(v), legacyBuildWhatsAppUrl(v), v)
    }
  })

  it("onde o legado gerava link QUEBRADO, agora não há link", () => {
    for (const v of ["98765-4321", "3333-4444", "119876543210", "12345678901234567890"]) {
      assert.match(legacyBuildWhatsAppUrl(v), /^https:\/\/wa\.me\//, "o legado gerava link")
      assert.equal(toWhatsAppUrl(v), null, v)
    }
  })

  it("zero de tronco: o legado gerava link errado; agora gera o link certo", () => {
    assert.equal(legacyBuildWhatsAppUrl("(011) 98765-4321"), "https://wa.me/011987654321")
    assert.equal(toWhatsAppUrl("(011) 98765-4321"), "https://wa.me/5511987654321")
  })
})

describe("formatBrazilianPhone — máscara", () => {
  it("digitação progressiva de um celular, dígito a dígito", () => {
    const alvo = "11987654321"
    const visto = [...alvo].map((_, i) => formatBrazilianPhone(alvo.slice(0, i + 1)))
    assert.deepEqual(visto, [
      "(1",
      "(11",
      "(11) 9",
      "(11) 98",
      "(11) 987",
      "(11) 9876",
      "(11) 9876-5",
      "(11) 9876-54",
      "(11) 9876-543",
      "(11) 9876-5432",
      "(11) 98765-4321",
    ])
  })

  it("simulação de input controlado: cada tecla reaplica a máscara sobre o valor anterior", () => {
    let campo = ""
    for (const ch of "11987654321") campo = formatBrazilianPhone(campo + ch)
    assert.equal(campo, "(11) 98765-4321")
  })

  it("colar: +55, DDI colado, só dígitos e já mascarado dão o mesmo resultado", () => {
    for (const v of ["+55 11 98765-4321", "5511987654321", "11987654321", "(11) 98765-4321", "+5511987654321"]) {
      assert.equal(formatBrazilianPhone(v), "(11) 98765-4321", v)
    }
  })

  it("autofill típico de iOS/Android (+55 sem espaço) formata direto", () => {
    assert.equal(formatBrazilianPhone("+5511987654321"), "(11) 98765-4321")
  })

  it("colar com zero de tronco mostra o número sem o zero", () => {
    assert.equal(formatBrazilianPhone("(011) 98765-4321"), "(11) 98765-4321")
  })

  it("backspace no fim reformata celular → fixo sem lixo de máscara", () => {
    assert.equal(formatBrazilianPhone("(11) 98765-432"), "(11) 9876-5432")
    assert.equal(formatBrazilianPhone("(11) "), "(11")
    assert.equal(formatBrazilianPhone("(1"), "(1")
  })

  it("apagar no meio recalcula a partir dos dígitos que sobraram", () => {
    // "(11) 98765-4321" com o "7" apagado
    assert.equal(formatBrazilianPhone("(11) 9865-4321"), "(11) 9865-4321")
  })

  it("idempotente: format(format(x)) === format(x)", () => {
    for (const c of CASOS) {
      const uma = formatBrazilianPhone(c.entrada)
      assert.equal(formatBrazilianPhone(uma), uma, c.nome)
    }
  })

  it("excedente fica VISÍVEL: nenhum dígito é descartado nem vira outro número válido", () => {
    const r = formatBrazilianPhone("119876543210")
    assert.equal(extractPhoneDigits(r), "119876543210")
    assert.notEqual(r, formatBrazilianPhone("11987654321"))
    assert.equal(isValidBrazilianPhone(r), false)
    assert.equal(extractPhoneDigits(formatBrazilianPhone("12345678901234567890")).length, 20)
  })

  it("DDD 55 legítimo na máscara", () => {
    assert.equal(formatBrazilianPhone("55987654321"), "(55) 98765-4321")
  })

  it("todo valor válido, depois de mascarado, normaliza para o mesmo canônico", () => {
    for (const c of CASOS) {
      if (c.canonico === null) continue
      assert.equal(normalizeBrazilianPhone(formatBrazilianPhone(c.entrada)), c.canonico, c.nome)
    }
  })
})

describe("valor gravado: edição e exibição", () => {
  it("edição: legado válido abre formatado", () => {
    assert.equal(phoneInputInitialValue("11999990002"), "(11) 99999-0002")
    assert.equal(phoneInputInitialValue("+55 11 9 8765-4321"), "(11) 98765-4321")
  })

  it("edição: legado inválido abre BRUTO e intacto (nunca reinterpretado)", () => {
    for (const v of ["9876-5432", "11 98765-43a1", "119876543210", "ligar à tarde"]) {
      assert.equal(phoneInputInitialValue(v), v)
    }
  })

  it("edição: vazio/null/undefined → string vazia", () => {
    assert.equal(phoneInputInitialValue(null), "")
    assert.equal(phoneInputInitialValue(undefined), "")
    assert.equal(phoneInputInitialValue(""), "")
  })

  it("exibição: válido formatado; inválido/ausente → null (nunca texto inválido como contato)", () => {
    assert.equal(formatStoredBrazilianPhone("1133334444"), "(11) 3333-4444")
    assert.equal(formatStoredBrazilianPhone("9876-5432"), null)
    assert.equal(formatStoredBrazilianPhone(null), null)
  })
})

describe("schemas zod", () => {
  const obrigatorio = brazilianPhoneRequired({ requiredMessage: "OBRIGATORIO", invalidMessage: "INVALIDO" })
  const opcional = brazilianPhoneOptional({ invalidMessage: "INVALIDO" })

  it("obrigatório: válido → canônico", () => {
    for (const c of CASOS) {
      if (c.canonico === null) continue
      const r = obrigatorio.safeParse(c.entrada)
      assert.ok(r.success, c.nome)
      assert.equal(r.data, c.canonico)
    }
  })

  it("obrigatório: vazio → mensagem de obrigatório; inválido → mensagem de inválido", () => {
    for (const v of ["", "   "]) {
      const r = obrigatorio.safeParse(v)
      assert.equal(r.success, false)
      assert.equal(r.error?.issues[0]?.message, "OBRIGATORIO")
    }
    for (const c of CASOS) {
      if (c.canonico !== null || c.entrada.trim() === "") continue
      const r = obrigatorio.safeParse(c.entrada)
      assert.equal(r.success, false, c.nome)
      assert.equal(r.error?.issues[0]?.message, "INVALIDO", c.nome)
    }
    assert.equal(obrigatorio.safeParse(undefined).success, false)
  })

  it("opcional: ausente → undefined; vazio → \"\"; válido → canônico; inválido → erro", () => {
    assert.deepEqual(opcional.safeParse(undefined), { success: true, data: undefined })
    assert.equal(opcional.parse(""), "")
    assert.equal(opcional.parse("   "), "")
    for (const c of CASOS) {
      if (c.entrada.trim() === "") continue
      const r = opcional.safeParse(c.entrada)
      if (c.canonico === null) {
        assert.equal(r.success, false, c.nome)
        assert.equal(r.error?.issues[0]?.message, "INVALIDO", c.nome)
      } else {
        assert.equal(r.data, c.canonico, c.nome)
      }
    }
  })

  it("sem mensagens customizadas usa a mensagem padrão", () => {
    const r = brazilianPhoneRequired().safeParse("123")
    assert.equal(r.success, false)
    assert.match(r.error?.issues[0]?.message ?? "", /DDD/)
  })
})
