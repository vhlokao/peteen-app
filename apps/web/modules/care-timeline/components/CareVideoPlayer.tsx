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
import { preconnect } from "react-dom"
import { Play, RotateCcw, Video, VideoOff } from "lucide-react"

import type { CareMediaView } from "../domain/types"
import { proporcaoAberta, proporcaoFechada } from "../domain/media-aspect"
import { supabaseStorageOrigin } from "@/lib/storage/storage-origin"

/**
 * Origem do Storage, resolvida uma vez por módulo.
 *
 * Fora do componente de propósito: o valor vem de env inlinada no build e não
 * muda entre renders, então recalcular por instância só gastaria trabalho numa
 * timeline com várias atualizações.
 */
const ORIGEM_STORAGE = supabaseStorageOrigin()

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

/**
 * GATE-9-...-REFINE-003 — variante visual do estado FECHADO.
 *
 * `default` é a superfície clara da timeline e da tela do profissional, e
 * continua exatamente como sempre foi.
 *
 * `immersive` existe porque o QA físico do Vitor mostrou o problema: dentro do
 * visualizador de Momentos (fundo navy escuro), `bg-muted` renderiza claro no
 * tema light — o card fechado virava um retângulo quase branco no meio da tela
 * escura, com cara de placeholder técnico em vez de mídia. A variante troca
 * SÓ as cores do estado fechado e do erro por tons que conversam com esse
 * fundo.
 *
 * Opt-in de propósito: quem não passa a prop não muda de comportamento nem de
 * aparência, então nenhuma das duas superfícies existentes é tocada.
 */
type VarianteVisual = "default" | "immersive"

export function CareVideoPlayer({
  media,
  variant = "default",
}: {
  media: CareMediaView
  variant?: VarianteVisual
}) {
  /**
   * Antecipa DNS + TCP + TLS com o Storage — medido em ~480 ms de economia no
   * primeiro vídeo que o tutor abre (ver lib/storage/storage-origin.ts).
   *
   * Declarado AQUI, e não no topo da timeline, porque este componente só existe
   * quando a atualização tem vídeo. Uma timeline só de fotos nunca monta o
   * player, então nunca emite o hint — a condição "só quando há vídeo" sai da
   * estrutura, sem precisar de uma checagem que alguém possa esquecer de
   * atualizar depois.
   *
   * Chamadas repetidas são inofensivas: `preconnect` do react-dom deduplica por
   * href, então N atualizações com vídeo produzem UM hint.
   *
   * Não requisita o arquivo e não baixa byte nenhum — o card fechado continua
   * sem `<video>`, sem `src` e sem tráfego de mídia.
   */
  if (ORIGEM_STORAGE) preconnect(ORIGEM_STORAGE)

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
    const imersivo = variant === "immersive"
    return (
      <div className={imersivo ? undefined : "mt-2"}>
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
          className={`group relative mx-auto flex w-full items-center justify-center overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            imersivo
              ? // Sem borda clara e sem fundo `muted`: no visualizador escuro o
                // card precisa LER como um vídeo esperando play, não como um
                // bloco encaixado. O véu branco translúcido escurece com o
                // fundo do viewer em vez de brigar com ele.
                "rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] focus-visible:ring-white focus-visible:ring-offset-transparent"
              : "rounded-lg border border-border/70 bg-muted hover:bg-muted/70 focus-visible:ring-ring"
          }`}
        >
          <span className="flex flex-col items-center gap-2">
            {/* O círculo é o alvo visual do play; o <button> inteiro é a área
                tocável, então não há alvo de toque pequeno aqui. */}
            <span
              className={`grid place-items-center rounded-full transition-transform group-hover:scale-105 ${
                imersivo
                  ? "size-16 bg-white/95 shadow-lg"
                  : "size-14 bg-background/90 shadow-sm ring-1 ring-border/50"
              }`}
            >
              <Play
                className={`translate-x-0.5 ${
                  imersivo ? "size-7 fill-[#141B33] text-[#141B33]" : "size-6 fill-foreground text-foreground"
                }`}
                aria-hidden
              />
            </span>
            <span
              className={`flex items-center gap-1.5 text-xs font-medium ${
                imersivo ? "text-white/75" : "text-muted-foreground"
              }`}
            >
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
    const imersivo = variant === "immersive"
    return (
      <div
        className={`flex flex-col items-center gap-3 px-4 py-6 ${
          imersivo
            ? "rounded-2xl bg-white/[0.06]"
            : "mt-2 rounded-lg border border-border/70 bg-muted/40"
        }`}
        role="status"
      >
        <VideoOff
          className={`size-5 ${imersivo ? "text-white/70" : "text-muted-foreground"}`}
          aria-hidden
        />
        <span
          className={`text-center text-sm ${imersivo ? "text-white/80" : "text-muted-foreground"}`}
        >
          Não foi possível reproduzir este vídeo.
        </span>
        <button
          type="button"
          onClick={tentarNovamente}
          className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 ${
            imersivo
              ? "bg-white/10 text-white hover:bg-white/15 focus-visible:ring-white"
              : "border border-border/70 bg-background text-foreground focus-visible:ring-ring"
          }`}
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
        // `auto` AQUI é seguro, e é medido — não uma suposição.
        //
        // Este elemento só existe depois do gesto: a pessoa tocou em
        // "Reproduzir" e está esperando. A partir desse ponto, segurar o
        // browser não protege ninguém, só atrasa.
        //
        // Comparação com arquivos reais, bytes não cacheados:
        //   preload="metadata" .... T4 = 443 ms
        //   preload="auto" ........ T4 = 266 ms
        //
        // E sem custo de tráfego: nos dois modos o buffer no primeiro frame é
        // o mesmo (~2,3 MB) e, poucos segundos depois, ambos já baixaram ~99%
        // do arquivo — porque os vídeos deste produto duram 7-9 s e o browser
        // termina de puxá-los de qualquer jeito. `auto` muda a largada, não o
        // volume.
        //
        // O contrato de rede segue intacto onde importa: ANTES do clique não
        // existe `<video>` nenhum, então não há preload de espécie alguma.
        preload="auto"
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
