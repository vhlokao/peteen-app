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
import { Play, RotateCcw, Video, VideoOff, Volume2, VolumeX } from "lucide-react"

import type { CareMediaView } from "../domain/types"
import { proporcaoAberta, proporcaoFechada } from "../domain/media-aspect"
import { videoProgressFraction } from "../domain/care-moments"
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
/**
 * `diary` (GATE-9-...-REFINE-005): a timeline COMPLETA do Tutor. Mesmo
 * comportamento do default — card fechado, nenhum `<video>` antes do gesto —
 * mas com presença de mídia editorial em vez de bloco pequeno anexado ao log.
 * A tela do profissional continua no `default`, intocada.
 */
type VarianteVisual = "default" | "immersive" | "diary"

export function CareVideoPlayer({
  media,
  variant = "default",
  onProgress,
}: {
  media: CareMediaView
  variant?: VarianteVisual
  /**
   * Progresso de reprodução (0..1), opt-in — GATE-9-...-REFINE-005.
   *
   * Existe para que a barra de segmentos do visualizador seja dirigida pelo
   * PRÓPRIO vídeo (`currentTime/duration`), em vez de por um cronômetro
   * paralelo que inevitavelmente dessincronizaria em buffering. Quem não
   * passa a prop não paga nada: sem callback, nenhum listener extra importa.
   */
  onProgress?: (fraction: number) => void
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

  /**
   * GATE-9-...-REFINE-004: no viewer o vídeo já nasce ABERTO.
   *
   * A missão pede que abrir um Momento com vídeo comece a tocar sozinho, sem
   * um segundo toque em "Reproduzir" — abrir o Momento JÁ É o gesto. Na
   * timeline o estado inicial continua "fechado", que é o que impede dezenas
   * de vídeos de carregarem só porque a lista rolou.
   */
  const [estado, setEstado] = useState<Estado>(
    variant === "immersive" ? "carregando" : "fechado"
  )
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

  /**
   * GATE-9-...-REFINE-004 — som desligado é o estado inicial, sempre.
   *
   * Não é preferência estética: navegador nenhum autoriza autoplay COM áudio
   * sem gesto prévio, e o bloqueio é inconsistente entre iOS/Android/desktop.
   * Começar mudo é o que faz o vídeo realmente começar; ligar o som é sempre
   * uma ação explícita da pessoa, que é justamente o gesto que o browser
   * exige. Estado local e efêmero — nada é persistido.
   */
  const [semSom, setSemSom] = useState(true)

  /**
   * `muted` é uma propriedade que o React historicamente não reflete de forma
   * confiável como atributo. Aqui ela decide se o autoplay acontece, então é
   * imposta no próprio elemento a cada mudança, além de declarada no JSX.
   */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = semSom
  }, [semSom, tentativa, estado])

  const alternarSom = useCallback(() => {
    setSemSom((atual) => !atual)
  }, [])

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
  //
  // Só a TIMELINE chega aqui. No visualizador o estado inicial já é
  // "carregando" (ver useState acima), então o card de espera e o segundo
  // toque em "Reproduzir" deixaram de existir lá — abrir o Momento é o gesto.
  //
  // Na timeline este card continua sendo o que impede dezenas de vídeos de
  // carregarem só porque a lista rolou: sem gesto, não há elemento, não há
  // request, não há autoplay por viewport.
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
          //
          // `diary` (REFINE-005): mesma estrutura, presença maior — cantos
          // mais generosos e sem borda concorrendo com a foto ao lado, para
          // que vídeo e foto leiam como a MESMA linguagem na timeline do
          // Tutor. O `default` (profissional) segue idêntico ao que era.
          className={`group focus-visible:ring-ring relative mx-auto flex w-full items-center justify-center overflow-hidden transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
            variant === "diary"
              ? "bg-muted hover:bg-muted/80 rounded-2xl"
              : "border-border/70 bg-muted hover:bg-muted/70 rounded-lg border"
          }`}
        >
          <span className="flex flex-col items-center gap-2">
            {/* O círculo é o alvo visual do play; o <button> inteiro é a área
                tocável, então não há alvo de toque pequeno aqui. */}
            <span className="bg-background/90 ring-border/50 grid size-14 place-items-center rounded-full shadow-sm ring-1 transition-transform group-hover:scale-105">
              <Play className="fill-foreground text-foreground size-6 translate-x-0.5" aria-hidden />
            </span>
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
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
      className={
        variant === "immersive"
          ? // No visualizador o vídeo se comporta como a foto: ocupa a área
            // disponível, sem moldura nem borda, e a proporção real decide a
            // caixa dentro dela. Uma borda clara aqui reintroduziria a
            // aparência de "card encaixado" que o REFINE-003 removeu.
            "relative mx-auto max-h-full overflow-hidden"
          : variant === "diary"
          ? // Timeline do Tutor: mesma linguagem de canto das fotos, sem
            // borda — a moldura clara fazia o vídeo parecer anexo, não mídia.
            "relative mx-auto mt-2 overflow-hidden rounded-2xl bg-black"
          : // `mx-auto` não é cosmético. Quando `max-height` corta a caixa de
            // um vídeo VERTICAL, a largura encolhe junto (9:16 limitado a
            // 506px de altura dá 285px de largura). Sem centralizar, esse
            // bloco mais estreito encosta na margem esquerda e deixa uma faixa
            // vazia à direita — medido: 73px num aparelho de 390px.
            "relative mx-auto mt-2 overflow-hidden rounded-lg border border-border/70 bg-black"
      }
      style={{
        aspectRatio: String(proporcao ?? proporcaoDoCard),
        maxHeight: variant === "immersive" ? "100%" : ALTURA_MAXIMA,
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
        // GATE-9-...-REFINE-004: SEM `controls`.
        //
        // Os controles nativos traziam barra de tempo, volume, fullscreen,
        // menu de três pontos, download e velocidade — um player tradicional
        // encaixado dentro de um Momento. O único controle de mídia agora é o
        // de som, logo abaixo, desenhado como parte do visualizador.
        //
        // Os atributos abaixo são DEFENSIVOS, não substitutos: mesmo sem
        // `controls`, alguns navegadores expõem download/PiP por menu de
        // contexto ou pela UI do sistema.
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        // Fecha o menu de contexto do browser sobre o vídeo (é por ele que o
        // "Salvar vídeo como…" reaparece mesmo sem controles).
        onContextMenu={(e) => e.preventDefault()}
        // `autoPlay` + `muted` são um par indivisível: navegador nenhum
        // autoriza autoplay com áudio sem gesto anterior. Mudo é o que faz o
        // vídeo de fato começar; o som é sempre uma escolha explícita depois.
        autoPlay
        muted={semSom}
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
        // A barra de segmentos é dirigida pelo vídeo, não por um timer
        // paralelo: em buffering o `currentTime` simplesmente para, e a barra
        // para junto — em vez de fingir que o conteúdo avançou.
        onTimeUpdate={
          onProgress
            ? (e) => {
                const el = e.currentTarget
                onProgress(videoProgressFraction(el.currentTime, el.duration))
              }
            : undefined
        }
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
          /*
           * REFINE-005 — feedback IMEDIATO enquanto o primeiro frame não vem.
           *
           * Medido contra o Storage real: conexão fria custa 391 ms só de
           * DNS/TCP/TLS/TTFB. Nesse intervalo o `<video>` é uma caixa preta
           * vazia, e a tela parecia travada. O véu com brilho em movimento
           * dá sinal de "está vindo" sem prometer progresso que não existe —
           * a barra de progresso real só começa quando o vídeo reporta tempo.
           *
           * `motion-safe:` porque quem pediu menos movimento no sistema
           * recebe o mesmo véu, parado.
           */
          className="pointer-events-none absolute inset-0 overflow-hidden bg-black/55"
          role="status"
        >
          <span className="absolute inset-0 motion-safe:animate-pulse bg-gradient-to-br from-white/[0.07] via-transparent to-white/[0.07]" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
          </span>
          <span className="sr-only">Carregando vídeo…</span>
        </span>
      ) : null}

      {/*
        ── Único controle de mídia: som ─────────────────────────────────────

        Substitui a barra nativa inteira. `z-30` porque, no visualizador, as
        zonas de navegação lateral ficam em `z-10` sobre o vídeo — sem isto,
        tocar no botão de som trocaria de Momento em vez de ligar o áudio.

        `size-11` = 44px, o alvo de toque mínimo confortável já adotado no
        projeto. `stopPropagation` fecha a porta para o clique escapar para
        qualquer área de navegação que venha a envolver o player.
      */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          alternarSom()
        }}
        aria-label={semSom ? "Ativar som" : "Desativar som"}
        aria-pressed={!semSom}
        className="absolute right-3 bottom-3 z-30 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {semSom ? (
          <VolumeX className="size-5" aria-hidden />
        ) : (
          <Volume2 className="size-5" aria-hidden />
        )}
      </button>
    </div>
  )
}
