/**
 * Contrato de interação do visualizador de Momentos
 * (GATE-9-CARE-TIMELINE-UX-REFINE-003).
 *
 * Runner: node:test nativo.
 * Rodar: node --experimental-strip-types --test modules/care-timeline/components/care-moment-viewer-contract.test.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE TESTE DE FONTE
 *
 * O que este arquivo protege não é lógica pura (essa vive em
 * `domain/care-moments.ts` e já tem teste próprio) — é a ORDEM DE
 * EMPILHAMENTO e o roteamento de eventos de ponteiro entre a navegação por
 * toque e os controles de mídia. Isso só existe como CSS num componente
 * React, e o projeto não tem jsdom; o padrão desta base para esse caso é ler
 * o fonte e travar o contrato (ver auth-callback-url.test.ts e
 * partners/application/actions.test.ts).
 *
 * As três asserções centrais correspondem a BUGS REAIS encontrados no QA
 * físico deste gate:
 *   1. a foto estava no mesmo `z` das zonas e engolia o toque lateral;
 *   2. o wrapper do vídeo, sendo largura total, bloqueava a lateral inteira;
 *   3. sem `z` acima, as zonas interceptariam o play — o que a missão proíbe.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const VIEWER = readFileSync(join(AQUI, "CareMomentViewer.tsx"), "utf8")
const PLAYER = readFileSync(join(AQUI, "CareVideoPlayer.tsx"), "utf8")

describe("zonas de toque laterais existem como controles acessíveis", () => {
  it("são <button> com aria-label, não <div> com onClick", () => {
    // Um <div> clicável não é anunciado nem alcançável por teclado — a missão
    // exige "elementos reais acessíveis, com aria-label adequado".
    assert.match(VIEWER, /aria-label="Momento anterior"/)
    assert.match(VIEWER, /aria-label="Próximo momento"/)
  })

  it("cobrem as laterais da área principal, ancoradas nas bordas", () => {
    assert.match(VIEWER, /absolute inset-y-0 left-0 z-10 w-\[32%\]/)
    assert.match(VIEWER, /absolute inset-y-0 right-0 z-10 w-\[32%\]/)
  })

  it("respeitam os limites: desabilitam no primeiro e no último momento", () => {
    assert.match(VIEWER, /disabled=\{anterior === null\}/)
    assert.match(VIEWER, /disabled=\{proximo === null\}/)
    // Desabilitado precisa parar de capturar o ponteiro, senão o lado fica
    // "morto" em cima da mídia em vez de deixar o toque passar.
    assert.match(VIEWER, /disabled:pointer-events-none/)
  })

  it("reutilizam as funções de limite já testadas no domínio — sem regra nova", () => {
    assert.match(VIEWER, /previousMomentIndex\(openIndex, total\)/)
    assert.match(VIEWER, /nextMomentIndex\(openIndex, total\)/)
  })
})

describe("ordem de empilhamento: controles de mídia nunca são interceptados", () => {
  it("o wrapper do vídeo NÃO cria contexto de empilhamento — o botão de som precisa subir", () => {
    // REFINE-004: um `z-*` aqui prenderia o botão de som (z-30, dentro do
    // player) abaixo das zonas (z-10), e tocar no som trocaria de Momento.
    assert.match(VIEWER, /<div className="relative flex size-full items-center justify-center">/)
  })

  it("trocar de Momento desmonta o vídeo anterior (key por mídia)", () => {
    // Sem `key`, o React reaproveitaria o elemento trocando só o `src`: o
    // vídeo anterior poderia continuar tocando e o novo não reiniciaria mudo.
    assert.match(VIEWER, /key=\{video\.id\}/)
  })

  it("a foto fica ABAIXO das zonas (z-0) — o toque lateral não morre nela", () => {
    // Bug medido no QA: com a foto em z-10, igual às zonas, o lado esquerdo
    // parava de navegar.
    assert.match(VIEWER, /relative z-0 max-h-full max-w-full object-contain/)
  })

  it("o texto sem mídia deixa o vazio ao redor passar o toque, mas continua selecionável", () => {
    assert.match(VIEWER, /pointer-events-none relative z-20 flex max-h-full/)
    assert.match(VIEWER, /<p className="pointer-events-auto/)
  })
})

describe("rodapé deixou de ser o mecanismo de navegação", () => {
  it("não há mais botões de anterior/próximo fora das zonas laterais", () => {
    // Exatamente dois: as duas zonas. Se alguém reintroduzir os circulares do
    // rodapé, a contagem sobe e este teste falha.
    const anteriores = VIEWER.match(/aria-label="Momento anterior"/g) ?? []
    const proximos = VIEWER.match(/aria-label="Próximo momento"/g) ?? []
    assert.equal(anteriores.length, 1, "esperado só a zona lateral esquerda")
    assert.equal(proximos.length, 1, "esperado só a zona lateral direita")
  })

  it("mantém a orientação mínima: posição e ponte para o histórico", () => {
    assert.match(VIEWER, /momentPositionLabel\(openIndex, total\)/)
    assert.match(VIEWER, /Ver no histórico/)
  })
})

describe("vídeo: variante imersiva sem quebrar o contrato existente", () => {
  it("o visualizador pede a variante imersiva", () => {
    // Props conferidas separadamente: o JSX é multi-linha (carrega `key`
    // também), e travar a formatação exata quebraria a cada reindentação.
    assert.match(VIEWER, /<CareVideoPlayer/)
    assert.match(VIEWER, /variant="immersive"/)
  })

  it("a variante é OPT-IN: o default segue sendo o da timeline/profissional", () => {
    assert.match(PLAYER, /variant = "default"/)
    assert.match(PLAYER, /variant\?: VarianteVisual/)
  })

  it("a TIMELINE não monta <video> antes do gesto — nada de autoplay por viewport", () => {
    // O ramo "fechado" (só alcançado pela timeline) precisa retornar ANTES de
    // qualquer <video>: é isso que impede a lista de disparar vídeos ao rolar.
    const posFechado = PLAYER.indexOf('if (estado === "fechado")')
    // Ancora no ELEMENTO real (`key={tentativa}` só existe nele), e não na
    // primeira ocorrência de "<video" — o comentário do topo do arquivo cita
    // a tag em prosa e apareceria antes, fazendo o teste medir a coisa errada.
    const posVideo = PLAYER.search(/<video\s*\n\s*key=\{tentativa\}/)
    assert.ok(posFechado !== -1, "estado fechado não encontrado")
    assert.ok(posVideo !== -1, "elemento <video> não encontrado")
    assert.ok(posFechado < posVideo, "o estado fechado deve retornar antes do <video>")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GATE-9-...-REFINE-004 — reprodução mínima: autoplay mudo, só controle de som
// ─────────────────────────────────────────────────────────────────────────────

describe("controles nativos do navegador foram removidos", () => {
  it("o <video> NÃO recebe `controls`", () => {
    // Era daqui que vinham barra de tempo, volume, fullscreen, menu de três
    // pontos, download e velocidade — o player tradicional que o QA rejeitou.
    assert.doesNotMatch(PLAYER, /^\s*controls\s*$/m)
  })

  it("mantém atributos defensivos contra download/PiP e menu de contexto", () => {
    assert.match(PLAYER, /controlsList="nodownload noplaybackrate noremoteplayback"/)
    assert.match(PLAYER, /disablePictureInPicture/)
    assert.match(PLAYER, /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/)
  })
})

describe("autoplay é sempre mudo, e o som é sempre escolha explícita", () => {
  it("o <video> combina autoPlay + muted + playsInline", () => {
    assert.match(PLAYER, /autoPlay\s*\n\s*muted=\{semSom\}/)
    assert.match(PLAYER, /playsInline/)
  })

  it("o estado inicial do som é MUDO", () => {
    assert.match(PLAYER, /const \[semSom, setSemSom\] = useState\(true\)/)
  })

  it("`muted` também é imposto no elemento — o React não reflete essa prop de forma confiável", () => {
    assert.match(PLAYER, /videoRef\.current\.muted = semSom/)
  })

  it("no VIEWER o vídeo já nasce aberto: sem segundo toque em 'Reproduzir'", () => {
    assert.match(PLAYER, /variant === "immersive" \? "carregando" : "fechado"/)
  })
})

describe("único controle de mídia: som", () => {
  it("é um botão real, com rótulo que alterna e estado anunciado", () => {
    assert.match(PLAYER, /aria-label=\{semSom \? "Ativar som" : "Desativar som"\}/)
    assert.match(PLAYER, /aria-pressed=\{!semSom\}/)
  })

  it("fica ACIMA das zonas laterais (z-30 > z-10) e não dispara navegação", () => {
    assert.match(PLAYER, /z-30/)
    assert.match(PLAYER, /e\.stopPropagation\(\)/)
  })

  it("tem alvo de toque adequado (44px)", () => {
    assert.match(PLAYER, /size-11/)
  })

  it("não existe barra de progresso nem volume slider próprios", () => {
    // Marcadores de ELEMENTO, não a palavra "progresso" — que aparece
    // legitimamente nos comentários explicando o que foi removido.
    assert.doesNotMatch(PLAYER, /type="range"/)
    assert.doesNotMatch(PLAYER, /<progress/)
    assert.doesNotMatch(PLAYER, /role="progressbar"/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GATE-9-...-REFINE-005 — performance, harmonia da timeline e progresso real
// ─────────────────────────────────────────────────────────────────────────────

const MOMENTS = readFileSync(join(AQUI, "CareMoments.tsx"), "utf8")
const GALLERY = readFileSync(join(AQUI, "CareMediaGallery.tsx"), "utf8")
const TIMELINE = readFileSync(join(AQUI, "CareTimeline.tsx"), "utf8")

describe("performance: conexão aquecida cedo, sem baixar vídeo nenhum", () => {
  it("o preconnect acontece na FAIXA, não só dentro do player", () => {
    // Medido no Storage real: conexão fria 391 ms vs quente 97 ms. Dentro do
    // player a dica não tinha janela — o vídeo do viewer monta junto com a
    // request.
    assert.match(MOMENTS, /preconnect\(origemStorage\)/)
  })

  it("só emite a dica quando existe vídeo entre os momentos", () => {
    assert.match(MOMENTS, /const temVideo = momentos\.some\(/)
    assert.match(MOMENTS, /if \(origemStorage && temVideo\) preconnect\(origemStorage\)/)
  })

  it("NÃO pré-carrega arquivos de vídeo — preconnect não transfere bytes", () => {
    // Nenhum preload/prefetch de mídia, e o preload de vizinhos segue só foto.
    assert.doesNotMatch(MOMENTS, /preload\(/)
    assert.doesNotMatch(VIEWER, /new window\.Image\(\)[\s\S]{0,120}signedUrl/)
  })

  it("o viewer só antecipa FOTO dos vizinhos, nunca vídeo", () => {
    assert.match(VIEWER, /const foto = resolveCareMomentMedia\(vizinho\.update\)\.photos\[0\]/)
    assert.match(VIEWER, /neighborPreloadIndexes\(openIndex, total\)/)
  })
})

describe("timeline do Tutor: composição editorial, sem tocar no profissional", () => {
  it("a apresentação é opt-in e o default continua compacto", () => {
    assert.match(GALLERY, /apresentacao = "compact"/)
    assert.match(TIMELINE, /mediaPresentation = "compact"/)
  })

  it("a composição muda por QUANTIDADE de mídia", () => {
    assert.match(GALLERY, /if \(media\.length === 1\) return "aspect-\[4\/3\]"/)
    assert.match(GALLERY, /if \(media\.length === 2\) return "aspect-\[4\/5\]"/)
    assert.match(GALLERY, /indice === 0 \? "aspect-\[3\/2\]" : "aspect-square"/)
  })

  it("o vídeo da timeline acompanha a mesma linguagem quando em modo diário", () => {
    assert.match(GALLERY, /variant=\{apresentacao === "diary" \? "diary" : "default"\}/)
  })

  it("o modo diário é pedido APENAS pela página do Tutor", () => {
    const paginaTutor = readFileSync(
      join(AQUI, "..", "..", "..", "app", "(tutor)", "tutor", "requests", "[requestId]", "diario", "page.tsx"),
      "utf8"
    )
    assert.match(paginaTutor, /mediaPresentation="diary"/)

    const paginaProfissional = readFileSync(
      join(AQUI, "..", "..", "..", "app", "(professional)", "requests", "[id]", "diario", "page.tsx"),
      "utf8"
    )
    // A tela do profissional NÃO pode pedir a variante — é o que garante que
    // ela continua exatamente como era.
    assert.doesNotMatch(paginaProfissional, /mediaPresentation/)
  })
})

describe("progresso real nos segmentos", () => {
  it("os segmentos usam a regra do domínio, não uma cópia local", () => {
    assert.match(VIEWER, /segmentFill\(i, indice, fracao\)/)
  })

  it("o vídeo dirige o próprio progresso via currentTime/duration", () => {
    assert.match(PLAYER, /onTimeUpdate=/)
    assert.match(PLAYER, /videoProgressFraction\(el\.currentTime, el\.duration\)/)
    assert.match(VIEWER, /onProgress=\{setProgresso\}/)
  })

  it("foto e texto usam a duração visual previsível do domínio", () => {
    assert.match(VIEWER, /MOMENT_VISUAL_DURATION_MS/)
    assert.match(VIEWER, /requestAnimationFrame\(passo\)/)
  })

  it("o progresso zera ao trocar de Momento", () => {
    assert.match(VIEWER, /setProgresso\(0\)\n\s*\}, \[openIndex\]\)/)
  })

  it("prefers-reduced-motion não roda cronômetro quadro a quadro", () => {
    assert.match(VIEWER, /if \(reduzirMovimento\) \{\s*\n\s*setProgresso\(1\)/)
  })

  it("NÃO existe auto-advance: chegar a 100% apenas para", () => {
    // Se alguém ligar avanço automático, terá de chamar onNavigate do timer —
    // este teste falha na hora.
    assert.doesNotMatch(VIEWER, /fracao >= 1[\s\S]{0,120}onNavigate/)
    assert.match(VIEWER, /if \(fracao < 1\) raf = requestAnimationFrame\(passo\)/)
  })
})
