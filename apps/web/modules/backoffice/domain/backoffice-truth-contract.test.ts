/**
 * GATE-14-BACKOFFICE-OPERATIONS-CLEANUP-001 — contrato de verdade do Backoffice.
 *
 * Este arquivo existe porque a mesma correção já foi feita uma vez e voltou.
 * Um gate anterior removeu `catch { return [] }` do REPOSITÓRIO de flags e
 * disputes e documentou a decisão — mas a camada de action continuou capturando
 * a exceção liberada, e as páginas continuaram fazendo `result.data ?? []`. O
 * bug sobreviveu inteiro, uma camada acima da correção.
 *
 * Então a trava não é sobre uma função: é sobre a CADEIA. Repositório, action e
 * página, os três ao mesmo tempo.
 *
 * Rodar: npm run test:backoffice
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
const ler = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"))

const REPO = ler("modules/backoffice/infrastructure/repository.ts")
const ACTIONS = ler("modules/backoffice/application/actions.ts")

const PAGINAS_DE_LISTA = [
  "app/(admin)/admin/audit/page.tsx",
  "app/(admin)/admin/risk/page.tsx",
  "app/(admin)/admin/flags/page.tsx",
  "app/(admin)/admin/disputes/page.tsx",
  "app/(admin)/admin/requests/page.tsx",
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Erro não é vazio — nas três camadas
// ─────────────────────────────────────────────────────────────────────────────

describe("ERRO NÃO É VAZIO — repositório", () => {
  it("nenhuma leitura do backoffice devolve lista vazia ao capturar exceção", () => {
    // Pega `catch { return [] }` e `catch (e) { return [] }`, em qualquer
    // formatação.
    const cego = /catch\s*(\([^)]*\))?\s*\{\s*return\s*\[\]\s*\}/g
    const achados = REPO.match(cego) ?? []
    assert.deepEqual(achados, [], `catch devolvendo [] voltou: ${achados.join(" | ")}`)
  })

  it("a contagem do dashboard só tolera o caso que ela documenta", () => {
    // `safeCount` pode devolver 0 para delegate ausente (hot-reload em dev),
    // mas precisa relançar o resto — senão o dashboard vira zeros confiantes.
    assert.match(REPO, /err instanceof TypeError/)
    assert.match(REPO, /throw err/)
  })
})

describe("ERRO NÃO É VAZIO — action", () => {
  const LEITURAS = [
    "getAdminRequestsAction",
    "getAdminReviewsAction",
    "getAdminTrustDataAction",
    "getAdminFlagsAction",
    "getAdminDisputesAction",
    "getAdminAuditAction",
    "getAdminRiskAction",
  ]

  it("toda leitura de lista devolve o array direto, sem embrulho de sucesso", () => {
    // O embrulho `{ success, data, error }` foi o esconderijo do silenciamento:
    // as páginas liam `data` e ignoravam `success`.
    for (const fn of LEITURAS) {
      const assinatura = new RegExp(`export async function ${fn}\\([\\s\\S]{0,120}?\\): Promise<([^>]+)>`)
      const m = ACTIONS.match(assinatura)
      assert.ok(m, `${fn} não encontrada`)
      assert.match(m![1]!, /\[\]$/, `${fn} não devolve array direto: ${m![1]}`)
    }
  })

  it("nenhuma leitura de lista captura exceção para virar lista vazia", () => {
    for (const fn of LEITURAS) {
      const corpo = ACTIONS.slice(ACTIONS.indexOf(`export async function ${fn}(`))
      const ateOProximoExport = corpo.slice(0, corpo.indexOf("\nexport ", 10))
      assert.ok(
        !/catch/.test(ateOProximoExport),
        `${fn} voltou a capturar a exceção`
      )
    }
  })
})

describe("ERRO NÃO É VAZIO — página", () => {
  it("nenhuma página de lista disfarça falha com `?? []`", () => {
    for (const caminho of PAGINAS_DE_LISTA) {
      const fonte = ler(caminho)
      assert.ok(
        !/result\.data \?\? \[\]/.test(fonte),
        `${caminho} ainda transforma falha em lista vazia`
      )
      assert.ok(
        !/result\.success \? result\.data : \[\]/.test(fonte),
        `${caminho} ainda desenha tabela vazia quando a consulta falha`
      )
    }
  })

  it("a página de disputas transforma falha em falha, não em vazio", () => {
    const fonte = ler("app/(admin)/admin/disputes/page.tsx")
    assert.match(fonte, /if \(!result\.success\)/)
    assert.match(fonte, /throw new Error/)
  })

  it("a fronteira de erro do admin existe — é para onde as exceções sobem", () => {
    const boundary = readFileSync(join(RAIZ, "app/(admin)/admin/error.tsx"), "utf8")
    assert.match(boundary, /"use client"/)
    assert.match(boundary, /reset/)
  })

  it("a fronteira não publica a mensagem crua do erro", () => {
    // `error.message` de query Prisma pode carregar tabela, coluna e parâmetro.
    const boundary = semComentarios(
      readFileSync(join(RAIZ, "app/(admin)/admin/error.tsx"), "utf8")
    )
    assert.ok(!/\{error\.message\}/.test(boundary), "mensagem crua na tela")
    assert.match(boundary, /digest/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRED — a verdade operacional
// ─────────────────────────────────────────────────────────────────────────────

describe("EXPIRED — o Backoffice mostra o estado operacional", () => {
  const PAGINA = ler("app/(admin)/admin/requests/page.tsx")

  it("a listagem deriva o estado em vez de exibir a coluna crua", () => {
    assert.match(PAGINA, /resolveOperationalRequestStatus\(row\)/)
    assert.match(PAGINA, /value=\{operacional\.effective\}/)
  })

  it("a divergência com o banco continua visível", () => {
    assert.match(PAGINA, /operacional\.pendingSync/)
    assert.match(PAGINA, /countPendingSync\(requests\)/)
  })

  it("o Backoffice NÃO escreve ao ler — investigar não altera o investigado", () => {
    for (const proibido of [
      "syncExpiredPendingRequest",
      "transitionStatus",
      "prisma.serviceRequest.update",
    ]) {
      assert.ok(!PAGINA.includes(proibido), `a listagem de admin muta dados: ${proibido}`)
    }
  })

  it("FIX-002 — o filtro de status obedece a MESMA verdade que a tabela exibe", () => {
    // A versão anterior deste teste travava o oposto: "o filtro continua
    // consultando a coluna persistida". Era a limitação que o gate deveria ter
    // corrigido, congelada como se fosse decisão. O filtro `PENDING` devolvia
    // linhas com badge `EXPIRED`, e o filtro `EXPIRED` escondia as vencidas não
    // sincronizadas — justamente o caso que o gate existe para revelar.
    assert.match(REPO, /isOperationalStatusFilter\(filter\.status\)/)
    assert.match(REPO, /matchesOperationalStatus\(linha, filtro, agora\)/)
  })

  it("a query não reimplementa a fórmula de vencimento", () => {
    assert.match(REPO, /pendingExpiryCandidateWindow\(agora\)/)

    // Só o CORPO de `whereCandidatos` — o recorte por "últimos N dias" também
    // multiplica por 24h logo abaixo e nada tem a ver com prazo de vencimento.
    const inicio = REPO.indexOf("function whereCandidatos")
    const corpo = REPO.slice(inicio, REPO.indexOf("\nasync function", inicio))
    assert.ok(inicio > 0 && corpo.length > 0, "whereCandidatos não encontrada")
    assert.ok(
      !/60 \* 60 \* 1000|3600000|\* 24\b/.test(corpo),
      "prazo recalculado dentro da query em vez de vir da janela oficial"
    )
  })

  it("o recorte operacional NÃO é `take` seguido de filtro", () => {
    // Filtrar depois de um lote fixo omitiria as linhas válidas e mais antigas
    // logo após o corte. A coleta é em lotes com cursor.
    assert.match(REPO, /coletarEmLotes\(\{/)
    assert.match(REPO, /cursor: \{ id: depoisDe \}, skip: 1/)
    assert.match(REPO, /ADMIN_REQUESTS_LOTE/)
    assert.match(REPO, /ADMIN_REQUESTS_MAX_LOTES/)
  })

  it("a ordem da paginação tem desempate estável", () => {
    // `createdAt` sozinho não é único: sem o `id`, a virada de cursor poderia
    // pular ou repetir uma linha.
    assert.match(REPO, /\{ createdAt: "desc" \},\s*\r?\n\s*\{ id: "desc" \}/)
  })

  it("count, estado vazio e aviso derivam do resultado final", () => {
    const PAGINA = ler("app/(admin)/admin/requests/page.tsx")
    assert.match(PAGINA, /count=\{requests\.length\}/)
    assert.match(PAGINA, /countPendingSync\(requests\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Filtros e estado vazio
// ─────────────────────────────────────────────────────────────────────────────

describe("filtros de solicitações — o estado vazio não mente", () => {
  const PAGINA = ler("app/(admin)/admin/requests/page.tsx")

  it("todo filtro aceito pela query tem controle no formulário", () => {
    for (const campo of ["status", "serviceType", "dias", "requestId"]) {
      assert.match(
        PAGINA,
        new RegExp(`name="${campo}"`),
        `${campo} é aceito pela action mas não tem controle`
      )
    }
  })

  it("todo filtro conta para decidir a mensagem de vazio", () => {
    const m = PAGINA.match(/const temFiltro = Boolean\(([^)]*)\)/)
    assert.ok(m, "temFiltro não encontrado")
    for (const campo of ["status", "serviceType", "dias", "requestId"]) {
      assert.ok(
        m![1]!.includes(campo),
        `"${campo}" fora de temFiltro: com ele ativo, o vazio diria que a base inteira está vazia`
      )
    }
  })

  it("as duas mensagens de vazio são diferentes", () => {
    assert.match(PAGINA, /Nenhuma solicitação para estes filtros/)
    assert.match(PAGINA, /Nenhuma solicitação encontrada/)
  })
})
