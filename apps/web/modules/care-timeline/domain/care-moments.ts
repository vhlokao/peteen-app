/**
 * Módulo: care-timeline
 * Camada: domain — seleção e apresentação dos "Momentos do cuidado".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA CAMADA É — E O QUE ELA NÃO É
 *
 * GATE-9-CARE-TIMELINE-UX-001: o Diário já era funcional e completo, mas lia
 * como um log. O tutor abre essa tela para responder uma pergunta emocional —
 * "meu pet está sendo cuidado agora?" — e precisava ler parágrafos para
 * responder. Os Momentos são uma camada de LEITURA sobre as MESMAS
 * atualizações: nada é criado, nada é duplicado, nada expira.
 *
 * Um "momento" NÃO é um registro novo. É a projeção visual de um `CareUpdate`
 * que já existe: a categoria vira o título, `occurredAt` vira o horário, e a
 * mídia (quando existe) vira a capa. Por isso este módulo não tem escrita, não
 * tem schema e não toca no banco — ele só decide o que aparece e em que forma.
 *
 * A timeline detalhada continua sendo a FONTE DE VERDADE e continua completa
 * logo abaixo: os Momentos são um índice escaneável dela, não um substituto.
 * Tocar num momento leva à entrada correspondente — em vez de abrir uma
 * segunda superfície de conteúdo que precisaria ser mantida em paralelo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORDEM: A MESMA DA TIMELINE, DE PROPÓSITO
 *
 * Mais recente primeiro, exatamente como `timeline-order.ts` já definiu para o
 * Diário e para o resumo. A tentação de fazer a faixa horizontal correr
 * "início → fim" (como uma narrativa) existe, mas jogaria o momento MAIS
 * RECENTE para fora da tela, atrás de scroll — justamente o dado que responde
 * "o que está acontecendo agora", que é a razão desta tela existir. Duas ordens
 * concorrentes na mesma página também é o tipo de divergência que este módulo
 * já pagou caro para eliminar (ver o comentário de `CareTimelineSummary`).
 *
 * Este módulo NUNCA reordena: recebe a lista já newest-first (contrato de
 * `getCareTimeline`) e só recorta/anota — mesma disciplina de
 * `selectTimelineSummary`.
 */

import type { CareMediaView, CareUpdate } from "./types.ts"

/**
 * Teto de momentos na faixa horizontal.
 *
 * Limita a FAIXA, nunca a timeline: um atendimento longo continua com todas as
 * atualizações logo abaixo, sem corte. O teto existe por performance em
 * celular — cada momento com foto carrega uma miniatura, e uma faixa sem teto
 * num atendimento de dia inteiro viraria dezenas de imagens carregadas de uma
 * vez, para uma faixa que a pessoa provavelmente vai rolar só até o meio.
 */
export const CARE_MOMENTS_MAX = 12

/**
 * Capa do momento — o que domina visualmente o card.
 *
 * VIDEO é um tipo próprio, e não "PHOTO com um play em cima", porque não existe
 * miniatura de vídeo neste produto (gerar frame exigiria ffmpeg no servidor,
 * explicitamente fora de escopo — ver CareVideoPlayer). O card de vídeo se
 * apresenta pelo que é, sem fingir uma prévia que não pode cumprir.
 */
export type CareMomentCover =
  | { kind: "PHOTO"; media: CareMediaView }
  | { kind: "VIDEO"; media: CareMediaView }
  | { kind: "TEXT" }

export type CareMoment = {
  update: CareUpdate
  cover: CareMomentCover
  /**
   * Este é o momento que está acontecendo AGORA.
   *
   * Verdadeiro só para o mais recente E só enquanto o atendimento está
   * IN_PROGRESS. Num atendimento concluído nenhum momento é "agora" — o que
   * aconteceu, aconteceu; marcar o último como atual mentiria sobre o estado.
   */
  isCurrent: boolean
}

/**
 * Qual mídia representa o momento.
 *
 * Foto tem precedência sobre vídeo porque só a foto tem miniatura assinada —
 * ela produz um card com conteúdo visível de verdade, enquanto o de vídeo é
 * necessariamente um convite ("assista"). Na prática o contrato V0 publica
 * vídeo sozinho, então a precedência quase nunca desempata nada; ela existe
 * para o caso misto não depender da ordem em que o array chegou.
 */
export function resolveCareMomentCover(update: CareUpdate): CareMomentCover {
  const foto = update.media.find((m) => m.type === "PHOTO")
  if (foto) return { kind: "PHOTO", media: foto }

  const video = update.media.find((m) => m.type === "VIDEO")
  if (video) return { kind: "VIDEO", media: video }

  return { kind: "TEXT" }
}

/**
 * Projeta as atualizações em momentos, preservando a ordem recebida.
 *
 * `updatesNewestFirst` já vem ordenado por `getCareTimeline` — esta função não
 * reordena (mesma pré-condição, e mesma razão, de `selectTimelineSummary`).
 */
export function selectCareMoments(
  updatesNewestFirst: CareUpdate[],
  options: { isInProgress: boolean; max?: number }
): CareMoment[] {
  const max = options.max ?? CARE_MOMENTS_MAX

  return updatesNewestFirst.slice(0, max).map((update, indice) => ({
    update,
    cover: resolveCareMomentCover(update),
    isCurrent: indice === 0 && options.isInProgress,
  }))
}

/**
 * Id do elemento da timeline correspondente a uma atualização.
 *
 * Vive no domínio porque é um CONTRATO entre dois componentes: a faixa de
 * momentos usa para encontrar o destino, a timeline usa para se anunciar. Uma
 * string montada à mão dos dois lados quebraria em silêncio no dia em que
 * alguém mudasse o prefixo em só um deles — e o sintoma seria um clique que
 * não faz nada, que ninguém percebe até o piloto.
 */
