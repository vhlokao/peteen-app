/**
 * Superfície de Server Actions — regressão do P1 de autorização.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO PROTEGE
 *
 * Em Next.js, TODO export de um arquivo que começa com `"use server"` vira um
 * endpoint RPC invocável por qualquer cliente. Não há autenticação implícita:
 * se a função não checar sessão, ela é pública.
 *
 * Três funções nessas condições recebiam o ALVO como parâmetro e não checavam
 * nada:
 *
 *   requestVerificationAction({ entityType, entityId })  → criava
 *     VerificationRequest para qualquer entidade e empurrava PARTNER para
 *     PENDING_VERIFICATION — IDOR com mutação de estado alheio.
 *
 *   requestProfessionalVerificationAction(professionalId) → mesma forma.
 *
 *   createSystemFlagAction(input) → gravava flag com `source: "SYSTEM"`,
 *     forjando procedência de sistema, e engolia erros (abuso sem sinal).
 *
 * A correção não foi adicionar um guard: foi TIRAR as duas primeiras da
 * superfície pública (viraram funções internas num módulo `server-only`) e
 * remover a terceira, que não tinha nenhum chamador.
 *
 * Estes testes leem o FONTE porque a propriedade a garantir é sobre a
 * superfície exportada — não sobre o comportamento de uma função. Um teste
 * unitário chamando a função não distinguiria "interna" de "endpoint aberto":
 * é exatamente a diferença que importa aqui.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function ler(relativo: string): string {
  return readFileSync(path.join(RAIZ_APP, relativo), "utf8")
}

/**
 * Sem comentários. Os cabeçalhos destes arquivos CITAM `"use server"` e os
 * nomes das funções removidas ao explicar o incidente — asserir sobre o texto
 * cru acusaria a própria documentação como se fosse código.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const ACTIONS_VERIFICATION = semComentarios(ler("modules/verification/application/actions.ts"))
const ACTIONS_MODERATION = semComentarios(ler("modules/moderation/application/actions.ts"))
const INTERNO = semComentarios(ler("modules/verification/application/request-verification.ts"))
/** Com comentários — para asserir que o CONTRATO está documentado. */
const INTERNO_BRUTO = ler("modules/verification/application/request-verification.ts")

// ─────────────────────────────────────────────────────────────────────────────
// As três superfícies que foram fechadas
// ─────────────────────────────────────────────────────────────────────────────

