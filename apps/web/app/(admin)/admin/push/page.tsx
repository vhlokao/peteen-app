import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { PushOutcomeBadge } from "@/components/admin/PushOutcomeBadge"
import { getPushObservabilityAction } from "@/modules/backoffice/application/push-observability-actions"
import {
  lerEntregaPush,
  PUSH_OUTCOME_HINTS,
  resumirEndpointHash,
  resumirFingerprint,
  rotularRevogacao,
} from "@/modules/backoffice/domain/push-observability"
import type { PushDeliveryRow, SubscriptionHealthRow } from "@/modules/backoffice/infrastructure/push-observability-repository"

export const metadata: Metadata = { title: "Admin — Push" }
export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{ eventType?: string; falhas?: string; dias?: string }>
}

const PERIODOS = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "", label: "Tudo" },
]

function dataHora(d: Date): string {
  return format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR })
}

const COLUNAS_ENTREGA = [
  {
    key: "createdAt",
    header: "Quando",
    render: (r: PushDeliveryRow) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {dataHora(r.createdAt)}
      </span>
    ),
  },
  {
    key: "eventType",
    header: "Evento",
    render: (r: PushDeliveryRow) => (
      <div className="space-y-0.5">
        <span className="text-xs font-medium">{r.eventType}</span>
        {/* entityId é o id da Request em todos os eventos de ServiceRequest —
            o link fecha o ciclo entrega → investigação da solicitação. */}
        <Link
          href={`/admin/requests/${r.entityId}`}
          className="block font-mono text-[0.6rem] text-primary underline-offset-2 hover:underline"
        >
          {r.entityId.slice(0, 8)}…
        </Link>
      </div>
    ),
  },
  {
    key: "recipient",
    header: "Destinatário",
    render: (r: PushDeliveryRow) => (
      <span className="break-all text-xs text-muted-foreground">{r.recipientEmail}</span>
    ),
  },
  {
    key: "outcome",
    header: "Resultado",
    render: (r: PushDeliveryRow) => {
      const leitura = lerEntregaPush(r)
      return <PushOutcomeBadge leitura={leitura} />
    },
  },
  {
    key: "contadores",
    header: "Tentativas",
    render: (r: PushDeliveryRow) => (
      <span className="whitespace-nowrap font-mono text-[0.65rem] text-muted-foreground">
        {r.attemptedCount}/{r.acceptedCount} aceito
        {r.failedCount > 0 ? ` · ${r.failedCount} falha` : ""}
        {r.invalidCount > 0 ? ` · ${r.invalidCount} morta` : ""}
      </span>
    ),
  },
  {
    key: "retry",
    header: "Reenvios",
    render: (r: PushDeliveryRow) => {
      const { retries } = lerEntregaPush(r)
      return (
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {retries === null ? "—" : retries}
        </span>
      )
    },
  },
]

const COLUNAS_SUBSCRIPTION = [
  {
    key: "email",
    header: "Usuário",
    render: (s: SubscriptionHealthRow) => (
      <span className="break-all text-xs">{s.email}</span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    render: (s: SubscriptionHealthRow) =>
      s.ativa ? (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          Ativa
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
          Revogada
        </span>
      ),
  },
  {
    key: "motivo",
    header: "Motivo",
    render: (s: SubscriptionHealthRow) => (
      <span className="text-xs text-muted-foreground">{rotularRevogacao(s.revokedReason)}</span>
    ),
  },
  {
    key: "device",
    header: "Aparelho",
    render: (s: SubscriptionHealthRow) => (
      // Prefixo do SHA-256 do endpoint. Nunca o endpoint: ele + as chaves
      // permitiriam ENVIAR push para o aparelho da pessoa.
      <span className="font-mono text-[0.6rem] text-muted-foreground">
        {resumirEndpointHash(s.endpointHash)}
      </span>
    ),
  },
  {
    key: "ambiente",
    header: "Ambiente",
    render: (s: SubscriptionHealthRow) => (
      <span className="whitespace-nowrap font-mono text-[0.6rem] text-muted-foreground">
        {s.runtimeEnvironment ?? "legado"} · {resumirFingerprint(s.vapidKeyFingerprint)}
      </span>
    ),
  },
  {
    key: "lastSeen",
    header: "Revalidada",
    render: (s: SubscriptionHealthRow) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {dataHora(s.lastSeenAt)}
      </span>
    ),
  },
]

