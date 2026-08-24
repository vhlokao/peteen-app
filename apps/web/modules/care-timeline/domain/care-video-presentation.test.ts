/**
 * Garantias de apresentação e rede do CareVideoPlayer (V0.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE VERIFICAÇÃO ESTRUTURAL, E NÃO RENDER
 *
 * O que precisa ser garantido aqui é a AUSÊNCIA de trabalho: nenhum `<video>`
 * no DOM antes do clique, logo nenhuma request de metadata. Provar isso com
 * render exigiria jsdom — que não implementa carregamento de mídia, então um
 * teste ali passaria mesmo com o bug presente, dando falsa segurança.
 *
 * A propriedade real é estrutural: o elemento `<video>` está atrás de um
 * `return` antecipado do estado fechado. É isso que estes testes fixam, no
 * mesmo padrão já usado em care-update-timing.test.ts e
 * care-media-upload-destination.test.ts.
 *
 * O comportamento visual em aparelho real continua sendo trabalho do QA
 * físico. Estes testes existem para impedir REGRESSÃO silenciosa — alguém
 * mover o `<video>` para fora do ramo condicional e reintroduzir o download em
 * massa sem que nada acuse.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const FONTE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../components/CareVideoPlayer.tsx"
  ),
  "utf8"
)

/** Sem comentários: o cabeçalho explica o incidente citando `preload="auto"`,
 *  `autoplay` e outros termos que os testes procuram. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const codigo = semComentarios(FONTE)

/** Trecho do estado fechado: do `if (estado === "fechado")` até o fim do ramo. */
function ramoFechado(): string {
  const inicio = codigo.indexOf('if (estado === "fechado")')
  assert.notEqual(inicio, -1, "o estado fechado precisa existir")
  const fim = codigo.indexOf('if (estado === "erro")')
  assert.notEqual(fim, -1, "o estado de erro precisa existir")
  assert.ok(fim > inicio, "fechado vem antes de erro")
  return codigo.slice(inicio, fim)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rede — o que a timeline NÃO faz enquanto ninguém pediu
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — estado fechado não gera trabalho de rede", () => {
  it("o ramo fechado não monta elemento <video>", () => {
    // A garantia central da V0.1: sem elemento, o browser não tem o que buscar.
    assert.doesNotMatch(
      ramoFechado(),
      /<video/,
      "montar <video> no estado fechado reintroduz a busca de metadata por vídeo da lista"
    )
  })

  it("o ramo fechado não referencia a signed URL", () => {
    assert.doesNotMatch(
      ramoFechado(),
      /signedUrl/,
      "nenhum atributo do card fechado pode apontar para o arquivo"
    )
  })

  it("existe exatamente UM <video> no arquivo", () => {
    // Mais de um significaria um caminho alternativo que pode escapar do
    // gate do clique.
    const ocorrencias = codigo.match(/<video\b/g) ?? []
    assert.equal(ocorrencias.length, 1, `encontrado ${ocorrencias.length} elementos <video>`)
  })

  it("o estado inicial é 'fechado'", () => {
    assert.match(codigo, /useState<Estado>\("fechado"\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Player ativo — atributos exigidos
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — player ativo", () => {
  it("preload é metadata, nunca auto", () => {
    assert.match(codigo, /preload="metadata"/)
    assert.doesNotMatch(
      codigo,
      /preload="auto"/,
      "auto baixaria o arquivo inteiro adiantado"
    )
  })

  it("tem controls nativos", () => {
    assert.match(codigo, /^\s*controls\s*$/m)
  })

  it("tem playsInline — sem ele o iOS força tela cheia", () => {
    assert.match(codigo, /playsInline/)
  })

  it("usa object-contain, nunca object-cover", () => {
    // `cover` cortaria o vídeo: num vertical, perderia topo e base do que o
    // profissional gravou.
    assert.match(codigo, /object-contain/)
    assert.doesNotMatch(codigo, /object-cover/)
  })

  it("tem teto de altura para não deixar vídeo vertical dominar a timeline", () => {
    assert.match(codigo, /maxHeight:\s*ALTURA_MAXIMA/)
    assert.match(codigo, /ALTURA_MAXIMA\s*=\s*"60vh"/)
  })

  it("o card fechado tem teto MENOR que o aberto — abrir precisa crescer", () => {
    assert.match(codigo, /ALTURA_MAXIMA_FECHADA\s*=\s*"50vh"/)
    assert.match(codigo, /maxHeight:\s*ALTURA_MAXIMA_FECHADA/)
  })

  it("adota a proporção real do arquivo depois de ler os metadados", () => {
    assert.match(codigo, /onLoadedMetadata/)
    assert.match(codigo, /videoWidth\s*\/\s*el\.videoHeight/)
  })

  it("já abre na proporção persistida, sem esperar metadata", () => {
    // Sem isto o vídeo abriria na forma do card e saltaria ao carregar.
    assert.match(codigo, /useState<number \| null>\(\(\)\s*=>\s*\n?\s*proporcaoAberta\(/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Portrait-first — a forma vem do banco, não do arquivo
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — orientação portrait-first", () => {
  it("a proporção fechada vem do domínio, não de constante local", () => {
    assert.match(codigo, /proporcaoFechada\(media\.displayWidth,\s*media\.displayHeight\)/)
  })

  it("não sobrou constante fixa de 16/9 no componente", () => {
    // O contrato "todo card é 16/9" era a causa do card deitado abrindo em pé.
    assert.doesNotMatch(codigo, /PROPORCAO_FECHADA\s*=\s*16\s*\/\s*9/)
  })

  it("o card fechado usa a proporção resolvida", () => {
    const inicio = codigo.indexOf('if (estado === "fechado")')
    const fim = codigo.indexOf('if (estado === "erro")')
    const fechado = codigo.slice(inicio, fim)
    assert.match(fechado, /aspectRatio:\s*String\(proporcaoDoCard\)/)
  })

  it("card fechado é centralizado — max-height encolhe a largura de um vertical", () => {
    const inicio = codigo.indexOf('if (estado === "fechado")')
    const fim = codigo.indexOf('if (estado === "erro")')
    assert.match(codigo.slice(inicio, fim), /mx-auto/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Um vídeo por vez
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — reprodução exclusiva", () => {
  it("pausa o vídeo anterior ao iniciar outro", () => {
    assert.match(codigo, /onPlay=\{\(e\)\s*=>\s*assumirReproducao/)
    assert.match(codigo, /videoTocandoAgora\.pause\(\)/)
  })

  it("libera o registro em pause, fim e desmontagem", () => {
    assert.match(codigo, /onPause=\{\(e\)\s*=>\s*liberarReproducao/)
    assert.match(codigo, /onEnded=\{\(e\)\s*=>\s*liberarReproducao/)
    // Sem a limpeza no unmount, o registro apontaria para um nó fora do DOM.
    assert.match(codigo, /return\s*\(\)\s*=>\s*\{[\s\S]*liberarReproducao/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Loading e erro
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — carregando e erro", () => {
  it("erro tem ação de tentar novamente", () => {
    assert.match(codigo, /Tentar novamente/)
    assert.match(codigo, /onClick=\{tentarNovamente\}/)
  })

  it("tentar novamente remonta o elemento via key", () => {
    // Trocar só o estado deixaria o mesmo nó em erro; a remontagem é o que
    // refaz a requisição de fato.
    assert.match(codigo, /key=\{tentativa\}/)
    assert.match(codigo, /setTentativa\(\(n\)\s*=>\s*n\s*\+\s*1\)/)
  })

  it("a mensagem de erro é humana, sem termo técnico", () => {
    assert.match(codigo, /Não foi possível reproduzir este vídeo\./)
    const proibidos = /(?:signed|storage|supabase|403|CORS|MEDIA_ERR|NetworkError)/i
    const mensagens = codigo.match(/>\s*[^<>{}]*vídeo[^<>{}]*</gi) ?? []
    for (const m of mensagens) {
      assert.doesNotMatch(m, proibidos, `mensagem com termo técnico: ${m.trim()}`)
    }
  })

  it("o spinner não é infinito — onError leva ao estado de erro", () => {
    assert.match(codigo, /onError=\{\(\)\s*=>\s*setEstado\("erro"\)\}/)
  })

  it("o carregando some quando o vídeo começa a tocar", () => {
    assert.match(codigo, /onPlaying=\{\(\)\s*=>\s*setEstado\("tocando"\)\}/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Acessibilidade
// ─────────────────────────────────────────────────────────────────────────────

describe("CareVideoPlayer — acessibilidade do card fechado", () => {
  const fechado = ramoFechado()

  it("o card fechado é um <button> — acionável por teclado", () => {
    assert.match(fechado, /<button/)
    assert.match(fechado, /type="button"/)
  })

  it("tem nome acessível que descreve a ação e o objeto", () => {
    assert.match(fechado, /aria-label="Reproduzir vídeo do atendimento"/)
  })

  it("não depende só do ícone — há rótulo textual visível", () => {
    assert.match(fechado, /Vídeo do atendimento/)
  })

  it("os ícones são decorativos para leitor de tela", () => {
    const icones = fechado.match(/<(Play|Video)\b[^>]*>/g) ?? []
    assert.ok(icones.length >= 2, "esperado ícone de play e de vídeo")
    for (const icone of icones) {
      assert.match(icone, /aria-hidden/, `ícone sem aria-hidden: ${icone}`)
    }
  })

  it("tem indicador de foco visível", () => {
    assert.match(fechado, /focus-visible:ring/)
  })
})
