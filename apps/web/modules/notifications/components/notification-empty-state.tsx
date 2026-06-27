import { BellOff } from "lucide-react"

export function NotificationEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <BellOff className="size-5 text-muted-foreground" />
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
