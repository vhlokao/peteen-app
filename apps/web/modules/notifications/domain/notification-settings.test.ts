/**
 * GATE-10-NOTIFICATIONS-UX-001 — superfície de notificações.
 *
 * Cobre a matriz de estados exigida pela missão (default/granted/denied/
 * unsupported + os dois que o produto realmente distingue: NEEDS_REPAIR e
 * ACTIVE), a orientação por plataforma, e as duas travas de honestidade:
 * nenhuma ação impossível, nenhuma promessa de aviso onde não há entrega.
 *
 * Rodar: npm run test:push
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  beneficiosDeNotificacao,
  detectarPlataforma,
  deveListarBeneficios,
  podeAtivarAgora,
  resolveOrientacaoDeDesbloqueio,
  resolveRotuloDeEstado,
  TITULO_DOS_BENEFICIOS,
  textoPrometeAviso,
  type PlataformaNotificacao,
} from "./notification-settings.ts"
import {
  avaliarSaudePush,
  resolvePushHealthCopy,
  type ObservacaoBrowser,
  type SaudePush,
} from "./push-health.ts"

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — os estados vêm de `avaliarSaudePush`, nunca escritos à mão.
//
// Construir um `SaudePush` literal no teste faria a matriz passar mesmo se o
// avaliador parasse de produzir aquela combinação. Aqui cada estado é o que o
// domínio realmente devolve para uma observação plausível de browser.
// ─────────────────────────────────────────────────────────────────────────────

function browser(over: Partial<ObservacaoBrowser> = {}): ObservacaoBrowser {
  return {
    suportado: true,
    iosForaDaTelaInicio: false,
    configurado: true,
    permissao: "default",
    temSubscriptionLocal: false,
    optOutLocal: false,
    ...over,
  }
}

const ATIVO = avaliarSaudePush(
  browser({ permissao: "granted", temSubscriptionLocal: true }),
  { consultado: true, ativaNesteDispositivo: true }
)
const PRECISA_REPARO = avaliarSaudePush(
  browser({ permissao: "granted", temSubscriptionLocal: true }),
  { consultado: true, ativaNesteDispositivo: false }
)
const NUNCA_PEDIU = avaliarSaudePush(browser({ permissao: "default" }), { consultado: false })
const NEGADO = avaliarSaudePush(browser({ permissao: "denied" }), { consultado: false })
const SEM_SUPORTE = avaliarSaudePush(browser({ suportado: false }), { consultado: false })
const IOS_FORA = avaliarSaudePush(
  browser({ suportado: false, iosForaDaTelaInicio: true }),
  { consultado: false }
)
const SEM_VAPID = avaliarSaudePush(browser({ configurado: false }), { consultado: false })

const TODOS: ReadonlyArray<readonly [string, SaudePush]> = [
  ["ativo", ATIVO],
  ["precisa reparo", PRECISA_REPARO],
  ["nunca pediu", NUNCA_PEDIU],
  ["negado", NEGADO],
  ["sem suporte", SEM_SUPORTE],
  ["ios fora da tela de início", IOS_FORA],
  ["sem vapid", SEM_VAPID],
]

const PLATAFORMAS: readonly PlataformaNotificacao[] = ["ios", "android", "desktop"]

// ─────────────────────────────────────────────────────────────────────────────
// As fixtures descrevem os estados que a missão pede
// ─────────────────────────────────────────────────────────────────────────────

describe("matriz de estados — as fixtures são o que a missão chama de default/granted/denied/unsupported", () => {
  it("granted + servidor concorda → ACTIVE", () => {
    assert.equal(ATIVO.state, "ACTIVE")
  })

  it("granted + servidor discorda → NEEDS_REPAIR", () => {
    assert.equal(PRECISA_REPARO.state, "NEEDS_REPAIR")
  })

  it("default (nunca perguntamos) → DISABLED", () => {
    assert.equal(NUNCA_PEDIU.state, "DISABLED")
  })

  it("denied → DENIED", () => {
    assert.equal(NEGADO.state, "DENIED")
  })

  it("três UNSUPPORTED distintos, com razões distintas", () => {
    assert.equal(SEM_SUPORTE.state, "UNSUPPORTED")
    assert.equal(IOS_FORA.state, "UNSUPPORTED")
    assert.equal(SEM_VAPID.state, "UNSUPPORTED")
    const razoes = new Set([SEM_SUPORTE.reason, IOS_FORA.reason, SEM_VAPID.reason])
    assert.equal(razoes.size, 3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Rótulo de estado
// ─────────────────────────────────────────────────────────────────────────────

describe("rótulo — a resposta curta para “está ligado?”", () => {
  it("cada estado tem um rótulo próprio", () => {
    assert.equal(resolveRotuloDeEstado(ATIVO).texto, "Ativadas")
    assert.equal(resolveRotuloDeEstado(PRECISA_REPARO).texto, "Restabelecendo")
    assert.equal(resolveRotuloDeEstado(NUNCA_PEDIU).texto, "Desativadas")
    assert.equal(resolveRotuloDeEstado(NEGADO).texto, "Bloqueadas")
    assert.equal(resolveRotuloDeEstado(SEM_SUPORTE).texto, "Indisponíveis")
  })

  it("só ACTIVE usa o tom de “está funcionando”", () => {
    for (const [nome, saude] of TODOS) {
      const tom = resolveRotuloDeEstado(saude).tom
      assert.equal(
        tom === "ativo",
        saude.state === "ACTIVE",
        `${nome} não pode usar o tom "ativo"`
      )
    }
  })

  it("nenhum rótulo é vazio", () => {
    for (const [nome, saude] of TODOS) {
      assert.ok(resolveRotuloDeEstado(saude).texto.length > 0, nome)
    }
  })

  it("bloqueado e indisponível não se confundem", () => {
    assert.notEqual(
      resolveRotuloDeEstado(NEGADO).texto,
      resolveRotuloDeEstado(SEM_SUPORTE).texto
    )
    assert.notEqual(
      resolveRotuloDeEstado(NEGADO).tom,
      resolveRotuloDeEstado(SEM_SUPORTE).tom
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ação — critério "unsupported não oferece ação impossível"
// ─────────────────────────────────────────────────────────────────────────────

describe("ação de ativação — só onde ela pode funcionar", () => {
  it("oferecida em DISABLED e NEEDS_REPAIR", () => {
    assert.equal(podeAtivarAgora(NUNCA_PEDIU), true)
    assert.equal(podeAtivarAgora(PRECISA_REPARO), true)
  })

  it("NUNCA oferecida em DENIED — o browser recusaria na hora", () => {
    assert.equal(podeAtivarAgora(NEGADO), false)
  })

  it("NUNCA oferecida em nenhum UNSUPPORTED", () => {
    for (const saude of [SEM_SUPORTE, IOS_FORA, SEM_VAPID]) {
      assert.equal(podeAtivarAgora(saude), false)
    }
  })

  it("não oferecida em ACTIVE — não há o que ativar", () => {
    assert.equal(podeAtivarAgora(ATIVO), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Benefícios — o que é enviado de verdade, por persona
// ─────────────────────────────────────────────────────────────────────────────

describe("benefícios — só o que o dispatcher realmente envia", () => {
  it("tutor recebe aceite, início, Diário e conclusão", () => {
    const lista = beneficiosDeNotificacao("tutor").join(" | ")
    assert.match(lista, /aceitar/i)
    assert.match(lista, /começar/i)
    assert.match(lista, /Diário/i)
    assert.match(lista, /concluído/i)
  })

  it("profissional recebe solicitação nova e cancelamento — e NADA sobre Diário", () => {
    const lista = beneficiosDeNotificacao("professional").join(" | ")
    assert.match(lista, /nova solicitação/i)
    assert.match(lista, /cancelar/i)
    assert.doesNotMatch(lista, /Diário/i)
    assert.doesNotMatch(lista, /começar|iniciad/i)
    assert.doesNotMatch(lista, /concluíd/i)
  })

  it("as duas listas são diferentes — a tela não é genérica", () => {
    assert.notDeepEqual(
      [...beneficiosDeNotificacao("tutor")],
      [...beneficiosDeNotificacao("professional")]
    )
  })

  it("nenhuma lista é vazia", () => {
    assert.ok(beneficiosDeNotificacao("tutor").length > 0)
    assert.ok(beneficiosDeNotificacao("professional").length > 0)
  })
})

describe("promessa de aviso — proibida onde não há entrega", () => {
  it("listada em ACTIVE, DISABLED e NEEDS_REPAIR", () => {
    assert.equal(deveListarBeneficios(ATIVO), true)
    assert.equal(deveListarBeneficios(NUNCA_PEDIU), true)
    assert.equal(deveListarBeneficios(PRECISA_REPARO), true)
  })

  it("NUNCA listada em DENIED", () => {
    assert.equal(deveListarBeneficios(NEGADO), false)
  })

  it("NUNCA listada em nenhum UNSUPPORTED", () => {
    for (const saude of [SEM_SUPORTE, IOS_FORA, SEM_VAPID]) {
      assert.equal(deveListarBeneficios(saude), false)
    }
  })

  it("o título dos benefícios é, ele próprio, uma promessa de aviso", () => {
    // Se isto deixar de ser verdade, a trava acima passa a proteger nada.
    assert.equal(textoPrometeAviso(TITULO_DOS_BENEFICIOS), true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Plataforma
// ─────────────────────────────────────────────────────────────────────────────

describe("detecção de plataforma — pura, a partir do que o browser relatou", () => {
  it("iPhone e iPad", () => {
    assert.equal(detectarPlataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", 5), "ios")
    assert.equal(detectarPlataforma("Mozilla/5.0 (iPad; CPU OS 17_0)", 5), "ios")
  })

  it("iPadOS 13+ se anuncia como Macintosh — desempatado pelos pontos de toque", () => {
    assert.equal(detectarPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5), "ios")
    assert.equal(detectarPlataforma("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 0), "desktop")
  })

  it("Android", () => {
    assert.equal(detectarPlataforma("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5), "android")
  })

  it("desktop é o fallback", () => {
    assert.equal(detectarPlataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0), "desktop")
    assert.equal(detectarPlataforma("", 0), "desktop")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Orientação de desbloqueio
// ─────────────────────────────────────────────────────────────────────────────

describe("orientação — o caminho concreto, quando ele existe", () => {
  it("DENIED sempre tem passos, em qualquer plataforma", () => {
    for (const p of PLATAFORMAS) {
      const o = resolveOrientacaoDeDesbloqueio(NEGADO, p)
      assert.ok(o, `sem orientação em ${p}`)
      assert.ok(o!.passos.length >= 2, `passos insuficientes em ${p}`)
    }
  })

  it("iPhone bloqueado manda para os Ajustes do SISTEMA, não do navegador", () => {
    const o = resolveOrientacaoDeDesbloqueio(NEGADO, "ios")
    assert.match(o!.passos.join(" "), /Ajustes/i)
  })

  it("Android e desktop mandam para o ícone do endereço do site", () => {
    for (const p of ["android", "desktop"] as const) {
      const o = resolveOrientacaoDeDesbloqueio(NEGADO, p)
      assert.match(o!.passos.join(" "), /endereço do site/i)
    }
  })

  it("as três plataformas dão passos DIFERENTES — não é um texto genérico", () => {
    const textos = PLATAFORMAS.map((p) =>
      resolveOrientacaoDeDesbloqueio(NEGADO, p)!.passos.join("|")
    )
    assert.equal(new Set(textos).size, 3)
  })

  it("iOS fora da Tela de Início ensina a instalar — é o único UNSUPPORTED com saída", () => {
    const o = resolveOrientacaoDeDesbloqueio(IOS_FORA, "ios")
    assert.ok(o)
    assert.match(o!.passos.join(" "), /Tela de Início/i)
  })

  it("navegador sem suporte e ambiente sem VAPID NÃO recebem passos inventados", () => {
    for (const p of PLATAFORMAS) {
      assert.equal(resolveOrientacaoDeDesbloqueio(SEM_SUPORTE, p), null)
      assert.equal(resolveOrientacaoDeDesbloqueio(SEM_VAPID, p), null)
    }
  })

  it("estados saudáveis ou acionáveis não têm nada a desbloquear", () => {
    for (const saude of [ATIVO, NUNCA_PEDIU, PRECISA_REPARO]) {
      for (const p of PLATAFORMAS) {
        assert.equal(resolveOrientacaoDeDesbloqueio(saude, p), null)
      }
    }
  })

  it("NENHUMA orientação promete aviso — orientar não é prometer", () => {
    for (const [nome, saude] of TODOS) {
      for (const p of PLATAFORMAS) {
        const o = resolveOrientacaoDeDesbloqueio(saude, p)
        if (!o) continue
        const texto = [o.titulo, ...o.passos, o.nota ?? ""].join(" ")
        assert.equal(textoPrometeAviso(texto), false, `${nome}/${p} promete aviso`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Coerência com a copy que já existia
// ─────────────────────────────────────────────────────────────────────────────

describe("coerência com push-health — uma só fonte de verdade", () => {
  it("todo estado sem ação possível ou tem orientação, ou tem uma explicação", () => {
    // Nenhum estado pode ser um beco sem saída E sem explicação: ou existe um
    // caminho a seguir, ou existe um texto dizendo por que não existe.
    for (const [nome, saude] of TODOS) {
      if (podeAtivarAgora(saude) || saude.state === "ACTIVE") continue
      const temOrientacao = PLATAFORMAS.some(
        (p) => resolveOrientacaoDeDesbloqueio(saude, p) !== null
      )
      const copy = resolvePushHealthCopy(saude)
      assert.ok(
        temOrientacao || copy.titulo.length > 0,
        `${nome} ficaria sem saída e sem explicação`
      )
    }
  })

  it("o rótulo nunca contradiz a copy do estado", () => {
    for (const [nome, saude] of TODOS) {
      const rotulo = resolveRotuloDeEstado(saude)
      if (saude.state === "ACTIVE") continue
      assert.notEqual(rotulo.texto, "Ativadas", `${nome} afirma estar ativo`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Linguagem — critério "não usar linguagem técnica de navegador"
// ─────────────────────────────────────────────────────────────────────────────

describe("copy — nenhum termo técnico chega ao usuário", () => {
  const PROIBIDOS = [
    "VAPID",
    "subscription",
    "permission",
    "service worker",
    "endpoint",
    "payload",
    "token",
    "API",
    "push manager",
    "notificações push",
    "undefined",
    "null",
  ]

  /** Tudo que este módulo e o push-health podem colocar na tela. */
  function textosVisiveis(): string[] {
    const saida: string[] = []
    for (const [, saude] of TODOS) {
      const copy = resolvePushHealthCopy(saude)
      saida.push(copy.titulo, copy.detalhe ?? "")
      saida.push(resolveRotuloDeEstado(saude).texto)
      for (const p of PLATAFORMAS) {
        const o = resolveOrientacaoDeDesbloqueio(saude, p)
        if (o) saida.push(o.titulo, ...o.passos, o.nota ?? "")
      }
    }
    saida.push(TITULO_DOS_BENEFICIOS)
    saida.push(...beneficiosDeNotificacao("tutor"))
    saida.push(...beneficiosDeNotificacao("professional"))
    return saida
  }

  it("nenhum texto visível contém jargão de navegador", () => {
    for (const texto of textosVisiveis()) {
      const alvo = texto.toLowerCase()
      for (const termo of PROIBIDOS) {
        assert.ok(!alvo.includes(termo.toLowerCase()), `"${texto}" contém "${termo}"`)
      }
    }
  })

  it("nenhum texto visível está vazio por acidente", () => {
    for (const texto of textosVisiveis()) {
      if (texto === "") continue
      assert.ok(texto.trim().length > 3, `texto suspeito: "${texto}"`)
    }
  })
})
