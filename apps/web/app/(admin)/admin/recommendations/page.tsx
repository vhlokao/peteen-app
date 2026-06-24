/**
 * /admin/recommendations — Motor de Recomendações (Backoffice)
 *
 * Exibe todos os profissionais com seu score de recomendação calculado
 * sem contexto de tutor — mostra as métricas internas (qualidade intrínseca).
 *
 * Uso: monitorar quais profissionais serão mais recomendados, entender
 * os fatores que influenciam o motor e identificar oportunidades de melhoria.
 */

import type { Metadata } from "next"
import { getAdminRecommendationsAction } from "@/modules/backoffice/application/actions"

export const metadata: Metadata = {
  title: "Recomendações — Admin",
}

const SCORE_BADGE = (score: number) => {
  if (score >= 50) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (score >= 25) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return "bg-muted text-muted-foreground"
}

export default async function AdminRecommendationsPage() {
  const professionals = await getAdminRecommendationsAction()

  return (
    <div className="max-w-5xl">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Recomendações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Score calculado sem contexto de tutor — métricas internas de cada profissional.
          Quanto maior o score, mais ele tende a aparecer nos blocos de Discovery.
        </p>
      </div>

      {/* Legenda dos fatores */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Fatores:</span>
        <span>Cidade +20</span>
        <span>·</span>
        <span>Serviço +15</span>
        <span>·</span>
        <span>Índice de Confiança +25</span>
        <span>·</span>
        <span>Badges +10</span>
        <span>·</span>
        <span>Recorrência pessoal +15</span>
        <span>·</span>
        <span>Avaliações +10</span>
        <span>·</span>
        <span>Verificado +5</span>
      </div>

      {/* Tabela */}
      {professionals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Profissional
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Cidade
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Score
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Fatores
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professionals.map((pro) => (
                <tr key={pro.professionalId} className="hover:bg-muted/20 transition-colors">
                  {/* Nome */}
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span>{pro.displayName}</span>
                    {pro.isVerified && (
                      <span
                        className="ml-1.5 rounded px-1 py-0.5 text-[0.65rem] text-primary bg-primary/5 font-medium"
                        title="Perfil Verificado"
                      >
                        ✓
                      </span>
                    )}
                  </td>

                  {/* Cidade */}
                  <td className="px-4 py-3 text-muted-foreground">{pro.city}</td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_BADGE(pro.score.totalScore)}`}
                      >
                        {pro.score.totalScore}/100
                      </span>
                      {/* Mini barra */}
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/50"
                          style={{ width: `${pro.score.totalScore}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Fatores */}
                  <td className="px-4 py-3">
                    {pro.score.factors.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {pro.score.factors.slice(0, 4).map((f) => (
                          <span
                            key={f.key}
                            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                            title={`${f.label}: +${f.points} pts`}
                          >
                            {f.label}
                            <span className="ml-1 font-medium text-foreground">
                              +{f.points}
                            </span>
                          </span>
                        ))}
                        {pro.score.factors.length > 4 && (
                          <span className="text-[0.65rem] text-muted-foreground">
                            +{pro.score.factors.length - 4} mais
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé explicativo */}
      <p className="mt-4 text-xs text-muted-foreground">
        {professionals.length} profissional{professionals.length !== 1 ? "is" : ""} · Score sem contexto de cidade ou tutor.
        No Discovery, a cidade buscada e o histórico do tutor adicionam pontos extras.
      </p>
    </div>
  )
}
