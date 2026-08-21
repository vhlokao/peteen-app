import type { Metadata } from "next"
import { Share2 } from "lucide-react"

import { requireAdminOrRedirect } from "@/modules/identity/application/get-session"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { findInviteFunnelRows } from "@/modules/invite/infrastructure/repository"
import {
  conversionRate,
  countFunnel,
  INVITE_VISIT_RETENTION_DAYS,
  UNIQUE_VISITS_HINT,
  UNIQUE_VISITS_LABEL,
} from "@/modules/invite/domain/invite-visit"

export const metadata: Metadata = { title: "Admin — Convites" }
export const dynamic = "force-dynamic"

/**
 * /admin/invites — observabilidade do canal de aquisição por convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA TELA RESPONDE — E O QUE ELA NÃO É
 *
 * Responde uma pergunta só: "a landing de convite deste profissional está
 * convertendo?". Não é CRM, não lista pessoas e não mostra jornada
 * individual.
 *
 * NENHUM DADO PESSOAL DO VISITANTE APARECE. A query nem seleciona
 * `visitorKey` ou `convertedUserId` — saber SE converteu responde a pergunta;
 * saber QUEM converteu só criaria um rastro individual sem utilidade
 * operacional.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO LER A ATRIBUIÇÃO (importante)
 *
 * A linha é atribuída ao profissional da LANDING ABERTA, não a quem enviou a
 * mensagem — isso não é observável, e qualquer pessoa pode encaminhar o link
 * de qualquer profissional. Leia como "conversões originadas pela landing de
 * X", nunca como "X convidou N pessoas".
 */
export default async function AdminInvitesPage() {
  await requireAdminOrRedirect()

  const rows = await findInviteFunnelRows()

  // Agrupa por profissional — a pergunta é por canal, não por visita.
  const porProfissional = new Map<string, { nome: string; visitas: typeof rows }>()
  for (const row of rows) {
    const atual = porProfissional.get(row.professionalId)
    if (atual) atual.visitas.push(row)
    else porProfissional.set(row.professionalId, { nome: row.displayName, visitas: [row] })
  }

  const linhas = Array.from(porProfissional.entries())
    .map(([professionalId, { nome, visitas }]) => ({
      professionalId,
      nome,
      funil: countFunnel(visitas),
    }))
    .sort((a, b) => b.funil.opened - a.funil.opened)

  const total = countFunnel(rows)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Convites"
        description="Conversão originada pelas landings públicas de convite dos profissionais."
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Share2 className="size-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma visita registrada ainda</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Quando um profissional compartilhar o próprio perfil e alguém abrir
            o link, a conversão aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              // "Visitas únicas", nunca "Aberturas": cada linha é um
              // visitante distinto, e o carimbo nunca se move em retornos.
              // Rotular como abertura induziria a ler a métrica como page
              // view e a julgar a conversão com um denominador errado.
              { label: UNIQUE_VISITS_LABEL, value: total.opened },
              { label: "Cadastros", value: total.signedUp },
              { label: "Pets", value: total.petCreated },
              { label: "Solicitações", value: total.requestCreated },
              { label: "Concluídos", value: total.serviceCompleted },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-[var(--shadow-card)]"
              >
                <p className="text-xl font-semibold tabular-nums text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            ))}
          </section>

          {/* Tabela rola dentro do próprio contêiner — a página nunca ganha
              scroll horizontal por causa dela. */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Profissional</th>
                  <th className="px-4 py-3 text-right font-semibold">{UNIQUE_VISITS_LABEL}</th>
                  <th className="px-4 py-3 text-right font-semibold">Cadastros</th>
                  <th className="px-4 py-3 text-right font-semibold">Pets</th>
                  <th className="px-4 py-3 text-right font-semibold">Solicitações</th>
                  <th className="px-4 py-3 text-right font-semibold">Concluídos</th>
                  {/* Taxa principal do canal: cadastros sobre VISITANTES
                      ÚNICOS — a pergunta é "de quem abriu, quantos entraram?". */}
                  <th className="px-4 py-3 text-right font-semibold">Cadastro/Visita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linhas.map((linha) => (
                  <tr key={linha.professionalId}>
                    <td className="px-4 py-3 font-medium text-foreground">{linha.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{linha.funil.opened}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{linha.funil.signedUp}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{linha.funil.petCreated}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{linha.funil.requestCreated}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {linha.funil.serviceCompleted}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {conversionRate(linha.funil.opened, linha.funil.signedUp)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 px-1 text-xs text-muted-foreground">
            <p>
              <strong className="font-medium text-foreground">
                {UNIQUE_VISITS_LABEL}
              </strong>{" "}
              = {UNIQUE_VISITS_HINT.toLowerCase()}. Recarregar ou voltar depois
              do login não conta de novo.
            </p>
            <p>
              A atribuição é pela landing aberta, não por quem enviou a mensagem
              — qualquer pessoa pode encaminhar um link. Leia como “conversões
              originadas pela landing deste profissional”.
            </p>
            <p>
              Retenção: registros com mais de {INVITE_VISIT_RETENTION_DAYS} dias
              podem ser expurgados.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