describe("superfície fechada — as ações sem autorização deixaram de existir", () => {
  it("createSystemFlagAction não existe mais em lugar nenhum", () => {
    // Removida por completo: escrita não autenticada forjando source SYSTEM,
    // sem nenhum chamador em todo o repositório.
    assert.doesNotMatch(ACTIONS_MODERATION, /createSystemFlagAction/)
  })

  it("requestVerificationAction não é mais exportada do arquivo 'use server'", () => {
    assert.doesNotMatch(ACTIONS_VERIFICATION, /export async function requestVerificationAction/)
  })

  it("requestProfessionalVerificationAction não é mais exportada do arquivo 'use server'", () => {
    assert.doesNotMatch(
      ACTIONS_VERIFICATION,
      /export async function requestProfessionalVerificationAction/
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O módulo interno não pode virar Server Action de novo
// ─────────────────────────────────────────────────────────────────────────────

describe("request-verification.ts — interno, nunca endpoint", () => {
  it("NÃO declara 'use server' — é o que o mantém fora da superfície RPC", () => {
    // Se alguém adicionar a diretiva, as duas funções voltam a ser endpoints
    // públicos recebendo entityId arbitrário. É a regressão exata do P1.
    assert.doesNotMatch(INTERNO, /["']use server["']/)
  })

  it("declara 'server-only' — quebra o build se for importado do cliente", () => {
    assert.match(INTERNO_BRUTO, /import "server-only"/)
  })

  it("documenta que confia no id recebido e exige o chamador derivá-lo", () => {
    // O contrato é a única proteção que resta: sem ele, o próximo chamador
    // repassa um id do cliente e reabre o buraco sem perceber.
    assert.match(INTERNO_BRUTO, /CONTRATO/)
    assert.match(INTERNO_BRUTO, /não autenticam|não autentica/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// O entrypoint autenticado continua sendo o único caminho público
// ─────────────────────────────────────────────────────────────────────────────

describe("requestMyProfessionalVerificationAction — entrypoint autenticado", () => {
  it("continua existindo como Server Action", () => {
    assert.match(
      ACTIONS_VERIFICATION,
      /export async function requestMyProfessionalVerificationAction/
    )
  })

  it("exige a persona PROFISSIONAL", () => {
    assert.match(ACTIONS_VERIFICATION, /requireRole\("PROFESSIONAL"\)/)
  })

  it("deriva o profissional da SESSÃO, nunca de parâmetro", () => {
    // `userId: user.id` é o que torna impossível pedir verificação para o
    // perfil de outra pessoa: não há parâmetro onde informar um alvo.
    assert.match(ACTIONS_VERIFICATION, /where: \{ userId: user\.id, deletedAt: null \}/)
    assert.match(
      ACTIONS_VERIFICATION,
      /export async function requestMyProfessionalVerificationAction\(\): Promise</,
      "não pode receber parâmetro algum"
    )
  })

  it("delega para a função interna, e não para um endpoint", () => {
    assert.match(ACTIONS_VERIFICATION, /requestProfessionalVerification\(pro\.id\)/)
    assert.match(ACTIONS_VERIFICATION, /from "\.\/request-verification"/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Idempotência — preservada, não introduzida
// ─────────────────────────────────────────────────────────────────────────────

describe("idempotência da solicitação", () => {
  it("uma solicitação pendente existente é reutilizada, não duplicada", () => {
    // Clique repetido não enche a fila do admin com pedidos iguais.
    assert.match(INTERNO, /findPendingVerificationRequest\("PROFESSIONAL", professionalId\)/)
    assert.match(INTERNO, /if \(existing\)/)
    assert.match(INTERNO, /requestId: existing\.id/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Varredura viva — nenhuma action NOVA sem guard nestes dois módulos
// ─────────────────────────────────────────────────────────────────────────────

const GUARDS = /assertAdminId|assertAdmin|requireAdmin|requireRole|requireAuth|getAuthContext/

/** Exports de um arquivo `"use server"`, com o corpo de cada um. */
function acoesDe(relativo: string): Array<{ nome: string; corpo: string }> {
  const src = ler(relativo)
  if (!src.startsWith('"use server"')) return []
  const linhas = src.split("\n")
  const out: Array<{ nome: string; corpo: string }> = []
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i]!.match(/^export async function (\w+)/)
    if (!m) continue
    // Corpo = da declaração até a linha que fecha na coluna 0. Mais simples e
    // mais confiável que contar chaves: um `{` dentro do TIPO de retorno
    // (ActionResult<{ ... }>) faria um contador ingênuo terminar cedo demais.
    const corpo: string[] = []
    for (let j = i; j < linhas.length; j++) {
      corpo.push(linhas[j]!)
      // `.trimEnd()` obrigatório: o repositório usa CRLF, então a linha de
      // fechamento é `"}\r"`. Sem isto o corpo de uma action absorve as
      // seguintes, e a varredura acusa guard que pertence a outra função.
      if (j > i && linhas[j]!.trimEnd() === "}") break
    }
    out.push({ nome: m[1]!, corpo: corpo.join("\n") })
  }
  return out
}

describe("varredura — toda Server Action destes módulos verifica quem chama", () => {
  for (const arquivo of [
    "modules/verification/application/actions.ts",
    "modules/moderation/application/actions.ts",
  ]) {
    it(`${arquivo.split("/")[1]}: nenhuma action sem checagem de sessão`, () => {
      const semGuard = acoesDe(arquivo)
        .filter((a) => !GUARDS.test(a.corpo))
        .map((a) => a.nome)
      assert.deepEqual(
        semGuard,
        [],
        `actions sem guard: ${semGuard.join(", ")} — em arquivo "use server" isso é endpoint público`
      )
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Dívida conhecida — o funil público de Partner
// ─────────────────────────────────────────────────────────────────────────────

describe("partners/onboarding — dívida FECHADA", () => {
  it("nenhuma action pública recebe mais partnerId do cliente", () => {
    // A versão anterior deste teste registrava a dívida em aberto e falhava
    // quando ela fosse fechada — o que é exatamente o que aconteceu. Agora
    // fixa o estado oposto: o parceiro vem da capability assinada, e voltar a
    // aceitar um id por parâmetro reprova aqui.
    //
    // A cobertura profunda (assinatura, A→B, adulteração, expiração) vive em
    // modules/partners/domain/onboarding-capability.test.ts.
    const src = ler("modules/partners/application/onboarding-actions.ts")
    assert.doesNotMatch(src, /completePartnerOnboardingAction\(\s*\n?\s*partnerId: string/)
    assert.match(src, /lerSessaoOnboarding\(\)/)
  })

  it("o onboarding usa a função INTERNA de verificação, não um endpoint", () => {
    // O que esta rodada de fato fechou nesse caminho: mesmo com o partnerId
    // ainda vindo do cliente, `requestVerification` deixou de ser invocável
    // diretamente por um atacante.
    const src = ler("modules/partners/application/onboarding-actions.ts")
    assert.match(src, /from "@\/modules\/verification\/application\/request-verification"/)
    assert.doesNotMatch(src, /requestVerificationAction/)
  })
})
