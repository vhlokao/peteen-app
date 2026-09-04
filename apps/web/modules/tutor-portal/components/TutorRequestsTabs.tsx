"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  tutorRequestsListHref,
  type TutorRequestsTab,
} from "../domain/request-list-tab"

const NAVY = "#1D2F6F"

type TutorRequestsTabsProps = {
  initialTab: TutorRequestsTab
  activeCount: number
  previousCount: number
  activeContent: ReactNode
  previousContent: ReactNode
}

/**
 * Segmented control — os dois conjuntos de dados já chegam prontos do
 * Server Component (page.tsx), esta troca só decide qual já foi buscado é
 * exibido. Nenhuma query nova ao trocar de aba.
 *
 * GATE-5-NAV-CONTEXT-001: a aba agora é espelhada em `?tab=` via
 * `router.replace` (sem novo item no histórico — é um filtro, não uma
 * página) para sobreviver a navegação para o detalhe, refresh e deep link.
 * `initialTab` vem do Server Component, que já leu `searchParams`.
 */
export function TutorRequestsTabs({
  initialTab,
  activeCount,
  previousCount,
  activeContent,
  previousContent,
}: TutorRequestsTabsProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TutorRequestsTab>(initialTab)

  const selectTab = (next: TutorRequestsTab) => {
    setTab(next)
    router.replace(tutorRequestsListHref(next), { scroll: false })
  }

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
          onClick={() => selectTab("active")}
          className={tabClass(tab === "active")}
          style={tab === "active" ? { background: NAVY } : undefined}
        >
          Ativos{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => selectTab("previous")}
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
