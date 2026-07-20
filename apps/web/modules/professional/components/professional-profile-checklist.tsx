import { Check, Circle } from "lucide-react"

const CORAL = "#E07A5F"
const GREEN = "#40916C"

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
  const doneCount = items.filter((item) => item.done).length
  const total = items.length
  const complete = total > 0 && doneCount === total
  const accent = complete ? GREEN : CORAL

  return (
    <section
      className="rounded-2xl border p-5 shadow-[var(--shadow-card)]"
      style={{ borderColor: `${accent}33`, background: complete ? "#E7F1EC" : "#FBEDE8" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>
          {complete ? "Perfil completo!" : "Fortaleça seu perfil"}
        </h2>
        <span className="text-xs font-bold tabular-nums" style={{ color: accent }}>
          {doneCount}/{total}
        </span>
      </div>

      <div className="mb-4 flex gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-full"
            style={{ background: item.done ? accent : "#DDE3EC" }}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full"
              style={item.done ? { background: `${GREEN}22`, color: GREEN } : { color: "#B4B0A3" }}
            >
              {item.done ? <Check className="size-3" /> : <Circle className="size-3" />}
            </span>
            <span style={{ color: item.done ? "#1A1A1A" : "#8A897F" }}>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
