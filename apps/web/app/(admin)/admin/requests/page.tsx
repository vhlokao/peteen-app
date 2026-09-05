import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminRequestsAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import { SERVICE_TYPE_LABELS } from "@/modules/professional/domain/types"
import { formatScheduledCivilDate, formatZonedTime } from "@/lib/date/zoned-datetime"
import { canDisplayScheduledTime } from "@/modules/service-request/domain/schedule-precision"
import {
  countPendingSync,
  resolveOperationalRequestStatus,
} from "@/modules/backoffice/domain/request-operational-status"
import type { AdminRequestRow } from "@/modules/backoffice/domain/types"
import type { ServiceType } from "@/modules/professional/domain/types"

export const metadata: Metadata = { title: "Admin — Solicitações" }

type RequestsPageProps = {
  searchParams: Promise<{
    status?: string
    serviceType?: string
    dias?: string
    requestId?: string
  }>
}

const COLUMNS = [
  {
    key: "id",
    header: "ID",
    render: (row: AdminRequestRow) => (
      <Link
        href={`/admin/requests/${row.id}`}
        className="font-mono text-[0.65rem] text-primary underline-offset-2 hover:underline"
      >
        {row.id.slice(0, 8)}…
      </Link>
    ),
  },
  {
    key: "tutor",
    header: "Tutor",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">{row.tutorName}</span>
    ),
  },
  {
    key: "professional",
    header: "Profissional",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">{row.professionalName}</span>
    ),
  },
  {
    key: "pet",
    header: "Pet",
    render: (row: AdminRequestRow) => (
      <span className="text-xs text-muted-foreground">{row.petName}</span>
    ),
  },
  {
    key: "serviceType",
    header: "Serviço",
    render: (row: AdminRequestRow) => (
      <span className="text-xs">
        {SERVICE_TYPE_LABELS[row.serviceType as ServiceType] ?? row.serviceType}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    /*
     * Mostra o estado OPERACIONAL, não a coluna crua.
     *
     * O cron de expiração roda 1x por dia (vercel.json) e a sincronização lazy
     * só existe nas telas de tutor e profissional. Sem esta derivação, o
     * Backoffice exibia "Pendente" por até ~23h para solicitações que o produto
     * inteiro já tratava como vencidas — e quem investigava "por que ninguém
     * respondeu?" concluía que ainda dava tempo.
     *
     * O marcador ao lado preserva o fato de que o banco ainda não foi
     * atualizado: escondê-lo trocaria uma mentira por outra, e apagaria o único
     * sinal visível de que o cron pode estar atrasado ou parado.
     */
    render: (row: AdminRequestRow) => {
      const operacional = resolveOperationalRequestStatus(row)
      return (
        <span className="flex items-center gap-1.5">
          <AdminStatusBadge type="request" value={operacional.effective} />
          {operacional.pendingSync ? (
            <span
              title="Vencida pelo prazo, mas ainda gravada como PENDING. O cron de expiração roda 1x/dia."
              className="cursor-help text-[0.65rem] text-muted-foreground"
            >
              não sincronizado
            </span>
          ) : null}
        </span>
      )
    },
  },
  {
    key: "scheduledAt",
    header: "Agendado",
    render: (row: AdminRequestRow) =>
      row.scheduledAt ? (
        <span className="text-xs text-muted-foreground">
          {/* Precisão temporal: date-only legado em UTC (preserva o dia
              gravado), horário real em America/Sao_Paulo. Ver
              apps/web/docs/AGENDA_TEMPORAL_PRECISION_CONTRACT.md. */}
          {formatScheduledCivilDate(row.scheduledAt, row.scheduledHasTime, {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          })}
          {canDisplayScheduledTime(row) && (
            <> · {formatZonedTime(row.scheduledAt)}</>
          )}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Criado em",
    render: (row: AdminRequestRow) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {format(new Date(row.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
      </span>
    ),
  },
  {
    // `startedAt` faltava na lista, e é o carimbo que distingue "aceito mas
    // nunca começou" de "aconteceu de verdade" — a primeira pergunta de
    // qualquer triagem de atendimento.
    key: "startedAt",
    header: "Iniciado",
    render: (row: AdminRequestRow) =>
      row.startedAt ? (
        <span className="whitespace-nowrap text-xs text-indigo-600 dark:text-indigo-400">
          {format(new Date(row.startedAt), "dd/MM/yy HH:mm", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "completedAt",
    header: "Concluído",
    render: (row: AdminRequestRow) =>
      row.completedAt ? (
        <span className="whitespace-nowrap text-xs text-emerald-600">
          {format(new Date(row.completedAt), "dd/MM/yy", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
]

/**
 * EXPIRED faltava aqui — o badge da tabela já sabia desenhá-lo, mas não havia
 * como FILTRAR por ele. Uma solicitação que morreu sem resposta é justamente o
 * caso que a operação precisa investigar, e ela ficava impossível de isolar.
 */
const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING",                   label: "Pendente" },
  { value: "ACCEPTED",                  label: "Aceito" },
  { value: "IN_PROGRESS",               label: "Em andamento" },
  { value: "COMPLETED",                 label: "Concluído" },
  { value: "EXPIRED",                   label: "Expirado" },
  { value: "CANCELLED_BY_TUTOR",        label: "Cancelado (tutor)" },
  { value: "CANCELLED_BY_PROFESSIONAL", label: "Cancelado (pro)" },
  { value: "DISPUTED",                  label: "Disputado" },
]

const PERIODO_OPTIONS = [
  { value: "",   label: "Todo o período" },
  { value: "1",  label: "Hoje" },
  { value: "7",  label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
]

export default async function AdminRequestsPage({ searchParams }: RequestsPageProps) {
  const { status, serviceType, dias, requestId } = await searchParams

  const diasNum = dias ? Number(dias) : undefined
  const requests = await getAdminRequestsAction({
    status,
    serviceType,
    dias: Number.isFinite(diasNum) && diasNum! > 0 ? diasNum : undefined,
    // `trim` porque colar um id de um relato costuma trazer espaço junto, e
    // um espaço invisível faria a busca não achar nada sem explicar o porquê.
    requestId: requestId?.trim() || undefined,
  })

  /*
   * `serviceType` estava fora desta conta — e ele É um filtro: a action e a
   * query sempre o aceitaram, faltava só o controle no formulário (adicionado
   * abaixo). Com um filtro de serviço ativo e nenhum resultado, o estado vazio
   * dizia "Nenhuma solicitação encontrada", afirmando que a base inteira estava
   * vazia quando o que estava vazio era o recorte.
   */
  const temFiltro = Boolean(status || serviceType || dias || requestId?.trim())

  /*
   * Quantas linhas desta página venceram sem o banco saber. Só aparece quando é
   * maior que zero — um contador permanentemente em "0" vira ruído que ninguém
   * lê no dia em que ele mudar. Se este número não zerar depois das 09:00, o
   * cron de expiração parou: hoje não existe nenhum outro alarme para isso.
   */
  const naoSincronizadas = countPendingSync(requests)

  return (
    <div>
      <AdminPageHeader
        title="Solicitações"
        description="Histórico completo de solicitações de serviço."
        count={requests.length}
      />

      {naoSincronizadas > 0 ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          {naoSincronizadas === 1
            ? "1 solicitação desta página venceu e ainda está gravada como PENDING."
            : `${naoSincronizadas} solicitações desta página venceram e ainda estão gravadas como PENDING.`}{" "}
          A expiração é escrita pelo cron diário (09:00) e pelas telas de tutor e
          profissional. Nada aqui altera dados.
        </p>
      ) : null}

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* O filtro por serviço já existia na action e na query — só não tinha
            controle. Quem quisesse usar precisava editar a URL à mão, e ao
            fazê-lo caía no estado vazio errado (ver `temFiltro`). */}
        <select
          name="serviceType"
          defaultValue={serviceType ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos os serviços</option>
          {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((tipo) => (
            <option key={tipo} value={tipo}>
              {SERVICE_TYPE_LABELS[tipo]}
            </option>
          ))}
        </select>

        <select
          name="dias"
          defaultValue={dias ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          {PERIODO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          name="requestId"
          defaultValue={requestId ?? ""}
          placeholder="ID da solicitação"
          className="w-44 rounded-md border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-primary"
        />

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
        {temFiltro && (
          <Link href="/admin/requests" className="py-1.5 text-sm text-muted-foreground underline">
            Limpar
          </Link>
        )}
      </form>

      <AdminDataTable
        columns={COLUMNS}
        rows={requests}
        emptyMessage={
          temFiltro
            ? "Nenhuma solicitação para estes filtros."
            : "Nenhuma solicitação encontrada."
        }
      />
    </div>
  )
}
