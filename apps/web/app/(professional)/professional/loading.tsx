import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton do dashboard do profissional — header + banner de status +
 * cards de atenção/próximo atendimento/ações/métricas, mesma forma da
 * tela real.
 */
export default function ProfessionalDashboardLoading() {
  return (
    <div className="page-container max-w-4xl space-y-6 pb-4">
      <Skeleton className="h-24 w-full rounded-[24px]" />
      <Skeleton className="h-16 w-full rounded-2xl" />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
