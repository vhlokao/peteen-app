"use client"

/**
 * CareMoments — a faixa "Momentos do cuidado", acima da timeline detalhada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PROBLEMA DE UX QUE ISTO RESOLVE
 *
 * O Diário era completo e correto, mas lia como um log: para saber "meu pet
 * está bem agora?", o tutor precisava ler parágrafos. As fotos — o conteúdo
 * mais tranquilizador que existe nesta tela — apareciam como três miniaturas
 * de 96px no rodapé de cada entrada de texto.
 *
 * Esta faixa inverte a hierarquia para uma leitura de 3 segundos: capa visual
 * grande, título curto (a categoria), horário, e um marcador claro de "agora".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NÃO É UM SEGUNDO FEED — É UM ÍNDICE
 *
 * Um momento não carrega conteúdo que a timeline não tenha: tocar num card
 * ROLA ATÉ a entrada correspondente e a foca. Isso é deliberado — abrir um
 * visualizador próprio criaria uma segunda superfície de leitura para o mesmo
 * dado, com o próprio lightbox, o próprio tratamento de erro e a própria
 * chance de divergir da timeline. A timeline continua sendo a fonte de
 * verdade, e a faixa é a forma rápida de chegar até o ponto certo dela.
 *
 * Nada expira, nada é escondido, nada é criado: os momentos SÃO as
 * atualizações que o profissional já publicou uma vez.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REDE: A FAIXA NÃO ADICIONA PESO
 *
 * Fotos usam a MESMA miniatura assinada de 288px que a timeline já baixa
 * (`resolveTimelineImageSrc`) — mesma URL, então o browser deduplica e a faixa
 * não custa uma segunda transferência. Vídeo NÃO monta `<video>` aqui, pelo
 * mesmo contrato do CareVideoPlayer: antes do gesto não existe elemento, não
 * há `preload`, não há tráfego de mídia. Não há autoplay em lugar nenhum.
 */

import { useState } from "react"
import { ImageOff, Play } from "lucide-react"

import { CARE_CATEGORY_LABELS, type CareUpdate } from "../domain/types"
import {
  careUpdateAnchorId,
  selectCareMoments,
  type CareMoment,
} from "../domain/care-moments"
import { CATEGORY_ICON, formatCareUpdateTime } from "./care-update-visuals"
import { imagemChegouQuebrada } from "../domain/media-display"
import {
  CARE_MEDIA_THUMBNAIL_PX,
  resolveTimelineImageSrc,
} from "@/lib/storage/care-media-transform"

/**
 * Leva a pessoa até a entrada completa e devolve o foco lá.
 *
 * `preventScroll` no `focus()` porque o scroll já foi feito com a animação
 * certa logo acima — sem isso o browser daria um segundo salto, instantâneo,
 * desfazendo o movimento suave.
 *
 * `prefers-reduced-motion` é consultado aqui (e não só no CSS) porque
 * `scrollIntoView({ behavior: "smooth" })` NÃO respeita a preferência
 * sozinho: é uma API de script, fora do alcance da media query.
 */
function irParaAtualizacao(updateId: string) {
  const alvo = document.getElementById(careUpdateAnchorId(updateId))
  if (!alvo) return

  const preferReduzido =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  alvo.scrollIntoView({
    behavior: preferReduzido ? "auto" : "smooth",
    block: "start",
  })
  // O destino é um <li tabIndex={-1}>: focável por script, fora da ordem de
  // Tab. Sem isto, quem navega por teclado ou leitor de tela seria rolado
  // até a entrada mas continuaria com o foco no card — e o próximo Tab
  // voltaria para a faixa, não para o conteúdo que acabou de pedir.
  alvo.focus({ preventScroll: true })
}

/** Rótulo acessível completo do card — o card visual é propositalmente curto. */
function rotuloDoMomento(momento: CareMoment): string {
  const categoria = CARE_CATEGORY_LABELS[momento.update.category]
  const horario = formatCareUpdateTime(momento.update.occurredAt)
  const agora = momento.isCurrent ? "Momento atual. " : ""
  return `${agora}${categoria}, ${horario}. Ver detalhes desta atualização.`
}

function BadgeAgora() {
  return (
    <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
      {/* `motion-safe:` — quem pediu menos movimento no sistema recebe o mesmo
          ponto, parado. O badge já comunica sozinho; a pulsação é reforço. */}
      <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden />
      Agora
    </span>
  )
}

function LegendaDoCard({
  momento,
  sobreMidia,
}: {
  momento: CareMoment
  /** Sobre foto/vídeo o texto precisa de scrim; sobre card claro, não. */
  sobreMidia: boolean
}) {
  const categoria = CARE_CATEGORY_LABELS[momento.update.category]
  const horario = formatCareUpdateTime(momento.update.occurredAt)

  if (sobreMidia) {
    return (
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2.5 pb-2 pt-6 text-left">
        <span className="truncate text-xs font-bold text-white">{categoria}</span>
        <span className="truncate text-[10px] font-medium text-white/85">{horario}</span>
      </span>
    )
  }

  return (
    <span className="flex flex-col gap-0.5 px-2.5 pb-2 text-left">
      <span className="text-foreground truncate text-xs font-bold">{categoria}</span>
      <span className="text-muted-foreground truncate text-[10px] font-medium">{horario}</span>
    </span>
  )
}

