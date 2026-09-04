"use client"

/**
 * CareMomentViewer — o momento do cuidado em tela cheia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE MUDOU, E POR QUÊ
 *
 * GATE-9-...-001 entregou a faixa de Momentos, mas tocar num card só ROLAVA
 * até a entrada da timeline. Funcionava como índice — e era pouco: a foto
 * continuava sendo vista num quadrado pequeno, dentro de uma lista.
 *
 * Aqui o momento ABRE. A mídia ocupa a tela, o relato fica logo abaixo, e dá
 * para andar entre os momentos sem voltar para a lista. A referência de
 * interação é a que todo mundo já conhece de mídia em tela cheia; o que NÃO se
 * copia é a parte social: não há like, reação, visualização, seguidor,
 * comentário, contagem regressiva nem conteúdo que some.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NADA DE PIPELINE NOVO
 *
 * Foto usa `resolveLightboxImageSrc` — a MESMA variante de 1600px que o
 * lightbox da timeline já usa. Vídeo é o `CareVideoPlayer` inteiro, sem cópia:
 * é ele que garante o contrato de "nenhum <video> no DOM antes do gesto", que
 * é também o que garante ZERO autoplay aqui. As URLs continuam sendo as
 * assinadas de vida curta que o servidor emitiu; este componente não monta
 * URL nenhuma.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACESSIBILIDADE VEM DO DESIGN SYSTEM, NÃO DE CÓDIGO PRÓPRIO
 *
 * O `Dialog` (Base UI, o mesmo do lightbox) já entrega: papel de diálogo
 * modal, foco preso dentro, ESC para fechar, bloqueio do scroll de trás e
 * devolução do foco via `finalFocus`. Reimplementar qualquer um desses à mão
 * seria trocar uma implementação testada por uma nova chance de errar.
 *
 * O que o Dialog NÃO cobre e foi preciso resolver aqui: o Back do
 * Android/browser (ver `useBackToClose`) e as setas do teclado.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ListTree, X } from "lucide-react"

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DialogContent } from "@/components/ui/dialog"
import { CARE_CATEGORY_LABELS, type CareMediaView } from "../domain/types"
import {
  careUpdateAnchorId,
  momentPositionLabel,
  neighborPreloadIndexes,
  nextMomentIndex,
  previousMomentIndex,
  resolveCareMomentMedia,
  type CareMoment,
} from "../domain/care-moments"
import { CATEGORY_ICON, formatCareUpdateTime } from "./care-update-visuals"
import { CareVideoPlayer } from "./CareVideoPlayer"
import { imagemChegouQuebrada } from "../domain/media-display"
import { resolveLightboxImageSrc } from "@/lib/storage/care-media-transform"

/**
 * Superfície escura do visualizador.
 *
 * Escura porque é uma tela de MÍDIA: qualquer fundo claro compete com a foto e
 * muda a percepção de cor dela. Mas não é preto puro — é o navy da marca
 * escurecido (irmão de `#1D2F6F`, o navy já usado nos cards do tutor), para
 * que a tela continue lendo como Peteen e não como um player genérico.
 *
 * Fixa nos dois temas de propósito: um visualizador de foto que muda de fundo
 * conforme o tema claro/escuro faria a MESMA foto parecer duas fotos
 * diferentes.
 */
const SUPERFICIE = "#141B33"

/**
 * Back do Android/browser fecha o visualizador, em vez de sair do Diário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO VIROU ROTA NEM QUERY PARAM
 *
 * Uma rota (`/diario/momento/[id]`) ou um `?momento=` daria deep link, que
 * ninguém pediu, ao custo de: navegação do Next a cada abrir/fechar,
 * re-render do Server Component, e uma URL nova para manter compatível. O que
 * o gate exige é só que o Back não deixe a pessoa presa — e para isso basta
 * uma entrada de histórico com a MESMA URL. O deep link do Diário continua
 * exatamente como era, e um refresh com o visualizador aberto simplesmente
 * volta ao Diário, que é o comportamento esperado de algo efêmero.
 *
 * A entrada empurrada é REMOVIDA ao fechar por ESC/X/backdrop — senão o
 * próximo Back da pessoa seria um toque que aparentemente não faz nada.
 */
