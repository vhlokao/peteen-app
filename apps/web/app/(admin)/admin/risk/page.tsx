import { getAdminRiskAction } from "@/modules/backoffice/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { resolveRiskLevel } from "@/modules/antifraude/domain/risk-score"

const LEVEL_COLORS: Record<string, string> = {
  LOW:      "bg-green-100 text-green-700",
  MEDIUM:   "bg-yellow-100 text-yellow-700",
  HIGH:     "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
}

const LEVEL_LABELS: Record<string, string> = {
  LOW:      "Baixo risco",
  MEDIUM:   "Médio risco",
  HIGH:     "Alto risco",
  CRITICAL: "Crítico",
}

export default async function AdminRiskPage() {
  const result = await getAdminRiskAction()
  const rows = result.data ?? []

  const highRisk = rows.filter((r) => r.score > 50).length

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Índice de Risco"
        description="Pontuação de risco calculada em tempo real para cada profissional. Apenas monitoramento — nenhum bloqueio automático."
      />

      {/* Resumo */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Total avaliados</p>
          <p className="mt-1 text-2xl font-bold text-neutral-800">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-orange-500">Alto risco / Crítico</p>
          <p className="mt-1 text-2xl font-bold text-orange-700">{highRisk}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Score médio</p>
          <p className="mt-1 text-2xl font-bold text-neutral-800">
            {rows.length > 0
              ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
              : 0}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["#", "Profissional", "Cidade", "Score", "Nível"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Nenhum profissional cadastrado.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-xs text-neutral-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-neutral-800">
                  {row.displayName}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">{row.city}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          row.score > 80
                            ? "bg-red-500"
                            : row.score > 50
                            ? "bg-orange-400"
                            : row.score > 20
                            ? "bg-yellow-400"
                            : "bg-green-400"
                        }`}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-neutral-700">
                      {row.score}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[row.level] ?? ""}`}
                  >
                    {LEVEL_LABELS[row.level] ?? row.level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
