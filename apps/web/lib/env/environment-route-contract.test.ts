/**
 * GATE-16-DEMO-ENV-FOUNDATION-003 — contrato do endpoint `/api/environment`.
 *
 * É uma rota PÚBLICA, e o risco dela não é hoje: é a próxima pessoa que precisa
 * depurar um deploy e acha conveniente devolver "só mais um campinho" — a ref
 * do Supabase, a versão do build, o host do banco. Cada um desses parece
 * inofensivo sozinho e, somados, viram um mapa da infraestrutura servido sem
 * credencial.
 *
 * Estes testes leem o PRÓPRIO ARQUIVO da rota, seguindo o padrão de asserção
 * sobre fonte já usado no repositório. Testar só o valor de retorno não pegaria
 * o que importa aqui, porque o defeito seria acrescentar coisa nova.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const ROTA = join(AQUI, "..", "..", "app", "api", "environment", "route.ts")

const fonte = readFileSync(ROTA, "utf8")

/**
 * Comentários citam os nomes proibidos para explicar por que são proibidos —
 * então buscá-los no arquivo cru daria falso positivo. Removidos antes.
 */
const codigo = fonte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "")

describe("/api/environment não vaza nada além do rótulo", () => {
  it("responde apenas com a chave `environment`", () => {
    const json = codigo.match(/NextResponse\.json\(\s*\{([^}]*)\}/)
    if (!json) throw new Error("a rota deveria responder com NextResponse.json({...})")
    const chaves = (json[1] ?? "")
      .split(",")
      .map((p) => (p.split(":")[0] ?? "").trim())
      .filter(Boolean)
    assert.deepEqual(chaves, ["environment"], `campos extras no corpo: ${chaves.join(", ")}`)
  })

  it("não menciona nenhuma variável de ambiente sensível", () => {
    // A rota deve chegar ao ambiente por `getPeteenEnvironment()`, que é o único
    // intérprete. Tocar `process.env` aqui é o começo de expor outra coisa.
    const proibidos = [
      "process.env",
      "SUPABASE",
      "DATABASE_URL",
      "DIRECT_URL",
      "VAPID",
      "SECRET",
      "TOKEN",
      "KEY",
    ]
    for (const termo of proibidos) {
      assert.ok(
        !codigo.toUpperCase().includes(termo.toUpperCase()),
        `a rota não pode referenciar "${termo}"`
      )
    }
  })

  it("é dinâmica — o ambiente é do runtime, não do artefato de build", () => {
    // Sem isto o Next pode avaliar a rota no build e congelar a resposta, que é
    // exatamente a mentira que o endpoint existe para denunciar.
    assert.match(codigo, /export const dynamic\s*=\s*"force-dynamic"/)
  })

  it("não é cacheável", () => {
    assert.match(codigo, /no-store/)
  })

  it("é somente leitura — sem POST, PUT, PATCH ou DELETE", () => {
    for (const verbo of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export\\s+(async\\s+)?function\\s+${verbo}\\b`).test(codigo),
        `a rota não pode expor ${verbo}`
      )
    }
  })
})
