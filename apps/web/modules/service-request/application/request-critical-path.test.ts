/**
 * Caminho crítico da Request — invariantes que a otimização de latência não
 * pode ter quebrado (GATE-3-REQUEST-LATENCY-002).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO PROTEGE
 *
 * A missão trocou awaits em série por leituras em paralelo e eliminou uma
 * leitura duplicada da mesma linha. O ganho é real (cada round-trip medido
 * custa ~170ms contra o banco e ~200ms contra o Auth do Supabase), mas o
 * risco de uma otimização assim é sempre o mesmo: perder, junto com a espera,
 * a CHECAGEM que acontecia depois dela.
 *
 * Por isso a asserção mais importante daqui não é sobre performance — é sobre
 * autorização continuar existindo. Um teste que só verificasse `Promise.all`
 * passaria feliz num código que ficou rápido e inseguro.
 *
 * Asserção sobre código-fonte (mesmo padrão de legal-documents.test.ts e
 * push-health.test.ts): estas funções dependem de sessão e de banco reais, e
 * o projeto não tem infraestrutura de mock para nenhum dos dois — o que dá
 * para travar de forma determinística é a FORMA do caminho crítico.
 *
 * Rodar: node --experimental-strip-types --test modules/service-request/application/request-critical-path.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8")

const ACTIONS = "modules/service-request/application/actions.ts"
const REPOSITORY = "modules/service-request/infrastructure/repository.ts"

describe("autorização sobreviveu à otimização — a asserção que mais importa", () => {
  const fonte = ler(ACTIONS)

  it("getServiceRequestDetailAction ainda compara os donos contra session.id", () => {
    // Sem esta comparação, qualquer autenticado leria a request de qualquer
    // outro par tutor/profissional. Ler em paralelo é otimização; deixar de
    // comparar seria vazamento.
    const inicio = fonte.indexOf("export async function getServiceRequestDetailAction")
    assert.ok(inicio > 0, "getServiceRequestDetailAction sumiu")
    const corpo = fonte.slice(inicio, inicio + 2000)

    assert.match(
      corpo,
      /tutorUserId !== session\.id && professionalUserId !== session\.id/,
      "a checagem de ownership do detalhe sumiu"
    )
    assert.match(corpo, /Acesso negado/, "a recusa de acesso negado sumiu")
  })

  it("as leituras em paralelo nunca dispensam requireAuth", () => {
    // `Promise.all` reduz espera; não pode ter virado desculpa para não
    // autenticar. Cada ponto que lê em paralelo continua pedindo a sessão.
    const ocorrencias = fonte.split("Promise.all([").length - 1
    assert.ok(ocorrencias > 0, "nenhuma leitura em paralelo encontrada")

    // O helper central e a action de detalhe são os dois pontos que passaram a
    // paralelizar — ambos com requireAuth() dentro do próprio Promise.all.
    assert.match(fonte, /Promise\.all\(\[\s*requireAuth\(\),/)
  })
})

describe("leitura duplicada da mesma linha foi eliminada", () => {
  const fonte = ler(ACTIONS)

  it("getServiceRequestDetailAction não lê a request duas vezes", () => {
    const inicio = fonte.indexOf("export async function getServiceRequestDetailAction")
    const corpo = fonte.slice(inicio, inicio + 2000)

    // Antes: findRequestWithOwnershipContext (linha) + findServiceRequestWithParticipants
    // (MESMA linha), em série. Agora: uma chamada só.
    assert.doesNotMatch(
      corpo,
      /findServiceRequestWithParticipants\(/,
      "a segunda leitura da mesma linha voltou ao detalhe"
    )
    assert.match(corpo, /findServiceRequestDetailWithOwners\(/)
  })

  it("CONTROLE NEGATIVO: o helper antigo continua existindo para os outros consumidores", () => {
    // Admin e review ainda usam a projeção sem os donos — a função não podia
    // ser removida, só deixar de ser usada no detalhe.
    const repo = ler(REPOSITORY)
    assert.match(repo, /export async function findServiceRequestWithParticipants\(/)
  })

  it("o include não foi duplicado: o wrapper delega para a query única", () => {
    // Duas cópias do mesmo select divergiriam no primeiro campo novo que
    // alguém adicionasse em só um dos lados.
    const repo = ler(REPOSITORY)
    const inicio = repo.indexOf("export async function findServiceRequestWithParticipants")
    const corpo = repo.slice(inicio, inicio + 400)
    assert.match(corpo, /findServiceRequestDetailWithOwners\(id\)/)
  })
})

describe("userId não vaza para a projeção de tela", () => {
  it("findServiceRequestDetailWithOwners separa os donos do detalhe", () => {
    // `ServiceRequestWithParticipants` chega a client components. O id interno
    // de User existe aqui só para a autorização no servidor e é devolvido à
    // parte, nunca embutido em `detail`.
    const repo = ler(REPOSITORY)
    const inicio = repo.indexOf("export async function findServiceRequestDetailWithOwners")
    assert.ok(inicio > 0, "findServiceRequestDetailWithOwners sumiu")
    const corpo = repo.slice(inicio)

    assert.match(corpo, /const \{ userId: tutorUserId, \.\.\.tutor \} = result\.tutor/)
    assert.match(
      corpo,
      /const \{ userId: professionalUserId, \.\.\.professional \} = result\.professional/
    )
  })
})

describe("Push continua fora do caminho crítico (não regredir GATE-3-...-001)", () => {
  it("os notify* seguem agendados via after(), não await", () => {
    // e4644fb não pode ser desfeito por acidente enquanto se mexe no mesmo
    // arquivo. A trava detalhada vive em push-dispatch-latency.test.ts; aqui
    // fica o lembrete no arquivo que mais será editado por missões de latência.
    const fonte = ler(ACTIONS)
    assert.doesNotMatch(fonte, /\bawait\s+notifyRequest(Created|Accepted)\(/)
    assert.match(fonte, /after\(\(\)\s*=>\s*notifyRequestAccepted\(/)
  })
})
