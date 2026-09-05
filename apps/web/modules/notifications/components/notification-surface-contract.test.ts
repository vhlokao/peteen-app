/**
 * GATE-10-NOTIFICATIONS-UX-001 — contrato das duas superfícies de notificações.
 *
 * O projeto não tem jsdom: componente não é renderizável em teste. O que dá
 * para travar — e é o que quebrou de verdade neste gate — é a COMPOSIÇÃO: quem
 * decide o quê, quem repete quem, e qual bloco tem permissão de aparecer em
 * qual tela. Mesmo padrão de `care-moment-viewer-contract`.
 *
 * Asserções são sobre marcadores estruturais (nome de prop, nome de função
 * importada), nunca sobre classes de estilo — o visual deve poder mudar sem
 * quebrar teste.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..", "..")

/**
 * Remove comentários antes de inspecionar — mesma lição de
 * `contextual-push-invite.test.ts` e do contrato do visualizador de Momentos:
 * um teste que quebra porque alguém DOCUMENTOU a regra ("este arquivo não pode
 * chamar `Notification.requestPermission()`") é um teste ruim. Aqui isso é
 * literal: metade dos comentários deste gate cita exatamente as strings
 * proibidas para explicar por que elas não devem existir no código.
 */
function codigoSemComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

function ler(caminho: string): string {
  return codigoSemComentarios(readFileSync(join(RAIZ, caminho), "utf8"))
}

const OPT_IN = ler("modules/notifications/components/push-opt-in.tsx")
const SECAO = ler("modules/notifications/components/push-opt-in-section.tsx")
const CONTA = ler("components/account/account-settings-page.tsx")
const VIEW = ler("modules/notifications/components/notification-settings-view.tsx")
const CONTEXTUAL = ler("modules/notifications/components/contextual-push-activation.tsx")
const CONTA_TUTOR = ler("app/(tutor)/tutor/conta/page.tsx")
const CONTA_PROFISSIONAL = ler("app/(professional)/professional/conta/page.tsx")

// ─────────────────────────────────────────────────────────────────────────────
// PARTE A — a superfície de Conta
// ─────────────────────────────────────────────────────────────────────────────

describe("Conta — existe um lugar claro para entender o estado", () => {
  it("a seção de Conta pede a apresentação de settings", () => {
    assert.match(SECAO, /apresentacao="settings"/)
  })

  it("a apresentação de settings é opt-in — o default continua sendo inline", () => {
    assert.match(OPT_IN, /apresentacao = "inline"/)
  })

  it("o convite da Request NÃO herda a superfície de settings", () => {
    assert.ok(
      !CONTEXTUAL.includes('apresentacao="settings"'),
      "o bloco de passos da Conta competiria com o CTA da Request"
    )
  })

  it("o estado vem do domínio, não de um segundo switch no componente", () => {
    for (const marcador of [
      "resolveRotuloDeEstado",
      "deveListarBeneficios",
      "podeAtivarAgora",
      "resolveOrientacaoDeDesbloqueio",
      "beneficiosDeNotificacao",
    ]) {
      assert.ok(VIEW.includes(marcador), `a superfície de Conta não usa ${marcador}`)
    }
  })

  it("a superfície de Conta é pura — é o que a torna inspecionável estado a estado", () => {
    // Sem hooks, ela pode ser montada com um `SaudePush` injetado. Foi assim
    // que "bloqueado" e "sem suporte" foram vistos sem queimar um navegador.
    assert.ok(!VIEW.includes("useState"), "a view ganhou estado próprio")
    assert.ok(!VIEW.includes("useEffect"), "a view ganhou efeito próprio")
    assert.ok(!VIEW.includes("avaliarSaude"), "a view passou a decidir saúde")
  })

  it("continua havendo UMA só avaliação de saúde — a canônica", () => {
    assert.ok(OPT_IN.includes("avaliarSaudePushNesteDispositivo"))
    // O componente não pode reintroduzir a avaliação só-do-browser como
    // segunda opinião sobre "está ativo?".
    assert.ok(
      !OPT_IN.includes("avaliarAmbientePush"),
      "duas fontes de verdade sobre o mesmo fato"
    )
  })
})

describe("Conta — a duplicação de cabeçalhos foi removida", () => {
  it("a linha de Conta não repete título nem descrição de notificações", () => {
    assert.ok(
      !CONTA.includes('title="Notificações push"'),
      "a linha voltou a repetir o que o controle já diz com o estado real"
    )
    assert.ok(!CONTA.includes("Avisos sobre seus atendimentos neste aparelho"))
  })

  it("a ponte servidor→cliente não desenha mais um segundo cabeçalho", () => {
    assert.ok(!SECAO.includes("Notificações no dispositivo"))
    assert.ok(
      !SECAO.includes("Receba um aviso quando houver novidade"),
      "a frase de valor genérica voltou a duplicar a copy do estado"
    )
  })

  it("o grupo de Notificações continua existindo em Conta", () => {
    assert.match(CONTA, /SettingsGroup title="Notificações"/)
  })

  it("a linha continua estática — nunca um link com botão dentro", () => {
    assert.match(CONTA, /<SettingsStaticRow icon=\{Bell\}>/)
    assert.ok(
      !/<SettingsLinkRow[^>]*Bell/.test(CONTA),
      "alvo de toque aninhado: linha-link hospedando um botão"
    )
  })
})

