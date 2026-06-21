import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type AdminMetricCardProps = {
  label: string
  value: number | string
  description?: string
  icon?: ReactNode
  variant?: "default" | "warning" | "success" | "destructive"
}

const VARIANT_STYLES = {
  default:     "bg-card border",
  warning:     "bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800",
  success:     "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800",
  destructive: "bg-red-50 border border-red-200 dark:bg-red-900/10 dark:border-red-800",
}

const VALUE_STYLES = {
  default:     "text-foreground",
  warning:     "text-amber-700 dark:text-amber-400",
  success:     "text-emerald-700 dark:text-emerald-400",
  destructive: "text-red-700 dark:text-red-400",
}

export function AdminMetricCard({
  label,
  value,
  description,
  icon,
  variant = "default",
}: AdminMetricCardProps) {
  return (
    <div className={cn("rounded-lg p-4", VARIANT_STYLES[variant])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", VALUE_STYLES[variant])}>
            {value}
          </p>
          {description && (
            <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 text-muted-foreground/60">{icon}</div>
        )}
      </div>
    </div>
  )
}
