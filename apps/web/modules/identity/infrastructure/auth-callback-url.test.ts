/**
 * URL de callback de auth — falha explícita quando a env está ausente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO PROTEGE
 *
 * `buildMagicLinkRedirectUrl` (usada por magic link E Google OAuth) montava
 * `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` sem checar a env. Se a
 * variável faltasse num ambiente novo do Vercel, o resultado era literalmente
 * a STRING `"undefined/auth/callback"` — passada ao Supabase como
 * `redirectTo`/`emailRedirectTo` sem erro nenhum na hora. Login ficaria
 * quebrado em produção sem log, sem 500, só um redirect para lugar nenhum: a
 * classe exata de falha silenciosa que a auditoria BRAND/DOMAIN/LEGAL/PUBLIC
 * SURFACE existe para eliminar.
 *
 * `NEXT_PUBLIC_APP_URL` é `.optional()` em lib/env.ts DE PROPÓSITO (aquele
 * schema faz `parse()` no carregamento do módulo — exigi-la lá derrubaria a
 * aplicação inteira). A responsabilidade de verificar passou para quem
 * CONSOME a variável, e é isso que este teste garante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE TESTE DE FONTE, E NÃO IMPORT DIRETO
 *
 * `auth-actions.ts` começa com `"use server"` — todo export vira endpoint RPC,
 * e só função async pode ser exportada dali (a mesma regra que já pegou uma
 * regressão de build no trust-engine nesta base). `baseAuthCallbackUrl` é
 * síncrona e não pode ser exportada sem quebrar o build; testar seu
 * comportamento exigiria mover a função para outro módulo só para viabilizar
 * o teste — mais invasivo do que a correção em si. Mesmo padrão desta base
 * para arquivos "use server": ler o fonte e verificar o CONTRATO.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const ARQUIVO = join(AQUI, "auth-actions.ts")
const SRC = readFileSync(ARQUIVO, "utf8")

function corpoDe(nome: string): string {
  const linhas = SRC.split("\n")
  const inicio = linhas.findIndex(
    (l) => l.includes(`function ${nome}(`) || l.includes(`export async function ${nome}`)
  )
  assert.notEqual(inicio, -1, `${nome} não encontrada`)
  const corpo: string[] = []
  let chaves = 0
  let comecou = false
  for (let j = inicio; j < linhas.length; j++) {
    corpo.push(linhas[j]!)
    for (const ch of linhas[j]!) {
      if (ch === "{") { chaves++; comecou = true }
      if (ch === "}") chaves--
    }
    if (comecou && chaves === 0) break
  }
  return corpo.join("\n")
}

describe("baseAuthCallbackUrl não constrói URL com env ausente", () => {
  const corpo = corpoDe("baseAuthCallbackUrl")

  it("verifica a presença da env antes de montar a URL", () => {
    assert.match(corpo, /if\s*\(\s*!base\s*\)/)
  })

  it("lança em vez de interpolar 'undefined' na URL", () => {
    // A regressão exata: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    // sem checagem produzia a string literal "undefined/auth/callback".
    assert.match(corpo, /throw new Error/)
  })

  it("a mensagem de erro aponta onde resolver, sem vazar detalhe de infra", () => {
    assert.match(corpo, /NEXT_PUBLIC_APP_URL/)
    assert.match(corpo, /BRAND_DOMAIN_PUBLIC_SURFACE/)
  })
})

describe("signInWithMagicLink não deixa o throw escapar", () => {
  const corpo = corpoDe("signInWithMagicLink")

  it("captura a falha de configuração antes de chamar o Supabase", () => {
    // Um throw não-tratado numa Server Action vira 500 genérico sem
    // orientação — o próprio arquivo documenta isso para os erros do
    // Supabase; a mesma regra vale para a config ausente.
    assert.match(corpo, /try\s*\{[\s\S]*buildMagicLinkRedirectUrl/)
    assert.match(corpo, /catch\s*\(err\)/)
  })

  it("devolve o resultado tipado, não deixa a exceção subir", () => {
    assert.match(corpo, /return\s*\{\s*success:\s*false,\s*error:\s*AUTH_MISCONFIGURED_MESSAGE\s*\}/)
  })

  it("loga o motivo real no servidor — diagnosticável sem expor ao usuário", () => {
    assert.match(corpo, /console\.error\(\s*\n?\s*"\[auth\] signInWithMagicLink: configuração ausente/)
  })
})

describe("a mensagem ao usuário não expõe causa técnica", () => {
  it("AUTH_MISCONFIGURED_MESSAGE não cita env, URL ou infra", () => {
    const msg = SRC.match(/AUTH_MISCONFIGURED_MESSAGE\s*=\s*\n?\s*"([^"]+)"/)?.[1]
    assert.ok(msg, "constante não encontrada")
    for (const proibido of ["NEXT_PUBLIC", "env", "URL", "Vercel", "undefined"]) {
      assert.ok(!msg.includes(proibido), `mensagem expõe "${proibido}"`)
    }
  })
})

describe("signInWithGoogle mantém seu próprio contrato de throw", () => {
  it("não precisou de try/catch novo — já lança para erro do Supabase", () => {
    // signInWithGoogle já usa `throw new Error(error.message)` para falhas do
    // Supabase — deixar o throw de baseAuthCallbackUrl propagar ali é
    // consistente com o contrato que a função já tinha, não uma exceção à
    // regra aplicada em signInWithMagicLink.
    const corpo = corpoDe("signInWithGoogle")
    assert.match(corpo, /throw new Error\(error\.message\)/)
  })
})

describe("GATE-7-GOOGLE-ACCOUNT-CHOOSER-001 — signInWithGoogle pede o seletor de conta", () => {
  const corpo = corpoDe("signInWithGoogle")

  it("provider continua google — nenhum provider novo introduzido", () => {
    assert.match(corpo, /provider:\s*"google"/)
  })

  it("pede prompt=select_account via queryParams (contrato do SDK, não a implementação interna)", () => {
    // `queryParams` é o campo documentado de `SignInWithOAuthCredentials`
    // (@supabase/auth-js) repassado à URL de autorização do provider — o
    // teste trava no NOME DO CAMPO do SDK e no valor exigido pelo Google,
    // não em como o Supabase internamente monta a URL.
    assert.match(corpo, /queryParams:\s*\{\s*\n?\s*prompt:\s*"select_account"/)
  })

  it("redirectTo continua exatamente o mesmo — next não foi tocado", () => {
    // A mudança é ADITIVA: só `queryParams` foi introduzido. Se este teste
    // falhar, alguém alterou como `next`/redirectTo é montado neste gate,
    // que era estritamente fora de escopo.
    assert.match(corpo, /redirectTo:\s*buildMagicLinkRedirectUrl\(next\)/)
  })

  it("select_account está dentro da mesma chamada a signInWithOAuth, não numa chamada nova", () => {
    // Garante que queryParams e redirectTo pertencem às MESMAS `options` —
    // não duas invocações do método (o que quebraria o fluxo: só o
    // resultado da invocação usada em `data.url` importa).
    const invocacoes = corpo.match(/\.signInWithOAuth\(/g) ?? []
    assert.equal(invocacoes.length, 1, "esperada exatamente uma invocação de .signInWithOAuth(")
  })
})
