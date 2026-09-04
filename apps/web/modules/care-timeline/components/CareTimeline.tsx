"use client"

/**
 * CareTimeline — visualização read-only da timeline de cuidado.
 *
 * O servidor busca (getCareTimelineAction) e passa `updates` já ordenados
 * MAIS RECENTE PRIMEIRO (por occurredAt — ver domain/timeline-order.ts). Quem
 * acompanha um atendimento em andamento quer a última notícia sem rolar até o
 * fim da lista. A formatação de horário é feita no client, no fuso do viewer
 * (decisão V0: armazenar UTC, renderizar local).
 */

import { CARE_CATEGORY_LABELS, type CareUpdate } from "../domain/types"
import { careUpdateAnchorId } from "../domain/care-moments"
import { CATEGORY_ICON, formatCareUpdateTime } from "./care-update-visuals"
import { CareMediaGallery } from "./CareMediaGallery"

export function CareTimeline({
  updates,
  emptyHint,
}: {
  updates: CareUpdate[]
  /**
   * Frase extra no estado vazio, específica de quem está lendo.
   *
   * Opcional porque as duas superfícies têm públicos opostos: para o TUTOR,
   * "nenhuma atualização" precisa explicar que o profissional ainda vai
   * publicar; para o PROFISSIONAL, que está justamente na tela onde publica,
   * a mesma frase seria ruído. Sem a prop, o comportamento é o de sempre.
   */
  emptyHint?: string
}) {
  if (updates.length === 0) {
    return (
      <div className="bg-muted/40 rounded-xl px-4 py-6 text-center">
        <p className="text-muted-foreground text-sm">Nenhuma atualização ainda.</p>
        {emptyHint ? (
          <p className="text-muted-foreground/80 mx-auto mt-1.5 max-w-xs text-xs leading-relaxed">
            {emptyHint}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {updates.map((update, posicao) => {
        const Icon = CATEGORY_ICON[update.category]
        return (
          <li
            key={update.id}
            /* Âncora dos Momentos do cuidado: a faixa acima rola até aqui e
               foca esta entrada. `tabIndex={-1}` a torna focável por script
               sem entrar na ordem de Tab; `scroll-mt-4` impede que ela encoste
               no topo da viewport depois do salto. Ambos são inertes quando a
               faixa não existe (superfície do profissional). */
            id={careUpdateAnchorId(update.id)}
            tabIndex={-1}
            className="border-border/70 bg-card focus-visible:ring-ring flex scroll-mt-4 gap-3 rounded-xl border p-3.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {CARE_CATEGORY_LABELS[update.category]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCareUpdateTime(update.occurredAt)}
                  {update.editedAt ? " · editado" : null}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {update.content}
              </p>
              {/* Fotos DEPOIS do relato: o texto é o núcleo da feature (é ele
                  que vale em disputa) e a imagem complementa. `media` já vem
                  do DTO seguro — sem storagePath, só signedUrl. */}
              {/* Só a entrada do TOPO carrega a primeira foto com prioridade:
                  com recent-first ela é a mais relevante e a única
                  garantidamente visível ao abrir. */}
              <CareMediaGallery media={update.media} prioridade={posicao === 0} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
