import Link from "next/link"
import type { LucideIcon } from "lucide-react"

type TutorCareCategoryCardProps = {
  label: string
  href: string
  icon: LucideIcon
}

export function TutorCareCategoryCard({ label, href, icon: Icon }: TutorCareCategoryCardProps) {
  return (
    <Link
      href={href}
      className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="text-[0.7rem] font-medium leading-tight text-foreground">{label}</span>
    </Link>
  )
}
