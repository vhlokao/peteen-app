/**
 * Disputas — link para o detalhe da Request.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO PROTEGE
 *
 * `/admin/requests/[requestId]` já concentra Care Timeline, mídia, AuditLog e
 * push da solicitação — exatamente o que uma disputa exige para ser
 * investigada (§7 do briefing BACKOFFICE CARE OPERATIONS). A célula de Request
 * na lista de disputas mostrava o id como texto puro: para chegar lá, o
 * operador copiava o id e navegava à mão.
 *
 * Teste de fonte, não de render: a propriedade a garantir é "esta célula é um
 * link para a rota certa", que um teste de comportamento isolado do componente
 * não distinguiria de "parece um link mas não navega".
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(AQUI, "page.tsx"), "utf8")

describe("lista de disputas linka a Request para investigação", () => {
  it("importa Link de next/link", () => {
    assert.match(SRC, /import Link from "next\/link"/)
  })

  it("a célula de Request é um <Link>, não um <span>", () => {
    assert.match(SRC, /<Link\s+href=\{`\/admin\/requests\/\$\{d\.requestId\}`\}/)
  })

  it("aponta para o MESMO prefixo de rota usado em /admin/push", () => {
    // Regression guard: se o prefixo da rota de detalhe mudar um dia, os dois
    // pontos de entrada (push e disputas) precisam mudar juntos. Compara só o
    // prefixo — cada tela interpola uma variável de nome diferente
    // (d.requestId vs r.entityId), o que é esperado e não é o que este teste
    // protege.
    const pushPage = readFileSync(join(AQUI, "..", "push", "page.tsx"), "utf8")
    assert.match(pushPage, /\/admin\/requests\/\$\{/)
    assert.match(SRC, /\/admin\/requests\/\$\{d\.requestId\}/)
  })

  it("ainda mostra o id abreviado — não regrediu para o id inteiro", () => {
    assert.match(SRC, /#\{formatShortId\(d\.requestId\)\}/)
  })
})
