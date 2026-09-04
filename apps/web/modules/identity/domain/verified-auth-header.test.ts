/**
 * Header de identidade já validada — invariantes de segurança
 * (GATE-3-AUTH-LATENCY-005).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO PRECISA TRAVAR, E POR QUE UM TESTE FUNCIONAL NÃO É VIÁVEL AQUI
 *
 * O cenário de ataque é: um cliente manda
 * `x-peteen-verified-auth-id: <id-de-outra-conta>` numa requisição real,
 * tentando fazer a aplicação confiar numa identidade que nunca foi validada.
 * A defesa inteira depende de UMA ordem de operações dentro do middleware:
 * apagar qualquer valor inbound ANTES de decidir se escreve um novo, e só
 * escrever com o resultado de `getUser()` — nunca copiando o que chegou.
 *
 * Não há como instanciar `NextRequest`/rodar `middleware()` de verdade neste
 * projeto: `next/server` não resolve fora do bundler do Next em
 * `node --test` puro (confirmado ao tentar), e não existe jsdom nem mock de
 * Edge Runtime aqui — nenhum teste do repositório inteiro faz isso, para
 * nenhum arquivo. Por isso a asserção é sobre o CÓDIGO-FONTE, mesmo padrão
 * já usado em legal-documents.test.ts e push-health.test.ts: não prova o
 * comportamento em runtime, prova que a ESTRUTURA que garante o
 * comportamento correto continua no lugar.
 *
 * Rodar: node --experimental-strip-types --test modules/identity/domain/verified-auth-header.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { VERIFIED_AUTH_ID_HEADER } from "./verified-auth-header.ts"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

const MIDDLEWARE = "middleware.ts"
const GET_SESSION = "modules/identity/application/get-session.ts"

describe("nome do header — fonte única", () => {
  it("é a string esperada, estável", () => {
    assert.equal(VERIFIED_AUTH_ID_HEADER, "x-peteen-verified-auth-id")
  })

  it("middleware.ts importa a constante em vez de repetir o literal", () => {
    const fonte = ler(MIDDLEWARE)
    assert.match(fonte, /import \{ VERIFIED_AUTH_ID_HEADER \} from "@\/modules\/identity\/domain\/verified-auth-header"/)
    // Nenhuma outra ocorrência da string crua fora do import — se alguém
    // digitasse o literal de novo em vez de importar, as duas pontas
    // poderiam divergir num rename futuro sem o compilador acusar nada.
    const semImport = fonte.replace(
      'import { VERIFIED_AUTH_ID_HEADER } from "@/modules/identity/domain/verified-auth-header";',
      ""
    )
    assert.ok(!semImport.includes("x-peteen-verified-auth-id"), "literal cru reapareceu fora do import")
  })

  it("get-session.ts importa a MESMA constante, não um literal próprio", () => {
    const fonte = ler(GET_SESSION)
    assert.match(fonte, /import \{ VERIFIED_AUTH_ID_HEADER \} from "\.\.\/domain\/verified-auth-header"/)
    assert.ok(!fonte.includes("x-peteen-verified-auth-id"), "literal cru apareceu em get-session.ts")
  })
})

describe("middleware.ts — a defesa contra spoof, em ordem", () => {
  const fonte = ler(MIDDLEWARE)

  it("o header inbound é apagado incondicionalmente", () => {
    assert.match(
      fonte,
      /requestHeaders\.delete\(VERIFIED_AUTH_ID_HEADER\)/,
      "o delete() incondicional sumiu — um valor forjado pelo cliente poderia sobreviver"
    )
  })

  it("o delete() acontece ANTES de qualquer getUser() e ANTES do set() condicional", () => {
    const idxDelete = fonte.indexOf("requestHeaders.delete(VERIFIED_AUTH_ID_HEADER)")
    const idxGetUser = fonte.indexOf("await supabase.auth.getUser()")
    const idxSet = fonte.indexOf("requestHeaders.set(VERIFIED_AUTH_ID_HEADER")

    assert.ok(idxDelete > 0, "delete() não encontrado")
    assert.ok(idxGetUser > 0, "getUser() não encontrado")
    assert.ok(idxSet > 0, "set() não encontrado")

    assert.ok(idxDelete < idxGetUser, "delete() acontece DEPOIS de getUser() — janela de spoof")
    assert.ok(idxGetUser < idxSet, "set() acontece ANTES de getUser() resolver — não pode saber o authId real ainda")
  })

  it("o set() só acontece dentro de um if (user) — nunca incondicional", () => {
    const idxSet = fonte.indexOf("requestHeaders.set(VERIFIED_AUTH_ID_HEADER")
    const antes = fonte.slice(Math.max(0, idxSet - 120), idxSet)
    assert.match(antes, /if\s*\(user\)\s*\{/, "set() não está guardado por if (user)")
  })

  it("o valor setado vem de user.id (resultado de getUser()), nunca de um valor lido do próprio header", () => {
    const idxSet = fonte.indexOf("requestHeaders.set(VERIFIED_AUTH_ID_HEADER")
    const linha = fonte.slice(idxSet, idxSet + 80)
    assert.match(linha, /user\.id/)
  })

  it("CONTROLE NEGATIVO: nenhum set() deste header lê de requestHeaders.get(...) ou request.headers", () => {
    // Um bug clássico seria "revalidar" copiando o valor de entrada de volta
    // para a saída em vez de usar o resultado fresco de getUser().
    const chamadasDeSet = [...fonte.matchAll(/requestHeaders\.set\(VERIFIED_AUTH_ID_HEADER[^)]*\)/g)]
    assert.ok(chamadasDeSet.length > 0, "nenhuma chamada de set() encontrada")
    for (const m of chamadasDeSet) {
      assert.ok(!m[0].includes(".get("), `set() suspeito copiando valor de entrada: ${m[0]}`)
    }
  })
})

describe("get-session.ts — nunca confia no header sem consultar o Prisma", () => {
  const fonte = ler(GET_SESSION)

  it("o valor do header só é usado como filtro de uma query real (where: { authId })", () => {
    const idxHeader = fonte.indexOf("verifiedAuthId")
    assert.ok(idxHeader > 0, "verifiedAuthId não encontrado")
    const corpo = fonte.slice(idxHeader, idxHeader + 400)
    assert.match(corpo, /prisma\.user\.findUnique\(/, "header presente não dispara consulta ao Prisma")
    assert.match(corpo, /where:\s*\{\s*authId:\s*verifiedAuthId\s*\}/)
  })

  it("CONTROLE NEGATIVO: verifiedAuthId só aparece na declaração, no if de guarda e no where: da query", () => {
    // Se alguém um dia escrever `{ authenticated: true, user: { id: verifiedAuthId, ... } }`
    // direto, sem passar pelo Prisma, essa nova ocorrência apareceria aqui e
    // o teste travaria. Hoje só existem as três ocorrências esperadas
    // (declaração, `if (verifiedAuthId)`, `where: { authId: verifiedAuthId }`).
    const ocorrencias = fonte.split("verifiedAuthId").length - 1
    assert.equal(ocorrencias, 3, `esperava 3 ocorrências, achou ${ocorrencias}`)
  })

  it("existe fallback completo para getUser() quando o header está ausente", () => {
    // Prova que o caminho antigo continua existindo, não foi substituído.
    assert.match(fonte, /await createSupabaseServerClient\(\)/)
    assert.match(fonte, /await supabase\.auth\.getUser\(\)/)
  })

  it("roles/personas continuam vindo exclusivamente das mesmas colunas do Prisma de sempre", () => {
    for (const persona of ["tutorProfile", "professionalProfile", "partnerProfile", "adminProfile"]) {
      assert.ok(fonte.includes(persona), `${persona} sumiu da seleção/roles`)
    }
  })
})