/**
 * /admin/push — observabilidade de entrega e saúde de subscriptions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A PERGUNTA QUE ESTA TELA RESPONDE
 *
 * "Fulano disse que não recebeu — o que aconteceu?" Antes, isso exigia abrir o
 * banco na mão: push não tinha NENHUMA superfície no backoffice, apesar de já
 * ter dezenas de entregas registradas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA TELA NÃO PODE AFIRMAR
 *
 * Que alguém RECEBEU. `acceptedCount` significa que o push service aceitou a
 * mensagem — o aparelho pode estar offline, com notificação muda no SO, ou o
 * Service Worker pode falhar ao renderizar. `DEVICE_DISPLAYED` não é
 * observável por Web Push. Nenhum rótulo daqui usa "recebeu"/"entregue ao
 * usuário", e há teste que falha se alguém introduzir um.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPRESSÃO POR ANTI-SPAM NÃO APARECE — E ISSO ESTÁ CERTO
 *
 * O cooldown de `care_update` vive dentro do eventKey: o segundo update da
 * mesma hora colide no unique e NÃO cria linha. Não há registro a exibir, e
 * inventar um o transformaria numa falha aos olhos de quem tria. O que aparece
 * como "Sem aparelho elegível" é outra coisa: ninguém tinha device compatível
 * no momento do evento.
 */
export default async function AdminPushPage({ searchParams }: Props) {
  const { eventType, falhas, dias } = await searchParams
  const somenteFalhas = falhas === "1"
  const diasNum = dias ? Number(dias) : 7

  const { overview, deliveries, subscriptions, eventTypes } =
    await getPushObservabilityAction({
      eventType: eventType || undefined,
      somenteFalhas,
      dias: Number.isFinite(diasNum) && diasNum > 0 ? diasNum : undefined,
    })

  const ativas = subscriptions.filter((s) => s.ativa)
  const revogadas = subscriptions.filter((s) => !s.ativa)

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Push"
        description="Entrega de notificações e saúde das inscrições por aparelho."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Inscrições ativas", value: overview.subscriptionsAtivas },
          { label: "Inscrições revogadas", value: overview.subscriptionsRevogadas },
          { label: "Entregas (7 dias)", value: overview.entregas7d },
          { label: "Com falha (7 dias)", value: overview.entregasComFalha7d },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </section>

      {/* Aviso permanente. Não é decoração: a confusão entre "aceito pelo
          provedor" e "usuário recebeu" foi a causa raiz de uma investigação
          inteira desta base. */}
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/15 dark:text-amber-300">
        <strong className="font-semibold">Aceito pelo provedor ≠ exibido no aparelho.</strong>{" "}
        Web Push não devolve confirmação de exibição. O aparelho pode estar offline,
        com notificação silenciada no sistema, ou falhar ao renderizar — nada disso é
        observável aqui. Só QA física prova entrega real.
      </p>

      {/* ── Entregas ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Entregas</h2>

        <form method="GET" className="flex flex-wrap items-center gap-3">
          <select
            name="dias"
            defaultValue={dias ?? "7"}
            className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            name="eventType"
            defaultValue={eventType ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos os eventos</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="falhas"
              value="1"
              defaultChecked={somenteFalhas}
              className="size-4 rounded border-border"
            />
            Só com falha
          </label>

          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
          <Link href="/admin/push" className="py-1.5 text-sm text-muted-foreground underline">
            Limpar
          </Link>
        </form>

        <AdminDataTable
          columns={COLUNAS_ENTREGA}
          rows={deliveries}
          emptyMessage={
            somenteFalhas
              ? "Nenhuma entrega com falha no período. "
              : "Nenhuma entrega registrada no período."
          }
        />

        <details className="rounded-lg border bg-muted/20 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Como ler os resultados
          </summary>
          <dl className="mt-3 space-y-2">
            {Object.entries(PUSH_OUTCOME_HINTS).map(([chave, texto]) => (
              <div key={chave} className="text-xs">
                <dt className="inline font-medium text-foreground">{chave}: </dt>
                <dd className="inline text-muted-foreground">{texto}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {/* ── Saúde das inscrições ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Inscrições por aparelho{" "}
          <span className="font-normal text-muted-foreground">
            ({ativas.length} ativas · {revogadas.length} revogadas)
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Identificador do aparelho é o prefixo do hash do endpoint — serve para
          reconhecer o mesmo aparelho ao longo do tempo. O endpoint e as chaves
          nunca saem do servidor.{" "}
          <strong className="font-medium text-foreground">Revalidada</strong> é
          quando o navegador reconfirmou a inscrição, não prova de entrega.
        </p>

        <AdminDataTable
          columns={COLUNAS_SUBSCRIPTION}
          rows={subscriptions}
          emptyMessage="Nenhuma inscrição registrada."
        />
      </section>
    </div>
  )
}