function useBackToClose(aberto: boolean, fechar: () => void) {
  const empurrouRef = useRef(false)

  /**
   * A função de fechar vive numa ref, e o efeito depende SÓ de `aberto`.
   *
   * Não é preciosismo: com `fechar` na lista de dependências, qualquer render
   * que recriasse o callback (trocar de momento recria) refazia o efeito —
   * cleanup incluso. E o cleanup chama `history.back()`. O sintoma medido no
   * QA foi exato: tocar em "próximo momento" fechava o visualizador inteiro.
   */
  const fecharRef = useRef(fechar)
  useEffect(() => {
    fecharRef.current = fechar
  }, [fechar])

  useEffect(() => {
    if (!aberto) return

    window.history.pushState({ careMomentViewer: true }, "")
    empurrouRef.current = true

    function aoVoltar() {
      // O Back já consumiu a entrada: só fecha, sem mexer no histórico.
      empurrouRef.current = false
      fecharRef.current()
    }

    window.addEventListener("popstate", aoVoltar)
    return () => {
      window.removeEventListener("popstate", aoVoltar)
      // Fechou por ESC/X/backdrop. Só desfaz a entrada se ela ainda for a
      // atual — se uma navegação de verdade aconteceu por cima, voltar aqui
      // tiraria a pessoa de onde ela acabou de chegar.
      if (empurrouRef.current && window.history.state?.careMomentViewer) {
        empurrouRef.current = false
        window.history.back()
      }
    }
  }, [aberto])
}

/** Barra de posição — segmentos discretos, sem progresso automático. */
function Segmentos({ indice, total }: { indice: number; total: number }) {
  return (
    <div className="flex flex-1 items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-0.5 flex-1 rounded-full transition-colors ${
            i === indice ? "bg-white" : i < indice ? "bg-white/45" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  )
}

