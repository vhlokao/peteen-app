/**
 * R2B.5 — convite contextual de ativação de push.
 *
 * Cobre a matriz persona × status (itens 14 A/B/C/F), a regra de dispensa
 * (item E), e a trava estrutural do item 16: nenhum código do fluxo pode
 * chamar `Notification.requestPermission()` fora de um gesto explícito.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  contaHrefDaPersona,
  isPushInviteEligible,
  PUSH_INVITE_CTA,
  PUSH_INVITE_DISMISS,
  pushInviteDismissKey,
  resolveContextualInviteMode,
  resolveContextualOrientacao,
  resolvePushInviteCopy,
  type AmbientePushObservado,
} from "./contextual-push-invite.ts"
import { textoPrometeAviso } from "./notification-settings.ts"
import type { RequestStatus } from "../../service-request/domain/types.ts"

const TERMINAIS: RequestStatus[] = [
  "COMPLETED",
  "CANCELLED_BY_TUTOR",
  "CANCELLED_BY_PROFESSIONAL",
  "EXPIRED",
  "DISPUTED",
]

// ─────────────────────────────────────────────────────────────────────────────
// Matriz do tutor — itens A, B, C
// ─────────────────────────────────────────────────────────────────────────────

describe("tutor — copy por momento operacional", () => {
  it("item A — PENDING fala em resposta do profissional", () => {
    const c = resolvePushInviteCopy("tutor", "PENDING")
    assert.equal(c?.title, "Receba avisos sobre sua solicitação")
    assert.match(c!.description, /responder/i)
  })

  it("item B — ACCEPTED fala em início e atualizações", () => {
    const c = resolvePushInviteCopy("tutor", "ACCEPTED")
    assert.equal(c?.title, "Acompanhe o atendimento")
    assert.match(c!.description, /começar/i)
  })

  it("item C — IN_PROGRESS fala no Diário", () => {
    const c = resolvePushInviteCopy("tutor", "IN_PROGRESS")
    assert.equal(c?.title, "Não perca atualizações do cuidado")
    assert.match(c!.description, /diário/i)
  })

  it("os três momentos têm copy DISTINTA — o card não é genérico", () => {
    const titulos = (["PENDING", "ACCEPTED", "IN_PROGRESS"] as const).map(
      (s) => resolvePushInviteCopy("tutor", s)!.title
    )
    assert.equal(new Set(titulos).size, 3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Matriz do profissional — item F + honestidade com o contrato R2B.3
// ─────────────────────────────────────────────────────────────────────────────

describe("profissional — copy só promete o que o R2B.3 envia a ele", () => {
  it("item F — PENDING fala em nova solicitação (request_created é dele)", () => {
    const c = resolvePushInviteCopy("professional", "PENDING")
    assert.match(c!.description, /nova solicitação/i)
  })

  it("ACCEPTED/IN_PROGRESS falam em cancelamento — o único evento que ele recebe ali", () => {
    for (const status of ["ACCEPTED", "IN_PROGRESS"] as const) {
      const c = resolvePushInviteCopy("professional", status)
      assert.match(c!.description, /cancelar/i, status)
    }
  })

  it("NUNCA promete Diário, início ou conclusão ao profissional — são atos dele", () => {
    // Prometer aviso de algo que nunca chega ensina a ignorar notificação.
    for (const status of ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const) {
      const c = resolvePushInviteCopy("professional", status)!
      const texto = `${c.title} ${c.description}`.toLowerCase()
      assert.ok(!texto.includes("diário"), `${status} prometeu Diário`)
      assert.ok(!/atendimento começ|iniciad/i.test(texto), `${status} prometeu início`)
      assert.ok(!/conclu/i.test(texto), `${status} prometeu conclusão`)
    }
  })

  it("tutor e profissional nunca compartilham a mesma copy no mesmo status", () => {
    for (const status of ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const) {
      const t = resolvePushInviteCopy("tutor", status)!
      const p = resolvePushInviteCopy("professional", status)!
      assert.notEqual(t.description, p.description, status)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Elegibilidade
// ─────────────────────────────────────────────────────────────────────────────

describe("estados terminais não convidam", () => {
  it("nenhuma persona recebe convite em status terminal", () => {
    for (const persona of ["tutor", "professional"] as const) {
      for (const status of TERMINAIS) {
        assert.equal(resolvePushInviteCopy(persona, status), null, `${persona}/${status}`)
        assert.equal(isPushInviteEligible(persona, status), false, `${persona}/${status}`)
      }
    }
  })

  it("os três status ativos são elegíveis para as duas personas", () => {
    for (const persona of ["tutor", "professional"] as const) {
      for (const status of ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const) {
        assert.equal(isPushInviteEligible(persona, status), true, `${persona}/${status}`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Copy — item 11
// ─────────────────────────────────────────────────────────────────────────────

describe("item 11 — títulos vendem BENEFÍCIO, não permissão", () => {
  it("nenhum título é 'Permitir notificações' nem variação técnica", () => {
    for (const persona of ["tutor", "professional"] as const) {
      for (const status of ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const) {
        const t = resolvePushInviteCopy(persona, status)!.title.toLowerCase()
        assert.ok(!t.startsWith("permitir"), `${persona}/${status}: ${t}`)
        assert.ok(!t.includes("permissão"), `${persona}/${status}: ${t}`)
      }
    }
  })

  it("o CTA continua explícito e único", () => {
    assert.equal(PUSH_INVITE_CTA, "Ativar notificações")
  })

  it("a saída é discreta e não definitiva", () => {
    assert.equal(PUSH_INVITE_DISMISS, "Agora não")
    assert.ok(!/nunca|não mostrar mais/i.test(PUSH_INVITE_DISMISS))
  })

  it("nenhuma copy vaza PII ou termo técnico (item 12)", () => {
    const proibidos = ["pet", "telefone", "endereço", "storagePath", "token", "VAPID", "undefined"]
    for (const persona of ["tutor", "professional"] as const) {
      for (const status of ["PENDING", "ACCEPTED", "IN_PROGRESS"] as const) {
        const c = resolvePushInviteCopy(persona, status)!
        const texto = `${c.title} ${c.description}`.toLowerCase()
        for (const termo of proibidos) {
          assert.ok(!texto.includes(termo.toLowerCase()), `${persona}/${status}: "${termo}"`)
        }
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Dispensa — item E
// ─────────────────────────────────────────────────────────────────────────────

describe("item E — dispensa por momento operacional", () => {
  it("a chave é estável: mesma persona/request/status → mesma chave", () => {
    assert.equal(
      pushInviteDismissKey("tutor", "req_1", "PENDING"),
      pushInviteDismissKey("tutor", "req_1", "PENDING")
    )
  })

  it("dispensar em PENDING não silencia ACCEPTED — é outro momento", () => {
    assert.notEqual(
      pushInviteDismissKey("tutor", "req_1", "PENDING"),
      pushInviteDismissKey("tutor", "req_1", "ACCEPTED")
    )
  })

  it("requests diferentes não compartilham dispensa", () => {
    assert.notEqual(
      pushInviteDismissKey("tutor", "req_1", "PENDING"),
      pushInviteDismissKey("tutor", "req_2", "PENDING")
    )
  })

  it("personas diferentes não compartilham dispensa", () => {
    assert.notEqual(
      pushInviteDismissKey("tutor", "req_1", "PENDING"),
      pushInviteDismissKey("professional", "req_1", "PENDING")
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Item 16 — TRAVA: permissão só por gesto explícito
// ─────────────────────────────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

/**
 * Remove comentários antes de inspecionar.
 *
 * Sem isto o teste casaria com a própria DOCUMENTAÇÃO da regra — o cabeçalho
 * de lib/push/client.ts cita `Notification.requestPermission()` justamente
 * para explicar que nada ali a chama. Um teste que quebra porque alguém
 * documentou bem é um teste ruim.
 */
function codigoSemComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const ler = (rel: string) => codigoSemComentarios(readFileSync(join(RAIZ, rel), "utf8"))

describe("item 16 — render NUNCA pede permissão", () => {
  /**
   * Trava estrutural, não de comportamento: sem jsdom não dá para montar o
   * componente e observar. O que dá para garantir — e é o que importa — é que
   * existe UM ÚNICO ponto no código que chama a API do browser, e que ele está
   * dentro de um handler de clique, não de um efeito de montagem.
   */
  const ARQUIVOS = [
    "modules/notifications/components/contextual-push-activation.tsx",
    "modules/notifications/components/contextual-push-section.tsx",
    "modules/notifications/domain/contextual-push-invite.ts",
    "lib/push/client.ts",
  ]

  it("nenhum arquivo novo do R2B.5 chama requestPermission", () => {
    for (const arquivo of ARQUIVOS) {
      assert.ok(
        !ler(arquivo).includes("requestPermission"),
        `${arquivo} chama requestPermission — só o PushOptIn pode, e só no clique`
      )
    }
  })

  it("requestPermission existe em UM único lugar do produto", () => {
    // Duas implementações = duas chances de queimar o `denied`, que é
    // permanente no browser.
    const ocorrencias = ARQUIVOS.concat([
      "modules/notifications/components/push-opt-in.tsx",
    ]).filter((a) => ler(a).includes("Notification.requestPermission"))

    assert.deepEqual(ocorrencias, ["modules/notifications/components/push-opt-in.tsx"])
  })

  it("no PushOptIn a chamada está no fluxo de clique, não em useEffect de mount", () => {
    const fonte = ler("modules/notifications/components/push-opt-in.tsx")
    const indice = fonte.indexOf("Notification.requestPermission")
    assert.ok(indice > 0)

    // O trecho anterior à chamada precisa conter a função `ativar` — que é o
    // onClick do botão. Se algum dia migrar para dentro de um efeito, o
    // marcador mais próximo deixa de ser `ativar` e este teste quebra.
    const antes = fonte.slice(0, indice)
    const ultimaAtivar = antes.lastIndexOf("const ativar")
    const ultimoEffect = antes.lastIndexOf("useEffect(")
    assert.ok(
      ultimaAtivar > ultimoEffect,
      "requestPermission deixou de estar dentro do handler `ativar`"
    )
  })

  it("o convite contextual só OBSERVA o ambiente no mount", () => {
    const fonte = ler("modules/notifications/components/contextual-push-activation.tsx")
    // A única função de push chamada em efeito é a observadora.
    assert.ok(fonte.includes("avaliarAmbientePush"))
    assert.ok(!fonte.includes("assinar("), "não deve criar subscription por conta própria")
    assert.ok(!fonte.includes("subscribeToPushAction"), "não deve falar com a API de push")
  })

  it("o convite não reimplementa VAPID nem rate limit (item 8)", () => {
    const fonte = ler("modules/notifications/components/contextual-push-activation.tsx")
    for (const proibido of ["RATE_LIMIT", "applicationServerKey", "urlBase64", "PushManager"]) {
      assert.ok(!fonte.includes(proibido), `duplicou infraestrutura: ${proibido}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GATE-10 — modo do convite na Request
//
// O portão anterior era uma lista de `if`s no componente. `negado` e
// `ios-fora-da-tela-inicio` não estavam em nenhuma lista de silêncio, então
// herdavam por omissão o caminho do convite — e a Request passava a exibir
// "Ative as notificações para saber quando o profissional responder" para
// alguém cujo browser recusa qualquer ativação.
// ─────────────────────────────────────────────────────────────────────────────

const AMBIENTES: readonly AmbientePushObservado[] = [
  "sem-suporte",
  "ios-fora-da-tela-inicio",
  "nao-configurado",
  "negado",
  "ativo",
  "permitido-sem-subscription",
  "desativado",
]

describe("GATE-10 — modo do convite contextual", () => {
  it("push já ativo: a Request não insiste", () => {
    assert.equal(resolveContextualInviteMode("ativo"), "silenciar")
  })

  it("ambiente sem push algum: silêncio, não erro genérico", () => {
    assert.equal(resolveContextualInviteMode("sem-suporte"), "silenciar")
    assert.equal(resolveContextualInviteMode("nao-configurado"), "silenciar")
  })

  it("bloqueado NÃO oferece ativação — orienta", () => {
    assert.equal(resolveContextualInviteMode("negado"), "orientar")
  })

  it("iPhone fora da Tela de Início NÃO oferece ativação — orienta", () => {
    assert.equal(resolveContextualInviteMode("ios-fora-da-tela-inicio"), "orientar")
  })

  it("os dois estados acionáveis oferecem", () => {
    assert.equal(resolveContextualInviteMode("desativado"), "oferecer")
    assert.equal(resolveContextualInviteMode("permitido-sem-subscription"), "oferecer")
  })

  it("todo ambiente tem um modo — nenhum herda comportamento por omissão", () => {
    for (const a of AMBIENTES) {
      const modo = resolveContextualInviteMode(a)
      assert.ok(
        modo === "oferecer" || modo === "orientar" || modo === "silenciar",
        `${a} sem modo definido`
      )
    }
  })
})

describe("GATE-10 — orientação contextual não promete aviso", () => {
  it("existe exatamente para os dois estados que orientam", () => {
    for (const a of AMBIENTES) {
      const temTexto = resolveContextualOrientacao(a) !== null
      assert.equal(
        temTexto,
        resolveContextualInviteMode(a) === "orientar",
        `${a}: texto de orientação e modo discordam`
      )
    }
  })

  it("nenhum texto de orientação promete que a pessoa será avisada", () => {
    for (const a of AMBIENTES) {
      const texto = resolveContextualOrientacao(a)
      if (!texto) continue
      assert.equal(
        textoPrometeAviso(`${texto.texto} ${texto.acao}`),
        false,
        `${a} promete aviso estando bloqueado`
      )
    }
  })

  it("o rótulo do link diz o que a pessoa vai encontrar — e não repete o destino", () => {
    for (const a of ["negado", "ios-fora-da-tela-inicio"] as const) {
      const o = resolveContextualOrientacao(a)!
      assert.match(o.acao, /^Ver como /)
      // A frase não pode nomear a tela: o link ao lado já é o destino.
      assert.doesNotMatch(o.texto, /Minha conta/i, `${a} repete o destino na frase`)
    }
  })

  it("bloqueado e iOS têm textos DIFERENTES — as causas são diferentes", () => {
    assert.notDeepEqual(
      resolveContextualOrientacao("negado"),
      resolveContextualOrientacao("ios-fora-da-tela-inicio")
    )
  })

  it("o destino da orientação é a Conta da própria persona", () => {
    assert.equal(contaHrefDaPersona("tutor"), "/tutor/conta")
    assert.equal(contaHrefDaPersona("professional"), "/professional/conta")
  })
})