function CardMomento({ momento }: { momento: CareMoment }) {
  const [midiaQuebrada, setMidiaQuebrada] = useState(false)
  const Icon = CATEGORY_ICON[momento.update.category]

  const cover = momento.cover
  // Foto que falhou ao carregar cai para a apresentação de TEXTO — o relato
  // continua sendo o núcleo do registro, então o momento nunca vira um
  // retângulo vazio. Mesmo princípio do fallback da grade da timeline.
  const mostraFoto = cover.kind === "PHOTO" && !midiaQuebrada
  const mostraVideo = cover.kind === "VIDEO"

  return (
    <li className="snap-start">
      <button
        type="button"
        onClick={() => irParaAtualizacao(momento.update.id)}
        aria-label={rotuloDoMomento(momento)}
        className={`focus-visible:ring-ring relative flex aspect-[4/5] w-[132px] shrink-0 flex-col justify-end overflow-hidden rounded-2xl border transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] ${
          momento.isCurrent ? "border-primary/70 ring-primary/15 ring-2" : "border-border/70"
        } ${mostraFoto || mostraVideo ? "bg-muted" : "bg-card"}`}
      >
        {momento.isCurrent ? <BadgeAgora /> : null}

        {mostraFoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              /* A MESMA miniatura de 288px que a timeline abaixo já usa —
                 mesma URL assinada, então o browser serve as duas com uma
                 transferência só. */
              src={resolveTimelineImageSrc(cover.media)}
              width={CARE_MEDIA_THUMBNAIL_PX}
              height={CARE_MEDIA_THUMBNAIL_PX}
              alt=""
              /* Decorativo de propósito: o `aria-label` do botão já descreve o
                 momento inteiro (categoria + horário + ação). Um alt genérico
                 aqui faria o leitor de tela anunciar a mesma coisa duas vezes. */
              aria-hidden
              loading="lazy"
              decoding="async"
              ref={(node) => {
                if (node && imagemChegouQuebrada(node)) setMidiaQuebrada(true)
              }}
              onError={() => setMidiaQuebrada(true)}
              className="absolute inset-0 size-full object-cover"
            />
            <LegendaDoCard momento={momento} sobreMidia />
          </>
        ) : mostraVideo ? (
          <>
            {/* Sem <video>, sem poster, sem prévia falsa: o card de vídeo é um
                convite explícito, igual ao card fechado do CareVideoPlayer. */}
            <span className="bg-foreground/[0.06] absolute inset-0 grid place-items-center">
              <span className="bg-background/90 ring-border/50 grid size-11 place-items-center rounded-full shadow-sm ring-1">
                <Play className="fill-foreground text-foreground size-4 translate-x-0.5" aria-hidden />
              </span>
            </span>
            <LegendaDoCard momento={momento} sobreMidia={false} />
          </>
        ) : (
          <>
            <span className="flex flex-1 flex-col gap-1.5 px-2.5 pt-3">
              <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-lg">
                {midiaQuebrada ? (
                  <ImageOff className="size-4" aria-hidden />
                ) : (
                  <Icon className="size-4" aria-hidden />
                )}
              </span>
              {/* O relato aparece aqui — sem mídia, é ele que faz o momento
                  valer como card. line-clamp mantém todos os cards do mesmo
                  tamanho, e o texto completo está a um toque de distância. */}
              <span className="text-foreground/80 line-clamp-3 text-left text-[11px] leading-snug break-words">
                {momento.update.content}
              </span>
            </span>
            <LegendaDoCard momento={momento} sobreMidia={false} />
          </>
        )}
      </button>
    </li>
  )
}

export function CareMoments({
  updates,
  isInProgress,
}: {
  /** Timeline completa, mais recente primeiro — o recorte acontece no domínio. */
  updates: CareUpdate[]
  /** O atendimento ainda está acontecendo? Define o marcador "Agora". */
  isInProgress: boolean
}) {
  const momentos = selectCareMoments(updates, { isInProgress })

  // Sem atualização não há momento nenhum — a faixa some por completo em vez
  // de mostrar um cabeçalho vazio. O estado vazio é responsabilidade de quem
  // renderiza a timeline abaixo, que já o trata.
  if (momentos.length === 0) return null

  const total = updates.length
  const recortada = total > momentos.length

  return (
    <section aria-labelledby="care-moments-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="care-moments-title"
          className="text-muted-foreground text-xs font-semibold tracking-widest uppercase"
        >
          Momentos do cuidado
        </h2>
        {/* "12 de 20 momentos" quando há corte, e não "20 momentos · 12 mais
            recentes": a versão longa empurrava o título para uma segunda linha
            num aparelho de 375px. Diz a mesma coisa — quantos aparecem e
            quantos existem — na metade do espaço. */}
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {recortada
            ? `${momentos.length} de ${total} momentos`
            : total === 1
              ? "1 momento"
              : `${total} momentos`}
        </p>
      </div>

      {/*
        A faixa SANGRA até a borda do container e o padding devolve o
        alinhamento do primeiro card com o resto da coluna. É o que faz o
        último card aparecer cortado na borda — o sinal visual de que há mais
        conteúdo à direita, sem precisar de setas.

        O valor vem de `--page-padding-x`, o MESMO token que `.page-container`
        usa, e não de um `-mx-5` fixo: o token muda por breakpoint
        (1rem → 1.5rem → 2rem, ver styles/tokens.css). Medido com número fixo,
        a sangria passava 4px do container no celular e a PÁGINA INTEIRA ganhava
        scroll horizontal — exatamente o overflow que este gate não pode
        introduzir. Com o token, o encaixe é exato em todos os tamanhos.

        `overscroll-x-contain` impede que o fim da faixa acione o gesto de
        voltar do browser no iOS.
      */}
      <ul className="mx-[calc(var(--page-padding-x)*-1)] flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-[var(--page-padding-x)] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {momentos.map((momento) => (
          <CardMomento key={momento.update.id} momento={momento} />
        ))}
      </ul>
    </section>
  )
}
