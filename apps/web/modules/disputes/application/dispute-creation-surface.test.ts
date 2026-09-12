/**
 * SEAL-P2-02 — nenhuma Server Action cria disputa sem papel + ownership.
 *
 * Todo export de um arquivo que começa com `"use server"` vira endpoint RPC.
 * `moderation/application/actions.ts` exportava `createDisputeAction`, que só
 * checava sessão: qualquer conta logada abriria disputa em request alheia
 * (congela o Diário e entra no contador de disputas do par). Não era alcançável
 * no build porque nada a importava — mas bastaria um import para virar P1.
 *
 * Este teste varre TODOS os arquivos "use server" do app e exige que:
 *   1. quem cria disputa (`createDispute(` ou `dispute.create(`) seja só o
 *      fluxo do tutor em modules/disputes/application/actions.ts;
 *   2. esse fluxo confira papel de tutor e posse da request ANTES de gravar;
 *   3. `createDisputeAction` não volte a existir.
 *
 * Rodar: npm run test:authz
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

function arquivosUseServer(): string[] {
  const out: string[] = []
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      if (nome === "node_modules" || nome.startsWith(".")) continue
      const p = path.join(dir, nome)
      if (statSync(p).isDirectory()) andar(p)
      else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
        if (/^\s*["']use server["']/.test(readFileSync(p, "utf8"))) out.push(path.relative(RAIZ_APP, p).replace(/\\/g, "/"))
      }
    }
  }
  for (const raiz of ["modules", "app", "lib", "components"]) andar(path.join(RAIZ_APP, raiz))
  return out
}

/** Corpo de cada função exportada: do `export` até o próximo `export`. */
function exportsCom(fonte: string): Array<{ nome: string; corpo: string }> {
  const marcas = [...fonte.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
  return marcas.map((m, i) => ({ nome: m[1]!, corpo: fonte.slice(m.index, marcas[i + 1]?.index ?? fonte.length) }))
}

const CRIA_DISPUTA = /\bcreateDispute\s*\(|\bdispute\.create\s*\(/

describe("SEAL-P2-02 — superfície de criação de disputa", () => {
  const arquivos = arquivosUseServer()

  it("a varredura encontrou os arquivos \"use server\" (sanidade)", () => {
    assert.ok(arquivos.length >= 20, `só ${arquivos.length} arquivos — varredura quebrada`)
    assert.ok(arquivos.includes("modules/disputes/application/actions.ts"))
    assert.ok(arquivos.includes("modules/moderation/application/actions.ts"))
  })

  it("createDisputeAction não existe em nenhum arquivo \"use server\"", () => {
    for (const arq of arquivos) {
      const fonte = semComentarios(readFileSync(path.join(RAIZ_APP, arq), "utf8"))
      assert.doesNotMatch(fonte, /\bcreateDisputeAction\b/, arq)
    }
  })

  it("só createDisputeForRequestAction cria disputa", () => {
    const criadores: string[] = []
    for (const arq of arquivos) {
      const fonte = semComentarios(readFileSync(path.join(RAIZ_APP, arq), "utf8"))
      for (const { nome, corpo } of exportsCom(fonte)) if (CRIA_DISPUTA.test(corpo)) criadores.push(`${arq}::${nome}`)
    }
    assert.deepEqual(criadores, ["modules/disputes/application/actions.ts::createDisputeForRequestAction"])
  })

  it("createDisputeForRequestAction confere sessão, papel de tutor e posse da request ANTES de gravar", () => {
    const fonte = semComentarios(readFileSync(path.join(RAIZ_APP, "modules/disputes/application/actions.ts"), "utf8"))
    const corpo = exportsCom(fonte).find((e) => e.nome === "createDisputeForRequestAction")!.corpo
    const iGrava = corpo.search(CRIA_DISPUTA)
    const antes = corpo.slice(0, iGrava)
    assert.match(antes, /await requireAuth\(\)/, "sessão")
    assert.match(antes, /findTutorProfileByUserId\(session\.id\)/, "papel de tutor")
    assert.match(antes, /request\.tutorId !== tutorProfile\.id/, "posse da request")
    assert.match(antes, /findActiveDisputeByRequestId\(requestId\)/, "disputa ativa")
    assert.match(corpo.slice(iGrava), /openedBy: session\.id/, "autor vem da sessão")
  })
})
