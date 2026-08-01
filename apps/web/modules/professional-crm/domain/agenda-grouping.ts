import { scheduledDayTimeZone } from "@/lib/date/zoned-datetime"
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
 * dependam do fuso do servidor.
 *
 * O fuso vem da precisão do registro (ver scheduledDayTimeZone): compromissos
 * com horário real usam o fuso do piloto; date-only legado usa UTC, para
 * recuperar o dia civil gravado sem deslizar para o dia anterior.
 */
function civilDateKey(date: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function classifyAgendaBucket(
  scheduledAt: Date | null,
  scheduledHasTime: boolean,
  now = new Date()
): AgendaBucket {
  if (!scheduledAt) return "unscheduled"

  // "Hoje" é sempre o dia civil local do agora (instante real). O alvo usa o
  // fuso da sua própria precisão.
  const todayKey = civilDateKey(now)
  const targetKey = civilDateKey(scheduledAt, scheduledDayTimeZone(scheduledHasTime))
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
 * cada balde. Nenhum horário é inventado — só o que já está persistido.
 *
 * Ordenação dentro do dia (Agenda Foundation V0.3):
 *   Compromissos com horário real (`scheduledHasTime`) vêm primeiro,
 *   ordenados pelo horário. Compromissos legados (precisão de dia) vêm
 *   depois, pois não há horário para posicioná-los — colocá-los junto
 *   sugeriria uma ordem que o dado não sustenta.
 */
export function groupRequestsByAgendaBucket(
  requests: ServiceRequestWithParticipants[]
): Array<{ bucket: AgendaBucket; label: string; requests: ServiceRequestWithParticipants[] }> {
  const now = new Date()
  const buckets = new Map<AgendaBucket, ServiceRequestWithParticipants[]>()

  for (const request of requests) {
    const bucket = classifyAgendaBucket(request.scheduledAt, request.scheduledHasTime, now)
    const list = buckets.get(bucket) ?? []
    list.push(request)
    buckets.set(bucket, list)
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => {
      if (!a.scheduledAt) return 1
      if (!b.scheduledAt) return -1

      // Com horário real de um lado só, o que tem horário vem antes.
      if (a.scheduledHasTime !== b.scheduledHasTime) {
        return a.scheduledHasTime ? -1 : 1
      }

      return a.scheduledAt.getTime() - b.scheduledAt.getTime()
    })
  }

  return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
    bucket,
    label: AGENDA_BUCKET_LABELS[bucket],
    requests: buckets.get(bucket)!,
  }))
}
