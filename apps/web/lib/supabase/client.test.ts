/**
 * Supabase browser client — contrato de configuração de auth (GATE 1).
 *
 * O bug que este teste trava: o client do browser é montado em toda página
 * (`SupabaseAuthProvider`, layout raiz) e, com o default do SDK, correria um
 * timer de refresh PRÓPRIO em paralelo ao do middleware — os dois disputando
 * o mesmo `refresh_token` rotativo. Ver o comentário grande em client.ts para
 * o mecanismo completo. Este teste não prova o bug em si (isso exige um
 * device iOS real), só que a mitigação não seja removida por engano.
 *
 * Sem jsdom no projeto: a asserção é sobre o CÓDIGO-FONTE, não sobre um
 * client instanciado — mesmo padrão já usado em legal-documents.test.ts.
 *
 * Rodar: node --experimental-strip-types --test lib/supabase/client.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const fonte = readFileSync(join(AQUI, "client.ts"), "utf8")

describe("createSupabaseBrowserClient — mitigação de corrida de refresh (GATE 1)", () => {
  it("desliga autoRefreshToken explicitamente", () => {
    assert.match(
      fonte,
      /autoRefreshToken:\s*false/,
      "autoRefreshToken:false sumiu — a corrida de refresh_token entre client e middleware volta a existir"
    )
  })

  it("CONTROLE NEGATIVO: a string sozinha não basta — precisa estar dentro de createBrowserClient", () => {
    // Garante que a asserção acima não passaria por acidente se a linha
    // fosse movida para um comentário ou para outro client não relacionado.
    const chamada = fonte.slice(
      fonte.indexOf("export function createSupabaseBrowserClient")
    )
    assert.match(chamada, /autoRefreshToken:\s*false/)
  })

  it("persistSession continua no default (não foi desligado por engano)", () => {
    // O client ainda precisa LER a sessão dos cookies para onAuthStateChange
    // e estado de UI — só o timer de renovação proativa foi removido.
    assert.doesNotMatch(fonte, /persistSession:\s*false/)
  })
})
