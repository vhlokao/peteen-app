"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  professionalRequestsListHref,
  type ProfessionalRequestsTab,
} from "../domain/request-list-tab"

type ProfessionalRequestsTabsProps = {
  initialTab: ProfessionalRequestsTab
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
 * Nenhuma query nova ao trocar de aba.
 *
 * GATE-5-NAV-CONTEXT-001: mesmo padrão de Tutor Requests — a aba agora é
 * espelhada em `?tab=` via `router.replace` (sem novo item de histórico)
 * para sobreviver a navegação para o detalhe, refresh e deep link.
 * `initialTab` vem do Server Component, que já leu `searchParams`.
 */
export function ProfessionalRequestsTabs({
  initialTab,
  newCount,
  ongoingCount,
  historyCount,
  newContent,
  ongoingContent,
  historyContent,
}: ProfessionalRequestsTabsProps) {
  const router = useRouter()
  const [tab, setTab] = useState<ProfessionalRequestsTab>(initialTab)

  const selectTab = (next: ProfessionalRequestsTab) => {
    setTab(next)
    router.replace(professionalRequestsListHref(next), { scroll: false })
  }

  const tabClass = (isActive: boolean) =>
    cn(
      "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
    )

  return (
    <div>
      <div className="mb-4 flex w-full gap-1 rounded-full border border-border/70 bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => selectTab("new")}
          className={tabClass(tab === "new")}
        >
          Novas{newCount > 0 ? ` (${newCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => selectTab("ongoing")}
          className={tabClass(tab === "ongoing")}
        >
          Em andamento{ongoingCount > 0 ? ` (${ongoingCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => selectTab("history")}
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
