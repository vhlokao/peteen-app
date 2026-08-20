import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton da lista de solicitações do tutor — cabeçalho + abas + cards,
 * mesma forma dos `TutorRequestCard` reais para não saltar layout.
 */
export default function TutorRequestsLoading() {
  return (
    <div className="page-container space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </header>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
