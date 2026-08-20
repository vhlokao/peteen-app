import { Skeleton } from "@/components/shared/feedback/Skeleton"

/**
 * Skeleton do dashboard do tutor — mesma estrutura de `page.tsx` (hero,
 * próximo atendimento, pets, tipos de cuidado, rede de confiança), para não
 * saltar de layout quando o conteúdo real chega. Ver PRE-PILOT POLISH —
 * CRITICAL FLOW PERFORMANCE & RESILIENCE: a rota nunca teve nenhum feedback
 * de carregamento antes — era tela em branco até todas as queries do
 * Server Component resolverem.
 */
export default function TutorDashboardLoading() {
  return (
    <div className="page-container space-y-7 pb-4">
      <Skeleton className="h-28 w-full rounded-[24px]" />

      <section>
        <Skeleton className="mb-2.5 h-3 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-20 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>

      <section>
        <Skeleton className="mb-3 h-5 w-32" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-24 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>

      <section>
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    </div>
  )
}