export function careUpdateAnchorId(updateId: string): string {
  return `care-update-${updateId}`
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZADOR IMERSIVO — GATE-9-CARE-TIMELINE-UX-REFINE-002
//
// A faixa deixou de ser só um atalho: tocar num momento agora ABRE o momento em
// tela cheia. Toda a lógica de "qual momento estou vendo, o que vem antes e
// depois, e o que preciso carregar" mora aqui, fora do React — é o que permite
// testar navegação e limites sem montar DOM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O que o visualizador mostra de mídia, já separado por tipo.
 *
 * A timeline permite até 3 fotos por atualização (CARE_UPDATE_MAX_MEDIA); a
 * CAPA da faixa usa só a primeira, mas o visualizador mostra TODAS — esconder
 * as outras duas seria perder conteúdo que o profissional publicou, e a regra
 * do gate é que nada suma.
 *
 * `video` é separado porque tem superfície própria (CareVideoPlayer) e contrato
 * de rede próprio: nenhum elemento montado antes do gesto.
 */
export type CareMomentMedia = {
  photos: CareMediaView[]
  video: CareMediaView | null
}

export function resolveCareMomentMedia(update: CareUpdate): CareMomentMedia {
  return {
    photos: update.media.filter((m) => m.type === "PHOTO"),
    video: update.media.find((m) => m.type === "VIDEO") ?? null,
  }
}

/**
 * Índice válido dentro da lista, ou `null` quando não há para onde ir.
 *
 * Devolver `null` no limite — em vez de dar a volta (wrap) — é decisão de UX:
 * numa sequência cronológica, pular do último de volta para o primeiro faz a
 * pessoa perder a noção de onde está. O botão simplesmente desabilita, que é
 * um limite visível em vez de um teletransporte silencioso.
 */
export function nextMomentIndex(current: number, total: number): number | null {
  if (total <= 0) return null
  const proximo = current + 1
  return proximo < total ? proximo : null
}

export function previousMomentIndex(current: number, total: number): number | null {
  if (total <= 0) return null
  const anterior = current - 1
  return anterior >= 0 ? anterior : null
}

/**
 * Normaliza um índice recebido de fora (clique, teclado, estado antigo) para
 * algo que a lista realmente contém. `null` quando a lista está vazia.
 *
 * Existe porque a lista pode ENCOLHER embaixo do visualizador aberto: o Diário
 * tem auto-refresh (ActiveRequestAutoRefresh) e um update pode ser removido
 * pelo profissional dentro da janela de edição. Sem isto, o índice apontaria
 * para fora do array e o visualizador renderizaria `undefined`.
 */
export function clampMomentIndex(index: number, total: number): number | null {
  if (total <= 0) return null
  if (index < 0) return 0
  if (index >= total) return total - 1
  return index
}

/**
 * Vizinhos que valem pré-carregar quando um momento está aberto.
 *
 * Só os IMEDIATAMENTE adjacentes, e só eles: pré-carregar a lista inteira
 * desfaria a economia de rede que o Diário inteiro persegue (miniaturas de
 * 288px na faixa, 1600px só no que se abre). Em 4G, baixar 12 fotos grandes
 * porque a pessoa abriu uma é exatamente o custo que este produto evita.
 *
 * Quem consome usa isto só para FOTO — vídeo nunca é pré-carregado.
 */
export function neighborPreloadIndexes(current: number, total: number): number[] {
  return [previousMomentIndex(current, total), nextMomentIndex(current, total)].filter(
    (i): i is number => i !== null
  )
}

/** Rótulo de posição — orientação simples, sem inventar contagem regressiva. */
export function momentPositionLabel(index: number, total: number): string {
  return `${index + 1} de ${total}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSO DOS SEGMENTOS — GATE-9-CARE-TIMELINE-UX-REFINE-005
//
// Os segmentos do topo deixaram de ser só posição e passaram a mostrar quanto
// do Momento já passou. A regra de preenchimento vive aqui, fora do React,
// porque é ela que o teste consegue exercitar sem montar DOM nem vídeo.
//
// ATENÇÃO: barra de progresso NÃO é autorização para avançar sozinho. Este
// gate para em 100% e espera — auto-advance é decisão de produto separada.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Duração visual de um Momento SEM vídeo (foto ou só texto).
 *
 * 7s é tempo de leitura calmo para um relato curto, não um cronômetro
 * apertando a pessoa. Só governa a barra — nada acontece ao chegar ao fim.
 */
export const MOMENT_VISUAL_DURATION_MS = 7000

/** Mantém uma fração dentro de 0..1, tolerando NaN/Infinity vindos de mídia. */
export function clampProgressFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

/**
 * Progresso vindo do próprio vídeo.
 *
 * `duration` é `NaN` até os metadados chegarem e pode ser `Infinity` em
 * stream sem duração conhecida — nos dois casos a barra fica em 0 em vez de
 * FINGIR progresso, que é o que a missão pede para buffering/erro.
 */
export function videoProgressFraction(currentTime: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return clampProgressFraction(currentTime / duration)
}

/**
 * Quanto o segmento `segmentIndex` deve aparecer preenchido.
 *
 * Anteriores completos, atual conforme o progresso real, seguintes vazios —
 * a leitura de "onde estou na sequência" que os segmentos estáticos não
 * davam.
 */
export function segmentFill(
  segmentIndex: number,
  currentIndex: number,
  currentFraction: number
): number {
  if (segmentIndex < currentIndex) return 1
  if (segmentIndex > currentIndex) return 0
  return clampProgressFraction(currentFraction)
}
