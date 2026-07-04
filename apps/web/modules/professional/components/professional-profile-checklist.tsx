import { Check, X } from "lucide-react"

type ChecklistItem = {
  label: string
  done: boolean
}

/**
 * Checklist factual — cada item é um booleano real, sem percentual
 * inventado. Se um dado não puder ser verificado com segurança, ele
 * simplesmente não entra aqui.
 */
export function ProfessionalProfileChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Complete seu perfil
      </h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {item.done ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
