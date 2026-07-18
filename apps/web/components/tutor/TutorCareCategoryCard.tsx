import Link from "next/link"
import type { LucideIcon } from "lucide-react"

const NAVY_SOFT = "#2C4893"

type TutorCareCategoryCardProps = {
  label: string
  href: string
  icon: LucideIcon
}

export function TutorCareCategoryCard({ label, href, icon: Icon }: TutorCareCategoryCardProps) {
  return (
    <Link
      href={href}
      className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-[18px] border border-border bg-card p-3.5 text-center transition-colors hover:border-primary/30"
    >
      <span
        className="flex size-10 items-center justify-center rounded-[13px]"
        style={{ background: "#E8EEF6", color: NAVY_SOFT }}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-[11.5px] font-semibold leading-tight text-foreground">{label}</span>
    </Link>
  )
}
