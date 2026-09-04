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
