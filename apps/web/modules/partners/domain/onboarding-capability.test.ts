/**
 * Capability de onboarding de parceiro — assinatura, expiração e A→B.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTES TESTES PROVAM
 *
 * O onboarding de parceiro é público por desenho, então não há sessão de onde
 * derivar posse. Antes, as Server Actions aceitavam `partnerId` como parâmetro
 * — qualquer chamador informava o id de OUTRO parceiro e lia métricas
 * operacionais, alterava o negócio ou concluía o cadastro alheio.
 *
 * A troca é: em vez de "quem diz um id", "quem carrega uma prova emitida pelo
 * servidor". Estes testes atacam essa prova de todos os ângulos que um
 * atacante tem — trocar o partnerId, trocar a assinatura, forjar o payload,
 * reaproveitar um token expirado, reaproveitar um token de outro propósito.
 *
 * Tudo aqui é puro: chaves fixas, relógio injetado, nenhum cookie e nenhum
 * ambiente. É por isso que a matemática mora em `domain/` e não junto do
 * `next/headers`.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  CAPABILITY_PURPOSE,
  CAPABILITY_TTL_SECONDS,
  CAPABILITY_VERSION,
  MIN_SECRET_BYTES,
  emitirCapability,
  segredoUtilizavel,
  verificarCapability,
} from "./onboarding-capability.ts"

/** Chaves de teste — nada aqui existe em ambiente nenhum. */
const SEGREDO_A = "a".repeat(48)
const SEGREDO_B = "b".repeat(48)

const AGORA = new Date("2026-08-25T12:00:00.000Z").getTime()
const PARTNER_A = "partner_aaaaaaaaaaaaaaaaaaaa"
const PARTNER_B = "partner_bbbbbbbbbbbbbbbbbbbb"

