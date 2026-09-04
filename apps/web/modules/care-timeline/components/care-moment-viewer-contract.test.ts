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
  it("o vídeo fica ACIMA das zonas (z-20 > z-10) — play sempre clicável", () => {
    assert.match(VIEWER, /pointer-events-none relative z-20 w-full px-14/)
    assert.match(VIEWER, /pointer-events-auto/)
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
    assert.match(VIEWER, /<CareVideoPlayer media=\{video\} variant="immersive" \/>/)
  })

  it("a variante é OPT-IN: o default segue sendo o da timeline/profissional", () => {
    assert.match(PLAYER, /variant = "default"/)
    assert.match(PLAYER, /variant\?: VarianteVisual/)
  })

  it("nenhum <video> antes do gesto continua valendo — o estado fechado não monta elemento", () => {
    // O ramo "fechado" precisa retornar ANTES de qualquer <video>: é isso que
    // garante zero autoplay e zero preload, na variante imersiva também.
    const posFechado = PLAYER.indexOf('if (estado === "fechado")')
    // Ancora no ELEMENTO real (`key={tentativa}` só existe nele), e não na
    // primeira ocorrência de "<video" — o comentário do topo do arquivo cita
    // a tag em prosa e apareceria antes, fazendo o teste medir a coisa errada.
    const posVideo = PLAYER.search(/<video\s*\n\s*key=\{tentativa\}/)
    assert.ok(posFechado !== -1, "estado fechado não encontrado")
    assert.ok(posVideo !== -1, "elemento <video> não encontrado")
    assert.ok(posFechado < posVideo, "o estado fechado deve retornar antes do <video>")
  })

  it("o estado fechado imersivo não usa a superfície clara que virava bloco branco", () => {
    // `bg-muted` renderiza claro no tema light — era ele o "placeholder
    // branco" dentro do viewer escuro relatado no QA físico.
    assert.match(PLAYER, /imersivo\s*\n?\s*\?[\s\S]{0,200}bg-white\/\[0\.06\]/)
  })
})
