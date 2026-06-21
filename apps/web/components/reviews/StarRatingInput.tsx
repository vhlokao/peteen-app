"use client"

import { useState } from "react"
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

type StarRatingInputProps = {
  /** Nota selecionada (0 = sem seleção) */
  value: number
  onChange: (rating: number) => void
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}

const SIZE_CLASSES = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
} as const

const RATING_LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente!",
}

export function StarRatingInput({
  value,
  onChange,
  size = "md",
  disabled = false,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0)

  // Estrelas mostram o hover primeiro, fallback para valor selecionado
  const displayed = hovered || value

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Nota de 1 a 5 estrelas"
        className="flex items-center gap-1.5"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} estrela${star > 1 ? "s" : ""} — ${RATING_LABELS[star]}`}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => !disabled && setHovered(star)}
            onMouseLeave={() => !disabled && setHovered(0)}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault()
                onChange(Math.min(5, (value || 0) + 1))
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault()
                onChange(Math.max(1, (value || 1) - 1))
              }
            }}
            className={cn(
              "rounded transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              !disabled && "cursor-pointer hover:scale-110 active:scale-90",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <Star
              className={cn(
                SIZE_CLASSES[size],
                "transition-colors duration-100",
                star <= displayed
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>

      {/* Label semântico da nota selecionada */}
      <p
        className={cn(
          "h-5 text-sm font-medium transition-opacity",
          value > 0 ? "text-foreground opacity-100" : "opacity-0"
        )}
        aria-live="polite"
      >
        {RATING_LABELS[hovered || value] ?? ""}
      </p>
    </div>
  )
}
