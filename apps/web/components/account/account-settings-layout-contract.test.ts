/**
 * GATE-11-ACCOUNT-SETTINGS-MOBILE-UX-001 — contrato de layout/navegação de Conta.
 *
 * Sem jsdom, o que dá para travar é a COMPOSIÇÃO e as decisões de viewport que
 * este gate tomou: quem reserva o espaço da tabbar, quem respeita a safe-area,
 * qual unidade de altura é usada, e por onde a volta é resolvida.
 *
 * As medições visuais (44px de alvo, 31px de folga acima da tabbar, ausência de
 * overflow) foram feitas no navegador e estão no RESULT — aqui ficam só as
 * invariantes que um teste consegue defender no tempo.
 *
 * Rodar: npm run test:routing
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..")

/**
 * Comentários fora antes de inspecionar — este gate documenta as unidades e as
 * armadilhas que evita (`100vh`, `router.back()`), e um teste que quebra porque
 * alguém explicou bem a regra é um teste ruim. Mesma lição dos gates 9 e 10.
 */
function codigoSemComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const ler = (rel: string) => codigoSemComentarios(readFileSync(join(RAIZ, rel), "utf8"))

const SHELL = ler("components/layout/app-shell.tsx")
const TOPBAR = ler("components/layout/top-bar.tsx")
const BOTTOMNAV = ler("components/layout/bottom-nav.tsx")
const MENU = ler("components/layout/account-menu-content.tsx")
const HEADER = ler("components/layout/page-header.tsx")
const CONTA = ler("components/account/account-settings-page.tsx")
const PAGINA_TUTOR = ler("app/(tutor)/tutor/conta/page.tsx")
const PAGINA_PROF = ler("app/(professional)/professional/conta/page.tsx")
const SKEL_TUTOR = ler("app/(tutor)/tutor/conta/loading.tsx")
const SKEL_PROF = ler("app/(professional)/professional/conta/loading.tsx")
const TOKENS = readFileSync(join(RAIZ, "styles/tokens.css"), "utf8")
const GLOBALS = readFileSync(join(RAIZ, "app/globals.css"), "utf8")
const ROOT_LAYOUT = ler("app/layout.tsx")

// ─────────────────────────────────────────────────────────────────────────────
// Viewport — a tela é cheia e a altura é a dinâmica
// ─────────────────────────────────────────────────────────────────────────────

