"use client"

/**
 * CareVideoPlayer — o vídeo de UMA atualização de cuidado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE MUDOU NA V0.1, E POR QUÊ
 *
 * A V0 montava `<video src controls preload="metadata">` direto na timeline.
 * Funcionava, mas tinha dois problemas que o QA físico expôs:
 *
 *   1. VISUAL — controles nativos sempre visíveis, barra de progresso zerada
 *      no meio da lista. Lia como anexo de arquivo, não como parte do Diário.
 *
 *   2. REDE — `preload="metadata"` não é gratuito: o browser abre conexão e
 *      baixa o cabeçalho de CADA vídeo assim que o elemento entra no DOM,
 *      antes de qualquer gesto. Barato por vídeo, mas pago por quem só está
 *      rolando a lista — em rede móvel, no meio de um atendimento.
 *
 * A correção é a mesma para os dois: enquanto ninguém pediu para assistir, NÃO
 * EXISTE elemento `<video>`. Há um card. Sem elemento não há request, não há
 * metadata, não há buffering e não há controle nativo para destoar do resto.
 *
 * O `<video>` real só é montado no clique — aí sim com `controls`,
 * `playsInline` e `preload="metadata"`, porque a pessoa já decidiu assistir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CARD FECHADO NÃO FINGE TER THUMBNAIL
 *
 * Não há poster: gerar um frame exigiria ffmpeg no servidor, explicitamente
 * fora do escopo. Então o card não simula uma prévia com blur, cor extraída
 * ou imagem genérica de "vídeo" — ele se apresenta pelo que é, com um botão de
 * play e um rótulo. Fingir prévia seria pior que não ter: cria expectativa de
 * conteúdo que o card não pode cumprir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROPORÇÃO: 16/9 FECHADO, REAL DEPOIS
 *
 * Fechado, todo card usa 16/9. Isso é deliberado: sem metadata não sabemos a
 * proporção do arquivo, e chutar por vídeo faria cada card ter uma altura
 * diferente — a timeline saltaria enquanto rola. Uma altura previsível para
 * todos vale mais do que acertar a proporção de um vídeo que ninguém abriu.
 *
 * Ao tocar play, o elemento reporta `videoWidth/videoHeight` e o container
 * adota a proporção real, limitada por `max-height`. O ajuste acontece UMA vez,
 * depois de a pessoa já ter escolhido assistir — é a expansão esperada do
 * conteúdo, não um salto durante a rolagem.
 *
 * Vídeo de celular é frequentemente vertical (9:16). Sem teto, um deles ocupa
 * a tela inteira e empurra o resto do Diário para fora. Com `max-height` e
 * `object-contain`, ele aparece inteiro, sem corte e sem dominar a lista.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, RotateCcw, Video, VideoOff } from "lucide-react"

import type { CareMediaView } from "../domain/types"
import { proporcaoAberta, proporcaoFechada } from "../domain/media-aspect"

/**
 * Teto de altura do player aberto.
 *
 * 60vh, não 70: num aparelho de 812px de altura isso dá ~487px, o que deixa o
 * vídeo confortável e ainda mantém visível parte do relato de texto e o começo
 * da próxima atualização — a pessoa continua enxergando que está numa timeline.
 * Acima disso, um vídeo vertical vira tela cheia sem ter pedido.
 */
const ALTURA_MAXIMA = "60vh"

/**
 * Teto do card FECHADO — menor que o do player.
 *
 * Um card 4:5 numa coluna de 390px daria ~448px de altura. Com várias
 * atualizações, cada vídeo não aberto empurraria o resto do Diário para longe.
 * 50vh mantém o card claramente vertical e ainda deixa o próximo item à vista.
 *
 * Ser MENOR que `ALTURA_MAXIMA` também é o que faz tocar play parecer o
 * conteúdo crescendo: fechado cabe em 50vh, aberto pode ir a 60vh.
 */
const ALTURA_MAXIMA_FECHADA = "50vh"

/**
 * Só um vídeo toca por vez.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM MÓDULO, E NÃO CONTEXT/STORE
 *
 * O requisito é local: quando um vídeo começa, o anterior para. Isso não
 * precisa de estado compartilhado em React — nenhum componente precisa
 * RENDERIZAR diferente por causa disso, só o elemento anterior precisa receber
 * `.pause()`. Um Context obrigaria provider, re-render em cascata e uma
 * dependência nova entre componentes, para resolver algo que uma referência de
 * módulo resolve sem tocar na árvore.
 *
 * A referência é intencionalmente fraca no sentido de responsabilidade: se o
 * elemento anterior já saiu do DOM, `.pause()` num nó órfão é inofensivo.
 */
let videoTocandoAgora: HTMLVideoElement | null = null

function assumirReproducao(elemento: HTMLVideoElement) {
  if (videoTocandoAgora && videoTocandoAgora !== elemento) {
    videoTocandoAgora.pause()
  }
  videoTocandoAgora = elemento
}

function liberarReproducao(elemento: HTMLVideoElement) {
  if (videoTocandoAgora === elemento) videoTocandoAgora = null
}

type Estado = "fechado" | "carregando" | "tocando" | "erro"

