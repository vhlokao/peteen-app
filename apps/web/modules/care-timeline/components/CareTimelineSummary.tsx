"use client"

/**
 * CareTimelineSummary — o que a Request passa a mostrar no lugar da timeline
 * completa (Care Operations R0).
 *
 * POR QUE ESTE COMPONENTE EXISTE:
 *   A Request renderizava a timeline inteira inline, sem teto. Um atendimento
 *   longo com muitas atualizações transformava a seção numa parede de scroll
 *   encravada entre "Acompanhamento" e "Resumo", e a Request deixava de ser
 *   consultável. O diário completo mudou-se para rota própria; aqui fica só a
 *   resposta a "o que acabou de acontecer?".
 *
 * ORDEM — resumo e diário completo agora concordam: as duas mostram mais
 * RECENTE primeiro (por occurredAt). `updates` chega já nessa ordem —
 * `selectTimelineSummary` só RECORTA os primeiros `RESUMO_MAX`, nunca reordena
 * (ver domain/timeline-order.ts, a fonte única da regra).
 *
 * Antes as duas superfícies eram deliberadamente opostas (resumo recente
 * primeiro, diário cronológico do início para o fim) e este componente
 * invertia a lista recebida com `slice(-max).reverse()`. Essa suposição —
 * "a origem chega oldest-first" — ficou implícita aqui dentro; quando a ordem
 * de origem mudou para newest-first (o achado físico que motivou esta
 * mudança), o `.reverse()` inline teria voltado a mostrar as MAIS ANTIGAS no
 * resumo, silenciosamente. Extrair a decisão para o domínio é o que torna
 * esse tipo de acoplamento visível e testável.
 */

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { CARE_CATEGORY_LABELS, type CareUpdate } from "../domain/types"
import { CATEGORY_ICON, formatCareUpdateTime } from "./care-update-visuals"
import { selectTimelineSummary } from "../domain/timeline-order"

/** Teto do resumo. Acima disso é o diário completo que responde. */
const RESUMO_MAX = 2

export function CareTimelineSummary({
  updates,
  diaryHref,
  ctaLabel = "Abrir diário",
}: {
  /** Timeline completa, mais recente primeiro — o corte é feito aqui. */
  updates: CareUpdate[]
  diaryHref: string
  /**
   * Rótulo do CTA. Configurável porque a mesma tela pode ter um card principal
   * dizendo "Acompanhar atendimento" — dois botões com nomes diferentes para o
   * mesmo destino fazem o usuário achar que são coisas distintas. Quando existe
   * um CTA principal, este vira o secundário ("Ver diário completo").
   */
  ctaLabel?: string
}) {
  const total = updates.length
  const recentes = selectTimelineSummary(updates, RESUMO_MAX)

  return (
    <div className="flex flex-col gap-3">
      {total === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
          Nenhuma atualização ainda.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total === 1 ? "1 atualização" : `${total} atualizações`}
          </p>

          <ul className="flex flex-col gap-2">
            {recentes.map((update) => {
              const Icon = CATEGORY_ICON[update.category]
              return (
                <li
                  key={update.id}
                  className="flex gap-3 rounded-xl border border-border/70 bg-background/40 p-3"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-semibold text-foreground">
                        {CARE_CATEGORY_LABELS[update.category]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCareUpdateTime(update.occurredAt)}
                      </span>
                    </div>
                    {/* line-clamp: o resumo nunca cresce com o tamanho do texto —
                        o relato completo é responsabilidade do diário. */}
                    <p className="mt-0.5 line-clamp-2 break-words text-sm leading-relaxed text-foreground/90">
                      {update.content}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Link
        href={diaryHref}
        className="flex items-center justify-center gap-1 rounded-xl border border-border/70 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted/40"
      >
        {ctaLabel}
        <ChevronRight className="size-4" />
      </Link>
    </div>
  )
}
