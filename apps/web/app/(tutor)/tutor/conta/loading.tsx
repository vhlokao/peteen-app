import { Skeleton } from "@/components/shared/feedback/Skeleton"

/** Skeleton de Minha conta — cabeçalho, identidade e grupos de configuração. */
export default function ContaLoading() {
  return (
    <div className="page-container max-w-2xl space-y-6 pb-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="flex items-center gap-3.5 rounded-2xl border border-border p-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-48 max-w-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>

      {[0, 1].map((grupo) => (
        <div key={grupo} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ))}

      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}