export function CareVideoPlayer({ media }: { media: CareMediaView }) {
  const [estado, setEstado] = useState<Estado>("fechado")
  /**
   * Proporção do card FECHADO — do banco, sem tocar no arquivo. Vertical vira
   * 4:5, horizontal 16:9, quadrado 1:1, desconhecido 4:5 (portrait-first).
   */
  const proporcaoDoCard = proporcaoFechada(media.displayWidth, media.displayHeight)
  /**
   * Proporção do player ABERTO. Começa na real persistida (quando existe), o
   * que faz o vídeo abrir já na forma certa; `onLoadedMetadata` confirma
   * depois, e corrige caso o hint do cliente estivesse errado.
   */
  const [proporcao, setProporcao] = useState<number | null>(() =>
    proporcaoAberta(media.displayWidth, media.displayHeight)
  )
  /**
   * Muda a cada tentativa. Serve de `key` do <video>: remontar o elemento é o
   * que efetivamente refaz a requisição — trocar só o estado deixaria o mesmo
   * nó em erro.
   */
  const [tentativa, setTentativa] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Se o componente sair da tela tocando (rolagem longa, navegação), o
  // registro não pode continuar apontando para um nó que não existe mais.
  useEffect(() => {
    const elemento = videoRef.current
    return () => {
      if (elemento) liberarReproducao(elemento)
    }
  }, [tentativa])

  const abrir = useCallback(() => {
    setEstado("carregando")
  }, [])

  const tentarNovamente = useCallback(() => {
    // Volta ao hint persistido, não a `null`: uma nova tentativa não deve
    // perder a orientação que já conhecíamos antes do erro.
    setProporcao(proporcaoAberta(media.displayWidth, media.displayHeight))
    setTentativa((n) => n + 1)
    setEstado("carregando")
  }, [media.displayWidth, media.displayHeight])

  // ───────────────────────────────────────────────────────────────────────────
  // FECHADO — nenhum <video> no DOM, nenhuma request
  // ───────────────────────────────────────────────────────────────────────────
  if (estado === "fechado") {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={abrir}
          // O nome acessível descreve a AÇÃO e o objeto. Um leitor de tela que
          // encontrasse só "▶" não teria como saber o que seria reproduzido —
          // e o ícone está marcado como decorativo justamente por isso.
          aria-label="Reproduzir vídeo do atendimento"
          style={{ aspectRatio: String(proporcaoDoCard), maxHeight: ALTURA_MAXIMA_FECHADA }}
          // `mx-auto` pela mesma razão do player aberto: com `max-height`
          // cortando um card vertical, a largura encolhe junto e sem
          // centralizar o bloco encostaria na margem esquerda.
          className="group relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex flex-col items-center gap-2">
            {/* O círculo é o alvo visual do play; o <button> inteiro é a área
                tocável, então não há alvo de toque pequeno aqui. */}
            <span className="grid size-14 place-items-center rounded-full bg-background/90 shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-105">
              <Play className="size-6 translate-x-0.5 fill-foreground text-foreground" aria-hidden />
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Video className="size-3.5" aria-hidden />
              Vídeo do atendimento
            </span>
          </span>
        </button>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ERRO — discreto, com ação, sem detalhe técnico
  // ───────────────────────────────────────────────────────────────────────────
  if (estado === "erro") {
    return (
      <div
        className="mt-2 flex flex-col items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-6"
        role="status"
      >
        <VideoOff className="size-5 text-muted-foreground" aria-hidden />
        <span className="text-center text-sm text-muted-foreground">
          Não foi possível reproduzir este vídeo.
        </span>
        <button
          type="button"
          onClick={tentarNovamente}
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-4" aria-hidden />
          Tentar novamente
        </button>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CARREGANDO / TOCANDO — o <video> real
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div
      // `mx-auto` não é cosmético. Quando `max-height` corta a caixa de um
      // vídeo VERTICAL, a largura encolhe junto (9:16 limitado a 506px de
      // altura dá 285px de largura). Sem centralizar, esse bloco mais estreito
      // encosta na margem esquerda e deixa uma faixa vazia à direita —
      // medido: 73px num aparelho de 390px. Centralizado, a sobra fica
      // simétrica e o vídeo lê como parte da coluna, não como algo desalinhado.
      className="relative mx-auto mt-2 overflow-hidden rounded-lg border border-border/70 bg-black"
      style={{
        aspectRatio: String(proporcao ?? proporcaoDoCard),
        maxHeight: ALTURA_MAXIMA,
      }}
    >
      <video
        key={tentativa}
        ref={videoRef}
        src={media.signedUrl}
        // `metadata`, não `auto`: mesmo depois do clique, o arquivo é buscado
        // conforme toca. Um vídeo de 50 MB não precisa estar inteiro em
        // memória para começar.
        preload="metadata"
        controls
        // `autoPlay` aqui NÃO é autoplay de timeline: este elemento só existe
        // porque a pessoa tocou em "Reproduzir". Sem ele, o clique abriria um
        // player parado e exigiria um segundo toque para a mesma intenção.
        autoPlay
        // Obrigatório no iOS: sem isto o Safari joga o vídeo em tela cheia
        // nativa ao tocar play, tirando a pessoa da timeline.
        playsInline
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          // Proporção real do arquivo — só agora ela é conhecida.
          if (el.videoWidth > 0 && el.videoHeight > 0) {
            setProporcao(el.videoWidth / el.videoHeight)
          }
        }}
        onPlaying={() => setEstado("tocando")}
        onPlay={(e) => assumirReproducao(e.currentTarget)}
        onPause={(e) => liberarReproducao(e.currentTarget)}
        onEnded={(e) => liberarReproducao(e.currentTarget)}
        onError={() => setEstado("erro")}
        className="size-full bg-black object-contain"
      />

      {/* Carregando: discreto, sobre o vídeo, e some no primeiro frame. Não é
          spinner infinito — `onError` leva ao estado de erro com ação. */}
      {estado === "carregando" ? (
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40"
          role="status"
        >
          <span className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="sr-only">Carregando vídeo…</span>
        </span>
      ) : null}
    </div>
  )
}
