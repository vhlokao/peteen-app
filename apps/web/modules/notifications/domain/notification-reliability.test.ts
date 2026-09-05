/**
 * GATE-13-NOTIFICATION-RELIABILITY-QA-001 — confiabilidade do canal.
 *
 * Este arquivo trava a MATRIZ REAL encontrada na auditoria: os seis eventos que
 * existem hoje, quem recebe cada um, para onde cada um leva, e as invariantes
 * de lifecycle/fanout/dedupe/account-switch que sustentam a entrega.
 *
 * Não inventa evento nem destinatário. Se alguém adicionar um kind de negócio
 * sem entrada aqui, o teste de completude quebra e força a decisão explícita.
 *
 * O que este arquivo NÃO prova, e está no QA físico do RESULT: entrega real ao
 * aparelho, comportamento do SO ao colapsar notificações, background/app
 * fechado, e iOS/PWA.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  buildPushPayload,
  PUSH_KINDS_COM_ENTIDADE,
  PUSH_NOTIFICATION_KINDS,
  SMOKE_PAYLOAD,
  type PushNotificationKind,
} from "./push-events.ts"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

function codigoSemComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}
const ler = (rel: string) => codigoSemComentarios(readFileSync(join(RAIZ, rel), "utf8"))

const EVENTOS = ler("modules/notifications/application/push-service-request-events.ts")
const DISPATCHER = ler("modules/notifications/application/dispatch-push.ts")
const ACTIONS = ler("modules/notifications/application/push-actions.ts")
const REPO = ler("modules/notifications/infrastructure/push-repository.ts")
const REPAIR = ler("lib/push/repair.ts")
const LOGOUT = ler("lib/push/logout.ts")
const SW = readFileSync(join(RAIZ, "public/sw.js"), "utf8")

const REQ = "cmqishhuf0001t4sckixc5mdg"

// ─────────────────────────────────────────────────────────────────────────────
// EVENT MAP + RECIPIENT MATRIX
//
// A tabela abaixo É o mapa auditado. `persona` é quem RECEBE, e a rota é o
// prefixo da árvore daquela persona.
// ─────────────────────────────────────────────────────────────────────────────

type LinhaDoMapa = {
  kind: Exclude<PushNotificationKind, "smoke">
  persona: "tutor" | "professional"
  fn: string
  prefixoDaRota: string
}

const MAPA: readonly LinhaDoMapa[] = [
  {
    kind: "request_created",
    persona: "professional",
    fn: "notifyRequestCreated",
    prefixoDaRota: "/requests/",
  },
  {
    kind: "request_accepted",
    persona: "tutor",
    fn: "notifyRequestAccepted",
    prefixoDaRota: "/tutor/requests/",
  },
  {
    kind: "service_started",
    persona: "tutor",
    fn: "notifyServiceStarted",
    prefixoDaRota: "/tutor/requests/",
  },
  {
    kind: "care_update",
    persona: "tutor",
    fn: "notifyCareUpdatePublished",
    prefixoDaRota: "/tutor/requests/",
  },
  {
    kind: "service_completed",
    persona: "tutor",
    fn: "notifyServiceCompleted",
    prefixoDaRota: "/tutor/requests/",
  },
  {
    kind: "request_cancelled_by_tutor",
    persona: "professional",
    fn: "notifyRequestCancelled",
    prefixoDaRota: "/requests/",
  },
  {
    kind: "request_cancelled_by_professional",
    persona: "tutor",
    fn: "notifyRequestCancelled",
    prefixoDaRota: "/tutor/requests/",
  },
]

describe("EVENT MAP — só os eventos que existem, todos conectados", () => {
  it("todo kind de negócio está no mapa auditado", () => {
    const noMapa = new Set(MAPA.map((l) => l.kind))
    for (const kind of PUSH_KINDS_COM_ENTIDADE) {
      assert.ok(noMapa.has(kind), `kind sem entrada no mapa auditado: ${kind}`)
    }
  })

  it("o mapa não inventa kind que não existe", () => {
    const reais = new Set<string>(PUSH_NOTIFICATION_KINDS)
    for (const linha of MAPA) {
      assert.ok(reais.has(linha.kind), `mapa cita kind inexistente: ${linha.kind}`)
    }
  })

  it("cada evento tem exatamente uma função despachante", () => {
    for (const fn of new Set(MAPA.map((l) => l.fn))) {
      assert.match(EVENTOS, new RegExp(`export async function ${fn}\\(`), fn)
    }
  })

  it("o destinatário é SEMPRE resolvido no servidor, nunca recebido do client", () => {
    // Nenhuma das funções aceita recipient/userId como parâmetro.
    assert.doesNotMatch(EVENTOS, /recipientUserId\s*[,)]/)
    assert.match(EVENTOS, /recipientUserId: ctx\./)
  })

  it("cada despacho passa por um eventKey — o dedupe é obrigatório", () => {
    const chaves = EVENTOS.match(/buildEventKey\(/g) ?? []
    assert.ok(chaves.length >= MAPA.length - 1, `poucos eventKey: ${chaves.length}`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEEP LINK MATRIX
// ─────────────────────────────────────────────────────────────────────────────

describe("DEEP LINK — cada evento leva à árvore da persona destinatária", () => {
  it("nenhum evento manda o tutor para rota de profissional, nem o contrário", () => {
    for (const linha of MAPA) {
      const rota =
        linha.kind === "care_update"
          ? `/tutor/requests/${REQ}/diario`
          : `${linha.prefixoDaRota}${REQ}`
      const payload = buildPushPayload(linha.kind, rota, REQ)

      if (linha.persona === "tutor") {
        assert.ok(payload.url.startsWith("/tutor/"), `${linha.kind}: ${payload.url}`)
      } else {
        assert.ok(
          payload.url.startsWith("/requests/"),
          `${linha.kind} deveria ir para a árvore do profissional: ${payload.url}`
        )
        assert.ok(!payload.url.startsWith("/tutor/"), linha.kind)
      }
    }
  })

  it("care_update aponta para o Diário, não para o resumo da Request", () => {
    const p = buildPushPayload("care_update", `/tutor/requests/${REQ}/diario`, REQ)
    assert.ok(p.url.endsWith("/diario"), p.url)
  })

  it("o deep link carrega a entidade — nunca uma listagem genérica", () => {
    for (const linha of MAPA) {
      const rota =
        linha.kind === "care_update"
          ? `/tutor/requests/${REQ}/diario`
          : `${linha.prefixoDaRota}${REQ}`
      assert.ok(buildPushPayload(linha.kind, rota, REQ).url.includes(REQ), linha.kind)
    }
  })

  it("rota fora da origem vira fallback, nunca redirect externo", () => {
    for (const hostil of ["https://evil.example/x", "//evil.example", "/\\evil.example"]) {
      const p = buildPushPayload("request_accepted", hostil, REQ)
      assert.ok(!p.url.includes("evil"), `${hostil} → ${p.url}`)
      assert.ok(p.url.startsWith("/"))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPE / COLAPSO — o defeito que este gate corrigiu
// ─────────────────────────────────────────────────────────────────────────────

describe("DEDUPE — entidades diferentes nunca se substituem na bandeja", () => {
  it("duas solicitações diferentes produzem tags diferentes", () => {
    // O DEFEITO: seis kinds compartilhavam a literal `peteen-request`, então a
    // notificação da solicitação B substituía — em SILÊNCIO — a da solicitação
    // A. O sintoma observável é "a notificação não chegou".
    for (const linha of MAPA) {
      const a = buildPushPayload(linha.kind, `${linha.prefixoDaRota}A`, "A")
      const b = buildPushPayload(linha.kind, `${linha.prefixoDaRota}B`, "B")
      assert.notEqual(a.tag, b.tag, `${linha.kind} colide entre entidades`)
    }
  })

  it("todo kind de negócio produz tag escopada pela entidade", () => {
    for (const kind of PUSH_KINDS_COM_ENTIDADE) {
      const tag = buildPushPayload(kind, "/tutor/requests/ABC", "ABC").tag
      assert.ok(tag.endsWith(":ABC"), `${kind} sem escopo de entidade: ${tag}`)
    }
  })

  it("o MESMO evento na MESMA entidade continua colapsando — o retry não empilha", () => {
    const primeira = buildPushPayload("request_accepted", `/tutor/requests/${REQ}`, REQ)
    const reenvio = buildPushPayload("request_accepted", `/tutor/requests/${REQ}`, REQ)
    assert.equal(primeira.tag, reenvio.tag)
  })

  it("care_update mantém faixa própria — não substitui aviso de conclusão", () => {
    const care = buildPushPayload("care_update", `/tutor/requests/${REQ}/diario`, REQ)
    const fim = buildPushPayload("service_completed", `/tutor/requests/${REQ}`, REQ)
    assert.notEqual(care.tag, fim.tag)
  })

  it("o smoke não tem entidade e não colide com evento de negócio", () => {
    for (const kind of PUSH_KINDS_COM_ENTIDADE) {
      assert.notEqual(SMOKE_PAYLOAD.tag, buildPushPayload(kind, "/x", REQ).tag)
    }
  })

  it("a tag cabe no limite que o service worker aplica", () => {
    // sanitizeText(dados.tag, "peteen", 60) — truncar faria duas entidades
    // longas voltarem a colidir.
    for (const kind of PUSH_KINDS_COM_ENTIDADE) {
      const tag = buildPushPayload(kind, "/x", REQ).tag
      assert.ok(tag.length <= 60, `${kind}: ${tag.length} chars`)
    }
  })

  it("substituir por tag deixou de ser silencioso no service worker", () => {
    // Sem `renotify`, a troca não toca nem vibra: a evolução de um mesmo
    // atendimento atualizava a bandeja sem alertar ninguém.
    assert.match(SW, /renotify:\s*true/)
  })

  it("o service worker continua repassando a tag que a factory decidiu", () => {
    assert.match(SW, /const tag = sanitizeText\(dados\.tag/)
    assert.match(SW, /showNotification\(title, \{[\s\S]*?\btag\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FANOUT — um aparelho morto não pode calar os outros
// ─────────────────────────────────────────────────────────────────────────────

describe("FANOUT — multi-device", () => {
  it("os envios são isolados por device (allSettled, nunca all)", () => {
    assert.match(DISPATCHER, /Promise\.allSettled\(/)
    assert.ok(
      !/await Promise\.all\(\s*subscriptions/.test(DISPATCHER),
      "Promise.all faria uma rejeição abortar os demais devices"
    )
  })

  it("a consulta de envio traz TODAS as subscriptions ativas do destinatário", () => {
    assert.match(REPO, /findMany\(\{[\s\S]*?userId,[\s\S]*?revokedAt: null/)
  })

  it("uma rejeição isolada não interrompe o laço de resultados", () => {
    assert.match(DISPATCHER, /r\.status === "rejected"/)
    assert.match(DISPATCHER, /continue/)
  })

  it("o mesmo endpoint não pode existir duas vezes — unicidade é do schema", () => {
    const schema = readFileSync(join(RAIZ, "prisma/schema.prisma"), "utf8")
    assert.match(schema, /endpoint String\? @unique/)
  })

  it("os contadores separam aceito, falho e inválido", () => {
    for (const campo of ["attemptedCount", "acceptedCount", "failedCount", "invalidCount"]) {
      assert.ok(DISPATCHER.includes(campo), campo)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// STALE / 404 / 410
// ─────────────────────────────────────────────────────────────────────────────

describe("STALE — endpoint morto é revogado, e só ele", () => {
  it("a revogação exige morte comprovada, não um outcome genérico", () => {
    assert.match(DISPATCHER, /ehSubscriptionMorta\(res\.statusCode\)/)
    assert.match(DISPATCHER, /revokeGoneSubscription\(/)
  })

  it("a revogação por 'gone' acontece depois do laço, sobre ids coletados", () => {
    assert.match(DISPATCHER, /const mortas: string\[\] = \[\]/)
    assert.match(DISPATCHER, /for \(const id of mortas\)/)
  })

  it("falhar ao revogar não derruba o dispatch", () => {
    assert.match(DISPATCHER, /revoke_gone_failed/)
  })

  it("o reparo não reaproveita endpoint já comprovado morto", () => {
    assert.match(REPAIR, /wasEndpointRevokedAsGoneAction\(/)
    assert.match(REPAIR, /deveRenegociarAoReparar\(/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT SWITCH
// ─────────────────────────────────────────────────────────────────────────────

describe("ACCOUNT SWITCH — subscription nunca troca de dono", () => {
  it("endpoint ativo de outro usuário devolve conflito, sem mutação", () => {
    assert.match(ACTIONS, /existente\.userId !== userId/)
    assert.match(ACTIONS, /SUBSCRIPTION_CONFLICT/)
  })

  it("nem em corrida (P2002) o dono é reconfirmado errado", () => {
    assert.match(ACTIONS, /dono && dono\.userId !== userId/)
  })

  it("o servidor NUNCA transfere a linha — quem renegocia é o browser", () => {
    assert.ok(
      !/update\([\s\S]{0,200}userId:\s*userId[\s\S]{0,120}endpoint/.test(ACTIONS),
      "há um caminho que reatribui userId de uma linha existente"
    )
    assert.match(REPAIR, /SUBSCRIPTION_CONFLICT[\s\S]{0,200}renegociarSubscription\(/)
  })

  it("o conflito é resolvido com UMA renegociação, sem laço", () => {
    const ocorrencias = (REPAIR.match(/renegociarSubscription\(/g) ?? []).length
    assert.ok(ocorrencias <= 2, `renegociação repetida demais: ${ocorrencias}`)
  })

  it("toda revogação é escopada por usuário da sessão + endpoint", () => {
    assert.match(ACTIONS, /revokeSubscription\(\{ userId, endpoint, reason: "user_optout" \}\)/)
    assert.match(ACTIONS, /revokeSubscription\(\{ userId, endpoint, reason: "logout" \}\)/)
  })

  it("o logout revoga no servidor ANTES de desinscrever no browser", () => {
    // Compara as CHAMADAS, não os nomes: `desinscreverLocalmente` aparece
    // antes no import do topo, e comparar posições de nome solto acusaria uma
    // inversão que não existe.
    const posRevoke = LOGOUT.indexOf("revokePushOnLogoutAction(endpoint)")
    const posUnsub = LOGOUT.indexOf("desinscreverLocalmente()")
    assert.ok(posRevoke > 0, "revogação no servidor sumiu do logout")
    assert.ok(posUnsub > posRevoke, "ordem de revogação invertida")
  })

  it("o signOut é o ÚLTIMO passo — depois dele não há sessão para revogar", () => {
    const SIGNOUT = ler("lib/push/sign-out.ts")
    const posRevoke = SIGNOUT.indexOf("revogarPushAntesDoLogout()")
    const posSignOut = SIGNOUT.indexOf("auth.signOut(")
    assert.ok(posRevoke > 0 && posSignOut > posRevoke, "signOut antes da revogação")
    // `scope: "local"` — o default global derrubaria a sessão dos outros
    // aparelhos deste usuário sem revogar as subscriptions deles.
    assert.match(SIGNOUT, /scope: "local"/)
  })

  it("o logout é best-effort — nunca impede a saída", () => {
    assert.match(LOGOUT, /catch \{/)
    assert.match(LOGOUT, /REVOKE_TIMEOUT_MS/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ISOLAMENTO DE AMBIENTE
// ─────────────────────────────────────────────────────────────────────────────

describe("AMBIENTE — dev/preview não alcança aparelho de produção", () => {
  it("a elegibilidade é avaliada antes de qualquer envio", () => {
    const posAvalia = DISPATCHER.indexOf("avaliarElegibilidade")
    const posEnvia = DISPATCHER.indexOf("Promise.allSettled")
    assert.ok(posAvalia > 0 && posAvalia < posEnvia, "filtro de ambiente depois do envio")
  })

  it("os dois eixos entram na decisão", () => {
    assert.match(DISPATCHER, /senderFingerprint:/)
    assert.match(DISPATCHER, /senderEnvironment:/)
  })

  it("zero elegíveis NÃO é contado como falha", () => {
    assert.match(DISPATCHER, /if \(elegiveis\.length === 0\)/)
    assert.match(DISPATCHER, /return \{ \.\.\.VAZIO, pushEnabled: true \}/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PII / PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

describe("PII — a lockscreen não conta o que é da sessão", () => {
  it("o payload tem exatamente quatro campos", () => {
    for (const kind of PUSH_NOTIFICATION_KINDS) {
      const p = buildPushPayload(kind, `/tutor/requests/${REQ}`, REQ)
      assert.deepEqual(Object.keys(p).sort(), ["body", "tag", "title", "url"], kind)
    }
  })

  it("nenhuma copy visível carrega o id da entidade", () => {
    for (const kind of PUSH_KINDS_COM_ENTIDADE) {
      const p = buildPushPayload(kind, `/tutor/requests/${REQ}`, REQ)
      assert.ok(!p.title.includes(REQ), kind)
      assert.ok(!p.body.includes(REQ), kind)
    }
  })

  it("o dispatcher nunca loga endpoint, chave ou payload", () => {
    for (const proibido of ["p256dh", "s.endpoint", "input.payload"]) {
      assert.ok(
        !new RegExp(`console\\.(info|warn|error)\\([\\s\\S]{0,200}${proibido.replace(".", "\\.")}`).test(
          DISPATCHER
        ),
        `log expõe ${proibido}`
      )
    }
  })

  it("a URL viaja em data, nunca no corpo visível da notificação", () => {
    assert.match(SW, /data: \{ url \}/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IDEMPOTÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

describe("IDEMPOTÊNCIA — at-most-once por evento", () => {
  it("o claim acontece ANTES de qualquer envio", () => {
    const posClaim = DISPATCHER.indexOf("pushDelivery.create")
    const posEnvio = DISPATCHER.indexOf("Promise.allSettled")
    assert.ok(posClaim > 0 && posClaim < posEnvio, "envio antes do claim duplicaria no retry")
  })

  it("P2002 no claim retorna em silêncio, sem segundo envio", () => {
    assert.match(DISPATCHER, /alreadyDispatched: true/)
  })

  it("push desabilitado não queima o eventKey", () => {
    const posVapid = DISPATCHER.indexOf("if (!vapid)")
    const posClaim = DISPATCHER.indexOf("pushDelivery.create")
    assert.ok(posVapid > 0 && posVapid < posClaim)
  })
})
