"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const NAVY = "#1D2F6F"

type TutorRequestsTabsProps = {
  activeCount: number
  previousCount: number
  activeContent: ReactNode
  previousContent: ReactNode
}

/**
 * Segmented control puramente visual — os dois conjuntos de dados já
 * chegam prontos do Server Component (page.tsx), esta troca só decide
 * qual já foi buscado é exibido. Nenhuma query nova, nenhum estado de
 * URL necessário (não há filtro a preservar em navegação/refresh).
 */
export function TutorRequestsTabs({
  activeCount,
  previousCount,
  activeContent,
  previousContent,
}: TutorRequestsTabsProps) {
  const [tab, setTab] = useState<"active" | "previous">("active")

  const tabClass = (isActive: boolean) =>
    cn(
      "flex-1 rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
      isActive ? "text-white shadow-sm" : "text-muted-foreground"
    )

  return (
    <div>
      <div className="mb-4 inline-flex w-full gap-1 rounded-full bg-muted/50 p-1 sm:w-auto">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={tabClass(tab === "active")}
          style={tab === "active" ? { background: NAVY } : undefined}
        >
          Ativos{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("previous")}
          className={tabClass(tab === "previous")}
          style={tab === "previous" ? { background: NAVY } : undefined}
        >
          Anteriores{previousCount > 0 ? ` (${previousCount})` : ""}
        </button>
      </div>

      {tab === "active" ? activeContent : previousContent}
    </div>
  )
}
