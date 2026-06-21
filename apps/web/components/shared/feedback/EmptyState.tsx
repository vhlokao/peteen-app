import type { ReactNode } from "react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

type EmptyStateAction = {
  label: string
  href: string
}

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