function emitir(partnerId: string, over: { secret?: string; agoraMs?: number; ttlSegundos?: number } = {}) {
  return emitirCapability({
    partnerId,
    secret: over.secret ?? SEGREDO_A,
    agoraMs: over.agoraMs ?? AGORA,
    ttlSegundos: over.ttlSegundos,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Emissão legítima
// ─────────────────────────────────────────────────────────────────────────────

describe("emissão legítima", () => {
  it("emite e verifica, devolvendo o partner correto", () => {
    const token = emitir(PARTNER_A)
    const r = verificarCapability(token, SEGREDO_A, AGORA)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.capability.partnerId, PARTNER_A)
  })

  it("carrega versão e propósito declarados", () => {
    const r = verificarCapability(emitir(PARTNER_A), SEGREDO_A, AGORA)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.capability.v, CAPABILITY_VERSION)
      assert.equal(r.capability.purpose, CAPABILITY_PURPOSE)
    }
  })

  it("expira 24h depois da emissão", () => {
    const r = verificarCapability(emitir(PARTNER_A), SEGREDO_A, AGORA)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.capability.exp - r.capability.iat, CAPABILITY_TTL_SECONDS)
      assert.equal(CAPABILITY_TTL_SECONDS, 24 * 60 * 60)
    }
  })

  it("dois parceiros recebem tokens diferentes", () => {
    assert.notEqual(emitir(PARTNER_A), emitir(PARTNER_B))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A→B — o ataque que motivou tudo isto
// ─────────────────────────────────────────────────────────────────────────────

describe("A→B — capability de A nunca opera sobre B", () => {
  it("a capability de A resolve SEMPRE para A, não importa o que o cliente envie", () => {
    // Este é o ponto: o partnerId deixou de ser um argumento e passou a ser um
    // resultado. Não existe entrada onde informar "quero operar sobre B".
    const r = verificarCapability(emitir(PARTNER_A), SEGREDO_A, AGORA)
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.capability.partnerId, PARTNER_A)
      assert.notEqual(r.capability.partnerId, PARTNER_B)
    }
  })

  it("trocar o partnerId dentro do payload invalida a assinatura", () => {
    // Ataque direto: decodifica, troca A por B, recodifica, mantém a assinatura.
    const token = emitir(PARTNER_A)
    const [payloadB64, assinatura] = token.split(".") as [string, string]
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
    payload.partnerId = PARTNER_B
    const forjado = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")

    const r = verificarCapability(`${forjado}.${assinatura}`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "assinatura_invalida")
  })

  it("assinar com outro segredo não vale — não basta forjar o formato", () => {
    const tokenDeOutraChave = emitir(PARTNER_B, { secret: SEGREDO_B })
    const r = verificarCapability(tokenDeOutraChave, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "assinatura_invalida")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Adulteração
// ─────────────────────────────────────────────────────────────────────────────

describe("adulteração", () => {
  it("assinatura alterada é recusada", () => {
    const token = emitir(PARTNER_A)
    const [payloadB64, assinatura] = token.split(".") as [string, string]
    // Troca o último caractere por outro, preservando o comprimento.
    const ultimo = assinatura.slice(-1)
    const alterada = assinatura.slice(0, -1) + (ultimo === "A" ? "B" : "A")

    const r = verificarCapability(`${payloadB64}.${alterada}`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "assinatura_invalida")
  })

  it("assinatura de tamanho diferente não quebra a verificação", () => {
    // `timingSafeEqual` LANÇA com buffers de tamanhos diferentes. Sem a guarda
    // de comprimento, um token curto derrubaria a action em vez de ser negado.
    const [payloadB64] = emitir(PARTNER_A).split(".") as [string]
    for (const assinatura of ["", "x", "curta", "z".repeat(500)]) {
      const r = verificarCapability(`${payloadB64}.${assinatura}`, SEGREDO_A, AGORA)
      assert.equal(r.ok, false, `deveria recusar assinatura de ${assinatura.length} chars`)
    }
  })

  it("payload que não é JSON válido é recusado", () => {
    const lixo = Buffer.from("nao é json", "utf8").toString("base64url")
    const r = verificarCapability(`${lixo}.qualquercoisa`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
  })

  it("formato fora de payload.assinatura é recusado", () => {
    for (const t of ["", "semponto", "a.b.c", ".", "a.", ".b"]) {
      const r = verificarCapability(t, SEGREDO_A, AGORA)
      assert.equal(r.ok, false, `deveria recusar: ${JSON.stringify(t)}`)
    }
  })

  it("payload sem os campos obrigatórios é recusado mesmo com assinatura boa", () => {
    // Assina um payload legítimo do ponto de vista criptográfico, mas
    // incompleto — prova que a validação estrutural acontece DEPOIS da
    // assinatura, e não é dispensada por ela.
    const incompleto = Buffer.from(JSON.stringify({ v: 1, purpose: CAPABILITY_PURPOSE }), "utf8")
      .toString("base64url")
    const assinatura = createHmac("sha256", SEGREDO_A).update(incompleto).digest().toString("base64url")

    const r = verificarCapability(`${incompleto}.${assinatura}`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "formato_invalido")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ausência, expiração, propósito e versão
// ─────────────────────────────────────────────────────────────────────────────

describe("cookie ausente ou fora de validade", () => {
  it("token ausente é recusado, sem lançar", () => {
    for (const t of [undefined, null, ""]) {
      const r = verificarCapability(t, SEGREDO_A, AGORA)
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.motivo, "ausente")
    }
  })

  it("expirada é recusada", () => {
    const token = emitir(PARTNER_A)
    const depois = AGORA + (CAPABILITY_TTL_SECONDS + 1) * 1000
    const r = verificarCapability(token, SEGREDO_A, depois)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "expirada")
  })

  it("vale até o último segundo, e não vale no instante da expiração", () => {
    const token = emitir(PARTNER_A)
    const umSegundoAntes = AGORA + (CAPABILITY_TTL_SECONDS - 1) * 1000
    const noExato = AGORA + CAPABILITY_TTL_SECONDS * 1000
    assert.equal(verificarCapability(token, SEGREDO_A, umSegundoAntes).ok, true)
    assert.equal(verificarCapability(token, SEGREDO_A, noExato).ok, false)
  })

  it("propósito diferente é recusado — o segredo não vira chave-mestra", () => {
    // Um token assinado com o MESMO segredo para outra finalidade futura não
    // pode virar capability de onboarding só por estar assinado.
    const outroPropósito = Buffer.from(
      JSON.stringify({
        v: CAPABILITY_VERSION,
        partnerId: PARTNER_B,
        iat: Math.floor(AGORA / 1000),
        exp: Math.floor(AGORA / 1000) + 3600,
        purpose: "outra_coisa",
      }),
      "utf8"
    ).toString("base64url")
    const assinatura = createHmac("sha256", SEGREDO_A)
      .update(outroPropósito)
      .digest()
      .toString("base64url")

    const r = verificarCapability(`${outroPropósito}.${assinatura}`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "proposito_incorreto")
  })

  it("versão incompatível é recusada", () => {
    const v99 = Buffer.from(
      JSON.stringify({
        v: 99,
        partnerId: PARTNER_A,
        iat: Math.floor(AGORA / 1000),
        exp: Math.floor(AGORA / 1000) + 3600,
        purpose: CAPABILITY_PURPOSE,
      }),
      "utf8"
    ).toString("base64url")
    const assinatura = createHmac("sha256", SEGREDO_A).update(v99).digest().toString("base64url")

    const r = verificarCapability(`${v99}.${assinatura}`, SEGREDO_A, AGORA)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, "versao_incompativel")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Segredo
// ─────────────────────────────────────────────────────────────────────────────

describe("segredo", () => {
  it("exige ao menos 32 bytes", () => {
    assert.equal(MIN_SECRET_BYTES, 32)
    assert.equal(segredoUtilizavel("a".repeat(32)), true)
    assert.equal(segredoUtilizavel("a".repeat(31)), false)
  })

  it("recusa ausente, vazio e não-string", () => {
    assert.equal(segredoUtilizavel(undefined), false)
    assert.equal(segredoUtilizavel(null), false)
    assert.equal(segredoUtilizavel(""), false)
    assert.equal(segredoUtilizavel(123 as unknown as string), false)
  })

  it("conta BYTES, não caracteres — acentuação não infla a entropia", () => {
    // 31 caracteres acentuados passam de 32 bytes em UTF-8. A checagem é em
    // bytes justamente para medir material de chave, não comprimento visual.
    assert.equal(segredoUtilizavel("é".repeat(16)), true, "16 chars = 32 bytes")
    assert.equal(segredoUtilizavel("é".repeat(15)), false, "15 chars = 30 bytes")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Derivação de ownership nas 6 actions — verificação estrutural
//
// A matemática acima prova que a capability é inforjável. Isto prova que as
// actions REALMENTE a usam: uma capability perfeita não protege nada se a
// action continuar lendo o partnerId do input.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "application", "onboarding-actions.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")

/** Corpo de uma action, da declaração até o `}` na coluna 0. */
function corpoDaAction(nome: string): string {
  const linhas = ACTIONS.split("\n")
  const i = linhas.findIndex((l) => l.startsWith(`export async function ${nome}`))
  assert.notEqual(i, -1, `action não encontrada: ${nome}`)
  const out: string[] = []
  for (let j = i; j < linhas.length; j++) {
    out.push(linhas[j]!)
    // `.trimEnd()` NÃO é cosmético: o repositório usa CRLF, então a linha de
    // fechamento é `"}\r"` e a comparação com `"}"` nunca casava. O extrator
    // seguia engolindo as funções seguintes, e uma asserção sobre o "corpo"
    // desta action passava por causa de código da vizinha. Descoberto quando
    // um controle negativo se recusou a falhar.
    if (j > i && linhas[j]!.trimEnd() === "}") break
  }
  return out.join("\n")
}

const PROTEGIDAS = [
  "updatePartnerOnboardingBusinessAction",
  "savePartnerOnboardingTrustAction",
  "savePartnerOnboardingRecommendationsAction",
  "completePartnerOnboardingAction",
  "getPartnerOperationalMetricsAction",
  "getPartnerOnboardingResumeAction",
]

describe("as 6 actions derivam o parceiro da capability", () => {
  for (const nome of PROTEGIDAS) {
    it(`${nome} lê a sessão antes de tocar em qualquer dado`, () => {
      assert.match(corpoDaAction(nome), /lerSessaoOnboarding\(\)/)
    })
  }

  for (const nome of PROTEGIDAS) {
    it(`${nome} USA sessao.partnerId como alvo, não só lê a sessão`, () => {
      // Distinção que custou um controle negativo para aparecer: a primeira
      // versão deste teste só exigia que `lerSessaoOnboarding()` fosse
      // chamada. Trocar `sessao.partnerId` por um id qualquer na linha
      // seguinte mantinha a chamada no lugar e passava — lendo a sessão e
      // ignorando o resultado. Ler não protege nada; usar é o que protege.
      assert.match(
        corpoDaAction(nome),
        /sessao\.partnerId/,
        "o parceiro derivado precisa ser o alvo real da operação"
      )
    })
  }

  for (const nome of PROTEGIDAS) {
    it(`${nome} não aceita partnerId como PARÂMETRO`, () => {
      const corpo = corpoDaAction(nome)
      // Só a assinatura: `partnerId` no TIPO DE RETORNO é legítimo.
      const assinatura = corpo.slice(0, corpo.indexOf("{", corpo.indexOf(")")))
      assert.doesNotMatch(
        assinatura,
        /partnerId\s*:\s*string/,
        "partnerId no parâmetro devolve ao cliente a escolha do alvo"
      )
    })
  }

  it("savePartnerOnboardingTrustAction sobrescreve o partnerId do input", () => {
    // Este é o único caso em que o id ainda CHEGA (o formulário o envia dentro
    // de PartnerOnboardingTrustInput). O que importa é que ele é descartado.
    assert.match(corpoDaAction("savePartnerOnboardingTrustAction"), /partnerId: sessao\.partnerId/)
  })

  it("a emissão acontece só na criação, nunca a pedido do cliente", () => {
    // Um endpoint "emita capability para o id X" seria equivalente a não ter
    // capability nenhuma.
    const emissoes = (ACTIONS.match(/emitirSessaoOnboarding\(/g) ?? []).length
    assert.equal(emissoes, 1, "a capability deve nascer em um único ponto")
    assert.match(corpoDaAction("savePartnerOnboardingBusinessAction"), /emitirSessaoOnboarding\(partner\.id\)/)
  })

  it("nenhuma action devolve dado quando a sessão é inválida", () => {
    for (const nome of PROTEGIDAS) {
      const corpo = corpoDaAction(nome)
      assert.match(
        corpo,
        /if \(!sessao\.ok\) return/,
        `${nome} precisa parar antes de ler ou escrever`
      )
    }
  })
})

describe("cookie e segredo", () => {
  const SESSAO = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "application", "onboarding-session.ts"),
    "utf8"
  )

  it("é HttpOnly, SameSite=Lax e Secure em produção", () => {
    assert.match(SESSAO, /httpOnly: true/)
    assert.match(SESSAO, /sameSite: "lax"/)
    assert.match(SESSAO, /secure: process\.env\.NODE_ENV === "production"/)
  })

  it("o Max-Age acompanha a expiração assinada — não vencem em momentos diferentes", () => {
    assert.match(SESSAO, /maxAge: CAPABILITY_TTL_SECONDS/)
  })

  it("usa segredo DEDICADO, nunca uma credencial existente", () => {
    assert.match(SESSAO, /ONBOARDING_SIGNING_SECRET/)
    for (const credencial of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "VAPID_PRIVATE_KEY",
      "CRON_SECRET",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      assert.doesNotMatch(
        SESSAO.replace(/\/\*[\s\S]*?\*\//g, ""),
        new RegExp(`process\.env\.${credencial}`),
        `${credencial} não pode virar chave de assinatura`
      )
    }
  })

  it("nunca loga o VALOR do segredo nem do token", () => {
    // A distinção importa: dizer "ONBOARDING_SIGNING_SECRET ausente" é
    // diagnóstico legítimo e não revela nada. O que não pode vazar é a
    // VARIÁVEL — por referência direta ou interpolada. Proibir a palavra
    // "secret" no texto acusaria a própria mensagem de erro, que é útil.
    const logs = SESSAO.match(/console\.\w+\([\s\S]*?\)/g) ?? []
    for (const l of logs) {
      assert.doesNotMatch(l, /\$\{\s*(secret|token)\s*\}/, `log interpola material: ${l}`)
      assert.doesNotMatch(l, /[(,]\s*(secret|token)\s*[,)]/, `log passa material: ${l}`)
      assert.doesNotMatch(l, /process\.env\.ONBOARDING_SIGNING_SECRET/, `log lê o segredo: ${l}`)
    }
  })

  it("uma só mensagem para todos os motivos — não vira oráculo do formato", () => {
    assert.match(SESSAO, /ONBOARDING_SESSAO_INVALIDA/)
  })
})
