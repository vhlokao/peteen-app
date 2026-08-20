import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton da lista de solicitações do profissional — cabeçalho + abas +
 * grid de cards, mesma forma de `ProfessionalRequestCard`.
 */
export default function ProfessionalRequestsLoading() {
  return (
    <div className="page-container space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </header>

      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
