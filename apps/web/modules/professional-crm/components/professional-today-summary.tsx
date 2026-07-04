import { CalendarCheck } from "lucide-react"

export function ProfessionalTodaySummary({ count }: { count: number }) {
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/8 to-primary/[0.03] p-4 shadow-[var(--shadow-card)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarCheck className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">
        {count === 0
          ? "Nenhum atendimento previsto para hoje."
          : count === 1
            ? "Você tem 1 atendimento hoje."
            : `Você tem ${count} atendimentos hoje.`}
      </p>
    </section>
  )
}
