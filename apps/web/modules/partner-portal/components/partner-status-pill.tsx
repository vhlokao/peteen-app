import { cn } from "@/lib/utils"
import { RECOMMENDATION_TONE_CLASS, recommendationTone } from "../domain/status-display"

export function PartnerStatusPill({
  isActive,
  size = "md",
  className,
}: {
  isActive: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const tone = recommendationTone(isActive)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-[0.65rem]" : "px-3 py-1 text-xs",
        RECOMMENDATION_TONE_CLASS[tone],
        className
      )}
    >
      {isActive ? "Ativa" : "Inativa"}
    </span>
  )
}
