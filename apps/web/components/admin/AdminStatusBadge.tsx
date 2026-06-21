import { cn } from "@/lib/utils"

// ── Request Status ─────────────────────────────────────────────────────────────

const REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING:                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACCEPTED:                 "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS:              "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  COMPLETED:                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED_BY_TUTOR:       "bg-muted text-muted-foreground",
  CANCELLED_BY_PROFESSIONAL:"bg-muted text-muted-foreground",
  DISPUTED:                 "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  EXPIRED:                  "bg-muted text-muted-foreground",
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING:                  "Pendente",
  ACCEPTED:                 "Aceito",
  IN_PROGRESS:              "Em andamento",
  COMPLETED:                "Concluído",
  CANCELLED_BY_TUTOR:       "Cancelado (tutor)",
  CANCELLED_BY_PROFESSIONAL:"Cancelado (pro)",
  DISPUTED:                 "Disputado",
  EXPIRED:                  "Expirado",
}

// ── Trust Level ────────────────────────────────────────────────────────────────

const TRUST_LEVEL_STYLES: Record<string, string> = {
  INITIAL:     "bg-muted text-muted-foreground",
  BUILDING:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ESTABLISHED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TRUSTED:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ELITE:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const TRUST_LEVEL_LABELS: Record<string, string> = {
  INITIAL:     "Inicial",
  BUILDING:    "Crescendo",
  ESTABLISHED: "Verificado",
  TRUSTED:     "Confiável",
  ELITE:       "Elite",
}

// ── Relationship Level ─────────────────────────────────────────────────────────

const REL_LEVEL_STYLES: Record<string, string> = {
  NEW:       "bg-muted text-muted-foreground",
  KNOWN:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  RECURRING: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  TRUSTED:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PARTNER:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const REL_LEVEL_LABELS: Record<string, string> = {
  NEW:       "Novo",
  KNOWN:     "Conhecido",
  RECURRING: "Recorrente",
  TRUSTED:   "Confiável",
  PARTNER:   "Parceiro",
}

// ── Componente genérico ────────────────────────────────────────────────────────

type AdminStatusBadgeProps = {
  type: "request" | "trust" | "relationship" | "role"
  value: string
}

export function AdminStatusBadge({ type, value }: AdminStatusBadgeProps) {
  let label = value
  let style = "bg-muted text-muted-foreground"

  if (type === "request") {
    label = REQUEST_STATUS_LABELS[value] ?? value
    style = REQUEST_STATUS_STYLES[value] ?? style
  } else if (type === "trust") {
    label = TRUST_LEVEL_LABELS[value] ?? value
    style = TRUST_LEVEL_STYLES[value] ?? style
  } else if (type === "relationship") {
    label = REL_LEVEL_LABELS[value] ?? value
    style = REL_LEVEL_STYLES[value] ?? style
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
        style
      )}
    >
      {label}
    </span>
  )
}
