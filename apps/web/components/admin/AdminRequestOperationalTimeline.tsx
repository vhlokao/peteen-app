import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import type {
  OperationalEvent,
  OperationalSource,
} from "@/modules/backoffice/domain/request-timeline"

/**
 * Timeline operacional de uma solicitação.
 *
 * NÃO é o Diário. Aqui não entra conteúdo de CareUpdate — só o marcador de que
 * houve publicação, com horário, autor e categoria. O conteúdo tem superfície
 * própria (AdminCareTimelineInspection), logo abaixo na mesma página.
 */

const CORES_FONTE: Record<OperationalSource, string> = {
  ServiceRequest: "bg-indigo-500",
  CareUpdate: "bg-teal-500",
  PushDelivery: "bg-sky-500",
  AuditLog: "bg-slate-400",
  Dispute: "bg-red-500",
}

const ROTULO_FONTE: Record<OperationalSource, string> = {
  ServiceRequest: "Solicitação",
  CareUpdate: "Diário",
  PushDelivery: "Push",
  AuditLog: "Auditoria",
  Dispute: "Disputa",
}

export function AdminRequestOperationalTimeline({
  eventos,
}: {
  eventos: OperationalEvent[]
}) {
  const comAtencao = eventos.filter((e) => e.atencao).length

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Timeline operacional</h2>
        {comAtencao > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {comAtencao} ponto(s) de atenção
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Sequência reconstruída a partir da solicitação, do Diário, das entregas de
        push, da auditoria e das disputas. Conteúdo do Diário não aparece aqui —
        veja a inspeção da Care Timeline abaixo.
      </p>

      {eventos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum evento registrado.</p>
      ) : (
        <ol className="mt-4 space-y-0">
          {eventos.map((e, i) => (
            <li key={`${e.at.toISOString()}-${e.fonte}-${i}`} className="flex gap-3">
              {/* Trilho: ponto + linha. A linha some no último item para não
                  ficar pendurada abaixo do fim da lista. */}
              <div className="flex flex-col items-center">
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", CORES_FONTE[e.fonte])}
                  aria-hidden="true"
                />
                {i < eventos.length - 1 ? (
                  <span className="w-px flex-1 bg-border" aria-hidden="true" />
                ) : null}
              </div>

              <div className={cn("min-w-0 flex-1", i < eventos.length - 1 && "pb-4")}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="whitespace-nowrap font-mono text-[0.65rem] text-muted-foreground">
                    {format(new Date(e.at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-medium text-muted-foreground">
                    {ROTULO_FONTE[e.fonte]}
                  </span>
                  {e.atencao ? (
                    <AlertTriangle
                      className="size-3 text-amber-600 dark:text-amber-400"
                      aria-label="Ponto de atenção"
                    />
                  ) : null}
                </div>

                <p
                  className={cn(
                    "mt-0.5 break-words text-sm",
                    e.atencao ? "font-medium text-foreground" : "text-foreground"
                  )}
                >
                  {e.titulo}
                </p>
                {e.detalhe ? (
                  <p className="break-words text-xs text-muted-foreground">{e.detalhe}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
