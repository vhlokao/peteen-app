import type { ReactNode } from "react"

type AdminPageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  count?: number
}

export function AdminPageHeader({
  title,
  description,
  actions,
  count,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {count != null && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