describe("viewport — nada de 100vh rígido", () => {
  it("a casca usa altura dinâmica, não `min-h-screen`", () => {
    assert.match(SHELL, /min-h-dvh/)
    assert.ok(
      !SHELL.includes("min-h-screen") && !SHELL.includes("h-screen"),
      "`100vh` no iOS conta a barra do Safari que pode estar visível — a tela fica maior que o visível"
    )
  })

  it("nenhum componente de casca ou de Conta usa unidade `vh`", () => {
    // `dvh`/`svh` são aceitos; `vh` puro não. O popup do menu de conta usava
    // `max-h-[70vh]` e podia passar por baixo da barra do Safari.
    const alvos: ReadonlyArray<readonly [string, string]> = [
      ["app-shell", SHELL],
      ["top-bar", TOPBAR],
      ["bottom-nav", BOTTOMNAV],
      ["account-menu-content", MENU],
      ["page-header", HEADER],
      ["account-settings-page", CONTA],
    ]
    for (const [nome, fonte] of alvos) {
      const vhCru = fonte.match(/\d+vh\b/g) ?? []
      assert.deepEqual(vhCru, [], `${nome} ainda usa vh puro: ${vhCru.join(", ")}`)
    }
  })

  it("o menu de conta limita a altura pela viewport dinâmica", () => {
    assert.match(MENU, /max-h-\[70dvh\]/)
  })

  it("o documento declara viewport-fit=cover — sem isso env(safe-area-inset-*) é sempre 0", () => {
    assert.match(ROOT_LAYOUT, /viewportFit:\s*"cover"/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Safe-area e tabbar
// ─────────────────────────────────────────────────────────────────────────────

describe("safe-area — topo e base", () => {
  it("as utilidades vêm de env(), com fallback 0px", () => {
    assert.match(GLOBALS, /\.safe-bottom\s*\{[^}]*env\(safe-area-inset-bottom,\s*0px\)/)
    assert.match(GLOBALS, /\.safe-top\s*\{[^}]*env\(safe-area-inset-top,\s*0px\)/)
  })

  it("o header respeita o topo e a tabbar respeita a base", () => {
    assert.match(TOPBAR, /safe-top/)
    assert.match(BOTTOMNAV, /safe-bottom/)
  })

  it("o espaço reservado para a tabbar inclui a safe-area — uma fonte só", () => {
    assert.match(
      TOKENS,
      /--bottom-nav-total-height:\s*calc\(var\(--bottom-nav-height\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/
    )
  })

  it("a casca reserva esse espaço no mobile e o devolve no desktop", () => {
    assert.match(SHELL, /pb-\[calc\(var\(--bottom-nav-total-height\)\+1rem\)\]/)
    assert.match(SHELL, /lg:pb-0/)
    assert.ok(
      !SHELL.includes("--bottom-nav-height)+"),
      "reconstruir a altura sem a safe-area faria a tabbar cobrir a última ação no iPhone"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A volta
// ─────────────────────────────────────────────────────────────────────────────

describe("Conta tem uma volta, e ela é resolvida no servidor", () => {
  it("as duas páginas leem returnTo e resolvem com a PRÓPRIA persona", () => {
    assert.match(PAGINA_TUTOR, /resolveAccountBackHref\("tutor",\s*returnTo\)/)
    assert.match(PAGINA_PROF, /resolveAccountBackHref\("professional",\s*returnTo\)/)
  })

  it("`backHref` é obrigatório — a tela não pode ficar sem saída por esquecimento", () => {
    assert.match(CONTA, /backHref: string/)
    assert.ok(!/backHref\?:/.test(CONTA), "backHref opcional deixaria a volta sumir em silêncio")
  })

  it("o cabeçalho recebe a volta", () => {
    assert.match(CONTA, /backHref=\{backHref\}/)
    assert.match(HEADER, /aria-label=\{backLabel\}/)
  })

  it("a volta é um Link de verdade — nunca router.back()", () => {
    // Entrada fria (atalho da Tela de Início, link direto, pós-login) não tem
    // histórico: `back()` tiraria a pessoa do app.
    for (const [nome, fonte] of [
      ["page-header", HEADER],
      ["account-settings-page", CONTA],
      ["conta tutor", PAGINA_TUTOR],
      ["conta profissional", PAGINA_PROF],
    ] as const) {
      assert.ok(!fonte.includes(".back()"), `${nome} usa history/router back`)
    }
    assert.match(HEADER, /<Link\s*\n?\s*href=\{backHref\}/)
  })

  it("o menu carimba a origem e compara o estado ativo com a rota nua", () => {
    assert.match(MENU, /buildAccountHrefComRetorno\(accountPersona,\s*pathname\)/)
    assert.match(MENU, /href:\s*accountHref\(accountPersona\)/)
  })

  it("o alvo de toque da volta é maior que o círculo visual", () => {
    // 36px é o círculo das outras telas empurradas; 44px é o mínimo do design
    // system, e esta é a única saída de uma tela cheia no mobile.
    assert.match(HEADER, /size-11/)
    assert.match(HEADER, /size-9/)
    assert.match(TOKENS, /--touch-target-min:\s*2\.75rem/)
  })

  it("a volta é opt-in — telas que são destino de aba não ganham um botão sem sentido", () => {
    assert.match(HEADER, /backHref\?: string/)
    assert.match(HEADER, /backHref \?/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Esqueleto e ordem da tela
// ─────────────────────────────────────────────────────────────────────────────

describe("a tela não salta nem esconde a ação destrutiva", () => {
  it("os dois esqueletos reservam o círculo da volta", () => {
    for (const [nome, fonte] of [
      ["tutor", SKEL_TUTOR],
      ["profissional", SKEL_PROF],
    ] as const) {
      assert.match(fonte, /size-9 shrink-0 rounded-full/, `esqueleto ${nome} sem o círculo`)
    }
  })

  it("os esqueletos desenham os três grupos que a tela realmente tem", () => {
    for (const fonte of [SKEL_TUTOR, SKEL_PROF]) {
      assert.match(fonte, /\[0, 1, 2\]\.map/)
    }
  })

  it("Sair continua sendo o último bloco, separado do resto", () => {
    // `<AccountSignOutButton`, não o nome solto: o nome aparece antes, no
    // import no topo do arquivo, e a comparação daria sempre errada.
    const posSair = CONTA.indexOf("<AccountSignOutButton")
    const posLegal = CONTA.indexOf('SettingsGroup title="Legal"')
    const posNotif = CONTA.indexOf('SettingsGroup title="Notificações"')
    assert.ok(posNotif > 0 && posLegal > posNotif, "ordem das seções mudou")
    assert.ok(posSair > posLegal, "a ação destrutiva subiu para o meio da tela")
  })

  it("a seção de Notificações do Gate 10 continua intacta", () => {
    assert.match(CONTA, /<PushOptInSection persona=\{persona\} \/>/)
    assert.match(CONTA, /SettingsGroup title="Notificações"/)
  })

  it("Conta continua em coluna única com largura natural", () => {
    assert.match(CONTA, /page-container max-w-2xl/)
  })
})