describe("Conta — a lista do que chega é por persona", () => {
  it("as duas páginas de Conta declaram a própria persona", () => {
    assert.match(CONTA_TUTOR, /persona="tutor"/)
    assert.match(CONTA_PROFISSIONAL, /persona="professional"/)
  })

  it("a persona atravessa Conta → seção → controle", () => {
    assert.match(CONTA, /<PushOptInSection persona=\{persona\} \/>/)
    assert.match(SECAO, /persona=\{persona\}/)
    assert.match(VIEW, /beneficiosDeNotificacao\(persona\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PARTE B — o convite na Request
// ─────────────────────────────────────────────────────────────────────────────

describe("Request — o convite só aparece quando é útil", () => {
  it("quem decide é o domínio, não uma lista de ifs no componente", () => {
    assert.ok(CONTEXTUAL.includes("resolveContextualInviteMode"))
  })

  it("o portão antigo, que deixava `negado` cair no convite, não voltou", () => {
    assert.ok(
      !/ambiente === "sem-suporte" \|\| ambiente === "nao-configurado"/.test(CONTEXTUAL),
      "o portão hardcoded voltou — foi ele que deixou `negado` herdar o convite"
    )
  })

  it("bloqueado recebe orientação, não um CTA falso", () => {
    assert.ok(CONTEXTUAL.includes("resolveContextualOrientacao"))
    assert.match(CONTEXTUAL, /modo === "orientar"/)
  })

  it("o modo `orientar` aponta para a Conta da própria persona", () => {
    assert.ok(CONTEXTUAL.includes("contaHrefDaPersona(persona)"))
  })

  it("a Request não repete o passo a passo da Conta", () => {
    assert.ok(
      !CONTEXTUAL.includes("resolveOrientacaoDeDesbloqueio"),
      "três passos dentro da Request competiriam com o CTA principal"
    )
  })

  it("ativou aqui dentro → o card sai de cena", () => {
    assert.ok(CONTEXTUAL.includes("aoFicarAtivo={marcarAtivo}"))
    assert.match(CONTEXTUAL, /if \(ficouAtivo\) return null/)
  })

  it("o callback de ativo existe no controle e é chamado por ref", () => {
    assert.ok(OPT_IN.includes("aoFicarAtivoRef.current?.()"))
    assert.ok(
      !/\[vapidPublicKey, aoFicarAtivo\]/.test(OPT_IN),
      "depender da identidade da closure reavaliaria push em loop"
    )
  })
})

describe("Request — nada disso mexeu no motor de push", () => {
  it("o convite continua só OBSERVANDO o ambiente", () => {
    assert.ok(CONTEXTUAL.includes("avaliarAmbientePush"))
    assert.ok(!CONTEXTUAL.includes("requestPermission"))
    assert.ok(!CONTEXTUAL.includes("subscribeToPushAction"))
    assert.ok(!CONTEXTUAL.includes("unsubscribeFromPushAction"))
  })

  it("nenhuma superfície nova reimplementa infraestrutura de push", () => {
    for (const [nome, fonte] of [
      ["convite contextual", CONTEXTUAL],
      ["seção de Conta", SECAO],
      ["página de Conta", CONTA],
    ] as const) {
      for (const proibido of ["applicationServerKey", "urlBase64", "PushManager", "pushManager"]) {
        assert.ok(!fonte.includes(proibido), `${nome} duplicou ${proibido}`)
      }
    }
  })

  it("a ativação continua tendo UMA porta só", () => {
    for (const [nome, fonte] of [
      ["convite contextual", CONTEXTUAL],
      ["seção de Conta", SECAO],
      ["página de Conta", CONTA],
    ] as const) {
      assert.ok(
        !fonte.includes("Notification.requestPermission"),
        `${nome} abriu uma segunda porta para a permissão`
      )
    }
    assert.ok(OPT_IN.includes("Notification.requestPermission"))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Estados sem ação impossível
// ─────────────────────────────────────────────────────────────────────────────

describe("nenhum botão que não pode funcionar", () => {
  it("na Conta, o CTA de ativação é gated por podeAtivarAgora", () => {
    // O bloco do botão precisa estar dentro da condicional do domínio.
    assert.match(VIEW, /ativacaoPossivel \? \(/)
    assert.match(VIEW, /const ativacaoPossivel = podeAtivarAgora\(saude\)/)
  })

  it("a lista de benefícios é gated por deveListarBeneficios", () => {
    assert.match(VIEW, /deveListarBeneficios\(saude\) \? \(/)
  })

  it("o botão de desativar só existe no estado ACTIVE", () => {
    assert.match(VIEW, /saude.state === "ACTIVE" \? \(\s*<Button[\s\S]{0,200}Desativar neste aparelho/)
  })
})
