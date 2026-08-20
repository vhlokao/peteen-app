import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton do Diário de cuidado (tutor) — cabeçalho + entradas da timeline.
 */
export default function TutorDiarioLoading() {
  return (
    <div className="page-container space-y-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-6 w-48" />

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
