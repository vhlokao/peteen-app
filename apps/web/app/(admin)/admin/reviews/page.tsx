import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Star } from "lucide-react"

import { getAdminReviewsAction } from "@/modules/backoffice/application/actions"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { HideRestoreReviewButton } from "@/components/admin/HideRestoreReviewButton"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"

export const metadata: Metadata = { title: "Admin — Avaliações" }

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3 ${i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  )
}

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviewsAction()
  const flaggedCount  = reviews.filter((r) => r.isFlagged).length
  const hiddenCount   = reviews.filter((r) => r.hiddenByAdmin).length

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Avaliações"
        description={[
          `${reviews.length} reviews`,
          flaggedCount > 0 ? `${flaggedCount} flagged` : null,
          hiddenCount  > 0 ? `${hiddenCount} ocultadas` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        count={reviews.length}
      />

      {flaggedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">⚑ {flaggedCount} review(s) flagged</span>
          <span className="text-muted-foreground">— verifique se precisam ser ocultadas</span>
        </div>
      )}

      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="font-medium">👁‍🗨 {hiddenCount} review(s) ocultada(s) pelo admin</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {["Tutor", "Profissional", "Nota", "Comentário", "Serviço", "Pet", "Visível", "Flagged", "Ocultada", "Data", "Ação"].map((h) => (
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
            {reviews.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-neutral-400">
                  Nenhuma review encontrada.
                </td>
              </tr>
            )}
            {reviews.map((r) => (
              <tr
                key={r.id}
                className={`hover:bg-neutral-50 ${r.hiddenByAdmin ? "bg-red-50/40" : ""}`}
              >
                <td className="px-4 py-3 text-xs">{r.tutorName}</td>
                <td className="px-4 py-3 text-xs">{r.professionalName}</td>
                <td className="px-4 py-3">
                  <StarRating value={r.rating} />
                </td>
                <td className="max-w-[160px] px-4 py-3 text-xs text-neutral-500" title={r.comment ?? ""}>
                  {r.comment ? r.comment.slice(0, 60) + (r.comment.length > 60 ? "…" : "") : "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {SERVICE_TYPE_LABELS[r.serviceType as ServiceType] ?? r.serviceType}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">{r.petSpecies}</td>
                <td className="px-4 py-3">
                  {r.isVisible ? (
                    <span className="text-xs text-emerald-600">Sim</span>
                  ) : (
                    <span className="text-xs text-neutral-400">Não</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.isFlagged ? (
                    <span className="text-xs font-medium text-red-600">⚑ Sim</span>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.hiddenByAdmin ? (
                    <span className="text-xs font-medium text-amber-600" title={r.hiddenReason ?? ""}>
                      🚫 {r.hiddenReason ? r.hiddenReason.slice(0, 20) + "…" : "Sim"}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {format(new Date(r.createdAt), "dd/MM/yy", { locale: ptBR })}
                </td>
                <td className="px-4 py-3">
                  <HideRestoreReviewButton
                    reviewId={r.id}
                    hiddenByAdmin={r.hiddenByAdmin}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
