import { Skeleton } from "@/components/shared/feedback/Skeleton"

/** Skeleton da central de notificações — cabeçalho + barra de ações + itens. */
export default function NotificationsLoading() {
  return (
    <div className="page-container space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-52 max-w-[60%] rounded-md" />
      </div>

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-4">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
