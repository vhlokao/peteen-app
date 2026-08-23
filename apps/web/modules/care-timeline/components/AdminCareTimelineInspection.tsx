/**
 * AdminCareTimelineInspection — inspeção administrativa, somente leitura (V0).
 *
 * Server Component puro (sem "use client"): recebe o DTO já buscado pela
 * página e só renderiza. Nenhum botão de ação, nenhuma mutation, nenhum
 * formulário — investigativo, não operacional.
 *
 * Estado de cada item é comunicado por texto + badge + ícone (não só cor),
 * para acessibilidade.
 */

import { CheckCircle2, PencilLine, Trash2, ShieldAlert } from "lucide-react"

import { formatEventInstant } from "@/lib/date/zoned-datetime"
import { CARE_CATEGORY_LABELS } from "../domain/types"
import type {
  AdminCareTimelineInspection as AdminCareTimelineInspectionData,
  AdminCareUpdateRow,
  AdminCareUpdateStatus,
} from "../domain/admin-types"

// Fuso explícito pelo helper central — sem ele o horário sai no fuso do
// runtime (UTC na Vercel) e a inspeção do backoffice mostraria um instante
// deslocado justamente onde se investiga o que aconteceu e quando.
function formatDateTime(date: Date): string {
  return formatEventInstant(new Date(date), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_CONFIG: Record<
  AdminCareUpdateStatus,
  { label: string; badgeClass: string; Icon: typeof CheckCircle2 }
> = {
  ACTIVE: {
    label: "Ativo",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  EDITED: {
    label: "Editado",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Icon: PencilLine,
  },
  DELETED: {
    label: "Excluído",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Icon: Trash2,
  },
}

function StatusBadge({ status }: { status: AdminCareUpdateStatus }) {
  const { label, badgeClass, Icon } = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function AuditTrail({ item }: { item: AdminCareUpdateRow }) {
  if (item.auditEntries.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Nenhum evento de auditoria registrado para este item.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Eventos de auditoria
      </p>
      <ul className="space-y-2.5">
        {item.auditEntries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-semibold text-foreground">{entry.actionLabel}</span>
              <span className="text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">
              Ator: {entry.actorEmail ?? "desconhecido"}
            </p>

            {entry.fields.length > 0 ? (
              <dl className="mt-2 space-y-1">
                {entry.fields.map((field) => (
                  <div key={field.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 font-medium text-foreground/80">{field.label}:</dt>
                    <dd className="whitespace-pre-wrap break-words text-foreground/90">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {entry.incomplete ? (
              <p className="mt-1.5 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
                Este registro de auditoria não tem os campos esperados — dado não disponível, não inventado.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CareUpdateCard({ item }: { item: AdminCareUpdateRow }) {
  return (
    <li className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="text-sm font-semibold text-foreground">
            {CARE_CATEGORY_LABELS[item.category]}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Cuidado registrado em {formatDateTime(item.occurredAt)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {item.content}
      </p>

      {item.status === "DELETED" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          O tutor e o profissional não veem mais este item — conteúdo preservado só para investigação administrativa.
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Autor:</dt>{" "}
          <dd className="inline">{item.authorEmail ?? "desconhecido"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Publicado em:</dt>{" "}
          <dd className="inline">{formatDateTime(item.createdAt)}</dd>
        </div>
        {item.editedAt ? (
          <div>
            <dt className="inline font-medium">Editado em:</dt>{" "}
            <dd className="inline">{formatDateTime(item.editedAt)}</dd>
          </div>
        ) : null}
        {item.deletedAt ? (
          <div>
            <dt className="inline font-medium">Excluído em:</dt>{" "}
            <dd className="inline">{formatDateTime(item.deletedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <AuditTrail item={item} />
    </li>
  )
}

export function AdminCareTimelineInspection({
  inspection,
}: {
  inspection: AdminCareTimelineInspectionData
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Histórico do atendimento</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Registro completo das atualizações publicadas durante o atendimento, incluindo itens
        editados ou excluídos.
      </p>

      {inspection.items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma atualização de cuidado foi publicada nesta solicitação.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {inspection.items.map((item) => (
            <CareUpdateCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}