function FotoDoMomento({
  foto,
  aoQuebrar,
}: {
  foto: CareMediaView
  aoQuebrar: () => void
}) {
  const src = resolveLightboxImageSrc(foto)

  return (
    <>
      {/*
        Fundo de apoio: a MESMA imagem, borrada, preenchendo a área que sobra.
        Mesma URL ⇒ nenhuma requisição a mais. É o que permite a foto aparecer
        INTEIRA (`object-contain`, sem corte destrutivo) sem deixar duas
        tarjas mortas ao lado — especialmente em foto vertical de celular.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        /* Decorativa: categoria, horário e relato já descrevem o momento no
           próprio diálogo, e a foto não tem legenda própria no V0. */
        aria-hidden
        decoding="async"
        ref={(node) => {
          if (node && imagemChegouQuebrada(node)) aoQuebrar()
        }}
        onError={aoQuebrar}
        /* z-0, e não z-10: a foto é DECORATIVA e precisa ficar ABAIXO das
           zonas de toque, senão o toque lateral cai na imagem em vez de
           navegar. Medido: com as duas em z-10, o lado esquerdo ficava morto. */
        className="relative z-0 max-h-full max-w-full object-contain"
      />
    </>
  )
}

export function CareMomentViewer({
  moments,
  openIndex,
  onOpenChange,
  onNavigate,
  finalFocus,
}: {
  moments: CareMoment[]
  /** `null` = fechado. Qualquer outro valor é um índice já validado pelo domínio. */
  openIndex: number | null
  onOpenChange: (aberto: boolean) => void
  onNavigate: (indice: number) => void
  /** Card que originou a abertura — recebe o foco de volta ao fechar. */
  finalFocus: React.RefObject<HTMLElement | null>
}) {
  const fecharRef = useRef<HTMLButtonElement | null>(null)
  /** Qual foto da atualização está grande (só relevante quando há mais de uma). */
  const [fotoAtiva, setFotoAtiva] = useState(0)
  const [fotoQuebrada, setFotoQuebrada] = useState(false)

  const aberto = openIndex !== null
  const momento = openIndex === null ? null : moments[openIndex]

  const fechar = useCallback(() => onOpenChange(false), [onOpenChange])
  useBackToClose(aberto, fechar)

  const total = moments.length
  const anterior = openIndex === null ? null : previousMomentIndex(openIndex, total)
  const proximo = openIndex === null ? null : nextMomentIndex(openIndex, total)

  // Trocar de momento reinicia a foto grande e o estado de erro: são estados
  // DO MOMENTO, não do visualizador.
  useEffect(() => {
    setFotoAtiva(0)
    setFotoQuebrada(false)
  }, [openIndex])

  /**
   * Pré-carrega só a foto dos momentos VIZINHOS — nunca a lista inteira, nunca
   * vídeo. `new Image()` é o mesmo mecanismo que a galeria da timeline já usa
   * para antecipar o lightbox: não entra no DOM e o browser deduplica por URL.
   */
  useEffect(() => {
    if (openIndex === null || typeof window === "undefined") return
    for (const i of neighborPreloadIndexes(openIndex, total)) {
      const vizinho = moments[i]
      if (!vizinho) continue
      const foto = resolveCareMomentMedia(vizinho.update).photos[0]
      if (!foto) continue
      const img = new window.Image()
      img.src = resolveLightboxImageSrc(foto)
    }
  }, [openIndex, total, moments])

  // Setas do teclado: navegação no desktop sem depender de clique. O Dialog já
  // cuida do ESC.
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && anterior !== null) onNavigate(anterior)
      if (e.key === "ArrowRight" && proximo !== null) onNavigate(proximo)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aberto, anterior, proximo, onNavigate])

  if (!momento || openIndex === null) {
    // Sem momento não há diálogo — e um Dialog aberto sem conteúdo prenderia o
    // foco numa caixa vazia.
    return null
  }

  const { update, isCurrent } = momento
  const { photos, video } = resolveCareMomentMedia(update)
  const Icon = CATEGORY_ICON[update.category]
  const categoria = CARE_CATEGORY_LABELS[update.category]
  const fotoGrande = photos[fotoAtiva] ?? photos[0] ?? null
  const temMidia = (fotoGrande !== null && !fotoQuebrada) || video !== null

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={fecharRef}
        finalFocus={finalFocus}
        showCloseButton={false}
        /* Tela cheia no celular (onde o Diário é usado de verdade) e um painel
           alto e centrado no desktop — a mesma tela, não dois desenhos. */
        className="fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(92dvh,860px)] sm:w-[min(100%-3rem,460px)] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        style={{ backgroundColor: SUPERFICIE }}
      >
        <DialogTitle className="sr-only">
          {categoria} · {formatCareUpdateTime(update.occurredAt)}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Momento {momentPositionLabel(openIndex, total)} do diário de cuidado. Use as
          setas do teclado para navegar entre os momentos e Escape para fechar.
        </DialogDescription>

        {/* ── Topo: posição, identificação e fechar ─────────────────────── */}
        <div className="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <Segmentos indice={openIndex} total={total} />
            <button
              type="button"
              ref={fecharRef}
              onClick={fechar}
              aria-label="Fechar momento"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{categoria}</p>
              <p className="truncate text-xs text-white/70">
                {formatCareUpdateTime(update.occurredAt)}
                {update.editedAt ? " · editado" : null}
              </p>
            </div>
            {isCurrent ? (
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#141B33]">
                Agora
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Mídia (ou o relato como protagonista, quando não há) ──────── */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {video ? (
            /* CareVideoPlayer inteiro: card fechado sem <video> no DOM, e o
               elemento só nasce no toque. É daqui que vem a garantia de
               ausência de autoplay — não de uma regra repetida aqui.
               `variant="immersive"` só troca as cores do estado fechado; o
               default (timeline e tela do profissional) segue intocado.

               z-20 = ACIMA das zonas de toque: é isto que garante que o botão
               de play e, depois, os controles nativos do vídeo nunca sejam
               interceptados pela navegação lateral. */
            /* GATE-9-...-REFINE-004: o vídeo passou a ficar ABAIXO das zonas
               de toque, e não mais acima.

               No REFINE-003 ele precisava estar acima porque a área inteira
               era um botão "Reproduzir" — interceptá-la quebraria o play.
               Agora não há mais botão nenhum sobre o vídeo: ele já começa
               tocando, e o único controle é o de som, que sobe sozinho para
               `z-30` (dentro do player). Com isso a navegação lateral volta a
               valer sobre TODA a largura do vídeo, como já vale sobre a foto.

               Este wrapper fica sem `z-index` de propósito: um `z` aqui criaria
               contexto de empilhamento e prenderia o botão de som embaixo das
               zonas, que é exatamente o que a missão proíbe. */
            <div className="relative flex size-full items-center justify-center">
              <CareVideoPlayer
                media={video}
                variant="immersive"
                /* `key` por mídia: trocar de Momento DESMONTA o vídeo anterior
                   em vez de reaproveitar o elemento com outro `src`. É o que
                   garante que o anterior pare, que o novo comece mudo do zero,
                   e que voltar a um vídeo reinicie do começo — previsível, sem
                   estado residual de reprodução. */
                key={video.id}
              />
            </div>
          ) : fotoGrande && !fotoQuebrada ? (
            <FotoDoMomento foto={fotoGrande} aoQuebrar={() => setFotoQuebrada(true)} />
          ) : (
            /* Sem mídia (ou foto indisponível): o relato assume o lugar dela,
               grande e centralizado. Não existe card vazio esperando por uma
               foto que nunca vai chegar.

               `pointer-events-none` no container e `auto` só no parágrafo: o
               texto continua selecionável e rolável, mas o espaço VAZIO ao
               redor dele deixa o toque passar para as zonas de navegação.
               Sem isso, um momento só de texto seria o único que não avança
               com o toque lateral. */
            <div className="pointer-events-none relative z-20 flex max-h-full w-full flex-col items-center gap-4 overflow-y-auto px-6 py-6 text-center">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-white">
                <Icon className="size-6" aria-hidden />
              </span>
              <p className="pointer-events-auto text-base leading-relaxed font-medium text-balance break-words text-white">
                {update.content}
              </p>
            </div>
          )}

          {/*
            ── Navegação por toque nas laterais ──────────────────────────────

            QA físico do Vitor: com anterior/próximo só no rodapé, trocar de
            momento exigia procurar a seta. A expectativa real é a de Stories —
            tocar no lado da tela. Esta decisão SUBSTITUI a cautela do
            REFINE-002 contra zonas invisíveis: agora há evidência de uso e
            decisão explícita de produto.

            São `<button>` de verdade, com `aria-label` — não `<div>` com
            onClick. Isso mantém a navegação anunciável por leitor de tela e
            alcançável por teclado, além do ArrowLeft/ArrowRight que já existe.

            z-10: ficam ACIMA da foto (decorativa) e ABAIXO do vídeo e do
            parágrafo de texto. A ordem é o que resolve o conflito de toque —
            não uma lista de exceções que alguém teria de manter.

            Desabilitam nos limites: no primeiro momento não há lado esquerdo
            ativo, no último não há direito. Sem wrap, como antes.
          */}
          <button
            type="button"
            onClick={() => anterior !== null && onNavigate(anterior)}
            disabled={anterior === null}
            aria-label="Momento anterior"
            className="group absolute inset-y-0 left-0 z-10 w-[32%] cursor-default focus-visible:outline-none disabled:pointer-events-none"
          >
            {/* Seta discreta: aparece no hover (desktop). No celular não há
                hover e o toque já é a interação — o indicador seria enfeite. */}
            <span className="pointer-events-none absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ChevronLeft className="size-5" aria-hidden />
            </span>
          </button>
          <button
            type="button"
            onClick={() => proximo !== null && onNavigate(proximo)}
            disabled={proximo === null}
            aria-label="Próximo momento"
            className="group absolute inset-y-0 right-0 z-10 w-[32%] cursor-default focus-visible:outline-none disabled:pointer-events-none"
          >
            <span className="pointer-events-none absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </button>
        </div>

        {/* ── Miniaturas: só quando a atualização tem mais de uma foto ──── */}
        {photos.length > 1 && !video ? (
          <div className="flex shrink-0 justify-center gap-1.5 px-4 pt-3">
            {photos.map((foto, i) => (
              <button
                key={foto.id}
                type="button"
                onClick={() => {
                  setFotoAtiva(i)
                  setFotoQuebrada(false)
                }}
                aria-label={`Ver foto ${i + 1} de ${photos.length}`}
                aria-current={i === fotoAtiva}
                className={`size-1.5 rounded-full transition-colors ${
                  i === fotoAtiva ? "bg-white" : "bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        ) : null}

        {/* ── Relato (quando a mídia já ocupou o palco) ─────────────────── */}
        {temMidia ? (
          <div className="max-h-[30dvh] shrink-0 overflow-y-auto px-4 pt-3">
            <p className="text-sm leading-relaxed break-words text-white/90">
              {update.content}
            </p>
          </div>
        ) : null}

        {/*
          ── Rodapé: só orientação e a ponte para o histórico ──────────────

          Os dois botões circulares grandes de anterior/próximo saíram daqui
          (REFINE-003). Eles eram o mecanismo PRINCIPAL de navegação e
          dominavam o rodapé — obrigando a pessoa a sair da mídia, descer os
          olhos e mirar um alvo. A navegação passou para o toque lateral, na
          própria área da mídia; o rodapé volta a ser o que devia ser: onde
          estou, e como chegar ao registro completo.
        */}
        <div className="flex shrink-0 flex-col items-center gap-1 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* `aria-live`: navegar por toque lateral ou teclado não muda o
              foco, então sem isto um leitor de tela não anunciaria a troca. */}
          <span className="text-[11px] font-medium text-white/70" aria-live="polite">
            {momentPositionLabel(openIndex, total)}
          </span>
          <button
            type="button"
            onClick={() => {
              fechar()
              // Depois de fechar: a entrada da timeline continua sendo a
              // fonte de verdade, e é para lá que quem quer o registro
              // completo (com as fotos na galeria original) deve ir.
              requestAnimationFrame(() => {
                document.getElementById(careUpdateAnchorId(update.id))?.scrollIntoView({
                  behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                  block: "start",
                })
              })
            }}
            className="flex min-h-9 items-center gap-1 rounded-full px-3 text-[11px] font-medium text-white/60 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <ListTree className="size-3" aria-hidden />
            Ver no histórico
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
