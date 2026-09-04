import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton do Diário de cuidado (tutor).
 *
 * GATE-9-CARE-TIMELINE-UX-001: o esqueleto agora prevê a faixa de Momentos
 * acima da timeline. Um skeleton que não corresponde ao layout real produz
 * exatamente o salto que ele existe para evitar — a página "pula" quando o
 * conteúdo chega e empurra tudo para baixo.
 */
export default function TutorDiarioLoading() {
  return (
    <div className="page-container max-w-2xl space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Faixa de Momentos — cards 4:5, mesma largura do componente real. */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-44" />
        <div className="flex gap-2.5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] w-[132px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="border-border space-y-4 rounded-2xl border p-5">
        <Skeleton className="h-3 w-36" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-border/70 space-y-2 rounded-xl border p-3.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
