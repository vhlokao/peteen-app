import type { Metadata } from "next"
import { MapPin, TrendingUp } from "lucide-react"

import { requireAdmin } from "@/modules/identity/application/get-session"
import {
  getAdminGrowthOverviewAction,
  getAdminRegionGrowthRowsAction,
  getAdminNeighborhoodHeatmapAction,
  getAdminHeatmapCitiesAction,
  getRegionsForSelectAction,
} from "@/modules/growth-engine/application/actions"
import { HEALTH_CLASSIFICATION_LABELS } from "@/modules/growth-engine/domain/constants"
import { renderStarRating } from "@/modules/growth-engine/domain/scoring"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { CreateTerritoryForms } from "@/components/admin/CreateTerritoryForms"

export const metadata: Metadata = { title: "Admin — Expansão local" }
export const dynamic = "force-dynamic"

type SearchParams = Promise<{ city?: string }>

const CLASSIFICATION_COLORS: Record<string, string> = {
  INICIAR:   "text-muted-foreground",
  CRESCENDO: "text-blue-600 dark:text-blue-400",
  FORTE:     "text-green-600 dark:text-green-400",
  DOMINANTE: "text-amber-600 dark:text-amber-400",
}

export default async function AdminGrowthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()

  const sp = await searchParams
  const cityFilter = sp.city?.trim() || ""

  const [overview, regionRows, heatmap, heatmapCities, regions] = await Promise.all([
    getAdminGrowthOverviewAction(),
    getAdminRegionGrowthRowsAction(),
    getAdminNeighborhoodHeatmapAction(cityFilter || undefined),
    getAdminHeatmapCitiesAction(),
    getRegionsForSelectAction(),
  ])

  const heatmapByCity = heatmap.reduce<Record<string, typeof heatmap>>((acc, row) => {
    const key = row.city
    if (!acc[key]) acc[key] = []
    acc[key]!.push(row)
    return acc
  }, {})

  return (
    <div>
      <AdminPageHeader
        title="Expansão local"
        description="Inteligência territorial — bairro → região → cidade. Onde concentrar aquisição e expansão."
      />

      {/* Cards overview */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-foreground">
            {overview.citiesMonitored}
          </p>
          <p className="text-xs text-muted-foreground">Cidades monitoradas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-foreground">
            {overview.neighborhoodsMonitored}
          </p>
          <p className="text-xs text-muted-foreground">Bairros monitorados</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-black tabular-nums text-foreground">
            {overview.regionsMonitored}
          </p>
          <p className="text-xs text-muted-foreground">Regiões monitoradas</p>
        </div>
      </div>

      <div className="mb-6">
        <CreateTerritoryForms regions={regions} />
      </div>

      {/* Tabela de regiões */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="size-4" />
          Regiões — ordenadas por índice de saúde
        </h2>

        {regionRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma região cadastrada. Crie regiões e bairros acima para iniciar o monitoramento.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {[
                    "Cidade", "Região", "Profissionais", "Tutores", "Solicitações",
                    "Recorrência %", "Confiança média", "Índice de saúde", "Classificação",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {regionRows.map((row) => (
                  <tr key={row.regionId} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-foreground">{row.city}</td>
                    <td className="px-4 py-3 font-medium">{row.regionName}</td>
                    <td className="px-4 py-3 tabular-nums">{row.professionalCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.tutorCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.requestCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.recurrenceAvg}%</td>
                    <td className="px-4 py-3 tabular-nums">{row.trustAvg}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-primary">{row.healthScore}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={CLASSIFICATION_COLORS[row.classification] ?? ""}>
                        {HEALTH_CLASSIFICATION_LABELS[row.classification]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Heatmap textual */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="size-4" />
          Heatmap textual — bairros
        </h2>

        {heatmapCities.length > 0 && (
          <form method="GET" className="mb-4 flex flex-wrap items-center gap-3">
            <select
              name="city"
              defaultValue={cityFilter}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Todas as cidades</option>
              {heatmapCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Filtrar
            </button>
            {cityFilter && (
              <a href="/admin/growth" className="text-xs text-muted-foreground underline">
                Limpar
              </a>
            )}
          </form>
        )}

        {Object.keys(heatmapByCity).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Cadastre bairros para visualizar o heatmap territorial.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(heatmapByCity).map(([city, rows]) => (
              <div key={city} className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-3 font-semibold text-foreground">{city}</p>
                <ul className="space-y-1.5 font-mono text-sm">
                  {rows.map((r) => (
                    <li key={r.neighborhoodId} className="flex items-center justify-between gap-4">
                      <span className="text-amber-500">{renderStarRating(r.starRating)}</span>
                      <span className="flex-1 text-foreground">{r.neighborhoodName}</span>
                      <span className="text-xs text-muted-foreground">HS {r.healthScore}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
