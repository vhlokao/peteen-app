"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type ProfessionalRequestsTabsProps = {
  newCount: number
  ongoingCount: number
  historyCount: number
  newContent: ReactNode
  ongoingContent: ReactNode
  historyContent: ReactNode
}

/**
 * Segmented control Novas/Em andamento/Histórico — os três conjuntos já
 * chegam prontos do Server Component (page.tsx), só decide qual exibir.
 * Nenhuma query nova, nenhum estado de URL necessário.
 */
export function ProfessionalRequestsTabs({
  newCount,
  ongoingCount,
  historyCount,
  newContent,
  ongoingContent,
  historyContent,
}: ProfessionalRequestsTabsProps) {
  const [tab, setTab] = useState<"new" | "ongoing" | "history">(newCount > 0 ? "new" : "ongoing")

  const tabClass = (isActive: boolean) =>
    cn(
      "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
    )

  return (
    <div>
      <div className="mb-4 flex w-full gap-1 rounded-full border border-border/70 bg-muted/40 p-1">
        <button type="button" onClick={() => setTab("new")} className={tabClass(tab === "new")}>
          Novas{newCount > 0 ? ` (${newCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("ongoing")}
          className={tabClass(tab === "ongoing")}
        >
          Em andamento{ongoingCount > 0 ? ` (${ongoingCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={tabClass(tab === "history")}
        >
          Histórico{historyCount > 0 ? ` (${historyCount})` : ""}
        </button>
      </div>

      {tab === "new" && newContent}
      {tab === "ongoing" && ongoingContent}
      {tab === "history" && historyContent}
    </div>
  )
}
