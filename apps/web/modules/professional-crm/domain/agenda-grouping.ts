import type { ServiceRequestWithParticipants } from "@/modules/service-request/domain/types"

export type AgendaBucket = "today" | "tomorrow" | "upcoming" | "later" | "unscheduled"

export const AGENDA_BUCKET_LABELS: Record<AgendaBucket, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  upcoming: "Próximos dias",
  later: "Depois",
  unscheduled: "Data a combinar",
}

/**
 * Chave de data civil (YYYY-MM-DD) num fuso fixo — evita que "hoje"/"amanhã"
 * dependam do fuso do servidor. O projeto não guarda horário em
 * `scheduledAt` (só data civil, ver parseCivilDateToStableInstant), então
 * a comparação aqui também trabalha só em nível de dia.
 */
function civilDateKey(date: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function classifyAgendaBucket(scheduledAt: Date | null, now = new Date()): AgendaBucket {
  if (!scheduledAt) return "unscheduled"

  const todayKey = civilDateKey(now)
  const targetKey = civilDateKey(scheduledAt)
  if (targetKey === todayKey) return "today"

  const today = new Date(`${todayKey}T12:00:00Z`)
  const target = new Date(`${targetKey}T12:00:00Z`)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (diffDays === 1) return "tomorrow"
  if (diffDays > 1 && diffDays <= 7) return "upcoming"
  return "later"
}

const BUCKET_ORDER: AgendaBucket[] = ["today", "tomorrow", "upcoming", "later", "unscheduled"]

/**
 * Agrupa solicitações (já filtradas para ACCEPTED/IN_PROGRESS pelo
 * chamador) em baldes de data reais, ordenados cronologicamente dentro de
 * cada balde. Nenhum horário é inventado — só a data civil já persistida.
 */
export function groupRequestsByAgendaBucket(
  requests: ServiceRequestWithParticipants[]
): Array<{ bucket: AgendaBucket; label: string; requests: ServiceRequestWithParticipants[] }> {
  const now = new Date()
  const buckets = new Map<AgendaBucket, ServiceRequestWithParticipants[]>()

  for (const request of requests) {
    const bucket = classifyAgendaBucket(request.scheduledAt, now)
    const list = buckets.get(bucket) ?? []
    list.push(request)
    buckets.set(bucket, list)
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (!a.scheduledAt) return 1
      if (!b.scheduledAt) return -1
      return a.scheduledAt.getTime() - b.scheduledAt.getTime()
    })
  }

  return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
    bucket,
    label: AGENDA_BUCKET_LABELS[bucket],
    requests: buckets.get(bucket)!,
  }))
}
