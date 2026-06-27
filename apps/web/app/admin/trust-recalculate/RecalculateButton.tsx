"use client"

import { useState, useTransition } from "react"
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react"

import { recalculateAllTrustAction } from "@/modules/backoffice/application/actions"
import type { RecalculateReport } from "@/modules/trust-engine/application/recalculate-all-trust-scores"
import { Button } from "@/components/ui/button"

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition()
  const [report, setReport] = useState<RecalculateReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleRun() {
    setReport(null)
    setError(null)

    startTransition(async () => {
      const result = await recalculateAllTrustAction()
      if (!result.success || !result.report) {
        setError(result.error ?? "Erro ao recalcular índices de confiança.")
        return
      }
      setReport(result.report)
    })
  }

  return (
    <div className="space-y-6">
      <Button
        onClick={handleRun}
        disabled={isPending}
        variant="default"
        className="w-full sm:w-auto"
      >
        {isPending
          ? <><Loader2 className="mr-2 size-4 animate-spin" />Recalculando…</>
          : <><RefreshCw className="mr-2 size-4" />Recalcular todos os índices de confiança</>
        }
      </Button>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: report.total, color: "text-foreground" },
              { label: "Atualizados", value: report.success, color: "text-green-600 dark:text-green-400" },
              { label: "Falhas", value: report.failed, color: report.failed > 0 ? "text-destructive" : "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Concluído em {report.durationMs}ms
          </p>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Profissional</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Antes</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Depois</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.details.map((d) => (
                  <tr key={d.professionalId} className="bg-card hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="font-medium">{d.displayName}</span>
                      <span className="ml-1.5 font-mono text-[0.6rem] text-muted-foreground">
                        {d.professionalId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {d.previousScore.toFixed(1)}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${
                      d.newScore !== null && d.newScore > d.previousScore
                        ? "text-green-600 dark:text-green-400"
                        : d.newScore !== null && d.newScore < d.previousScore
                          ? "text-destructive"
                          : "text-foreground"
                    }`}>
                      {d.newScore !== null ? d.newScore.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {d.status === "updated" ? (
                        <CheckCircle2 className="mx-auto size-3.5 text-green-500" />
                      ) : (
                        <XCircle className="mx-auto size-3.5 text-destructive" aria-label={d.error} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
