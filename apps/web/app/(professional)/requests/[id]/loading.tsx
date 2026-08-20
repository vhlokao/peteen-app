import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton do detalhe de uma solicitação (profissional) — resumo + linha
 * do tempo + bloco de ação, mesma forma da tela real.
 */
export default function ProfessionalRequestDetailLoading() {
  return (
    <div className="page-container space-y-6">
      <Skeleton className="h-5 w-24" />

      <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <Skeleton className="h-40 w-full rounded-2xl" />

      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  )
}
