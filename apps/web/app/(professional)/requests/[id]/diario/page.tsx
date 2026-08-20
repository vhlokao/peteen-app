import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getAuthContext } from "@/modules/identity/application/get-session";
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions";
import { findDisputeForProfessionalRequest } from "@/modules/disputes/infrastructure/queries";
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types";
import {
  CareUpdateForm,
  CareTimeline,
  getCareTimelineAction,
} from "@/modules/care-timeline";
import { ActiveRequestAutoRefresh } from "@/modules/service-request/components/ActiveRequestAutoRefresh";
import { buildRequestSyncToken } from "@/modules/service-request/domain/active-request-sync";
import { getRequestSyncSnapshot } from "@/modules/service-request/infrastructure/sync-snapshot";
import type { RequestStatus } from "@/modules/service-request/domain/types";
import { ErrorState } from "@/components/shared/feedback/ErrorState";

export const metadata: Metadata = {
  title: "Diário de cuidado",
};

/**
 * Mensagens de `getServiceRequestDetailAction` em que 404 é a resposta
 * certa — ver o mesmo comentário na página de detalhe.
 */
const NOT_FOUND_DETAIL_ERRORS = new Set(["Solicitação não encontrada.", "Acesso negado."]);

/**
 * Mensagens de `getCareTimelineAction` em que 404 é a resposta certa. "Erro
 * interno ao carregar a timeline." é falha real — antes desta correção
 * também virava 404 aqui, na tela onde o profissional registra evidência
 * DURANTE um atendimento real.
 */
const NOT_FOUND_TIMELINE_ERRORS = new Set([
  "Solicitação não encontrada.",
  "Você não tem acesso a esta timeline.",
]);

type PageProps = {
  params: Promise<{ id: string }>;
};

function DiarioErrorPage({ id }: { id: string }) {
  return (
    <div className="page-container max-w-2xl pb-4">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href={`/requests/${id}`}
          aria-label="Voltar para a solicitação"
          className="border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground grid size-9 shrink-0 place-items-center rounded-full border transition-colors"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-foreground text-base font-semibold">Diário de cuidado</h1>
      </div>
      <ErrorState />
    </div>
  );
}

/**
 * /requests/[id]/diario — superfície COMPLETA da Care Timeline, visão do
 * profissional (Care Operations R0).
 *
 * A Request passou a mostrar apenas um resumo (CareTimelineSummary); a leitura
 * completa e a publicação vivem aqui. Rota dedicada — e não modal/drawer —
 * porque o Service Worker navega por URL real (`client.navigate`), então só uma
 * rota é deep-linkável, tem back nativo e dispensa focus trap.
 *
 * AUTORIZAÇÃO: nenhuma regra nova. `getServiceRequestDetailAction` já recusa
 * quem não é participante da request, e `getCareTimelineAction` repete a
 * verificação por conta própria — as duas continuam sendo a fonte, esta página
 * apenas traduz a recusa em notFound(). O guard do route group valida só a
 * ROLE, nunca a posse desta request específica; confiar nele sozinho abriria
 * acesso cruzado entre profissionais.
 */
export default async function ProfessionalCareDiaryPage({ params }: PageProps) {
  const { id } = await params;

  const [ctx, detailResult] = await Promise.all([
    getAuthContext(),
    getServiceRequestDetailAction(id),
  ]);

  if (!detailResult.success || !detailResult.data) {
    if (!detailResult.success && !NOT_FOUND_DETAIL_ERRORS.has(detailResult.error)) {
      return <DiarioErrorPage id={id} />;
    }
    notFound();
  }

  const request = detailResult.data;

  // Mesmo desvio da Request: o tutor tem a própria árvore de rota.
  if (ctx.authenticated && ctx.user.primaryRole === "TUTOR") {
    redirect(`/tutor/requests/${id}/diario`);
  }

  // O diário só existe a partir do início do atendimento. Antes disso não há
  // nada para ler nem publicar — a Request esconde a seção, e aqui a rota
  // simplesmente não existe (em vez de renderizar uma tela vazia sem saída).
  if (!["IN_PROGRESS", "COMPLETED"].includes(request.status)) {
    notFound();
  }

  // PRE-PILOT POLISH — CRITICAL FLOW PERFORMANCE & RESILIENCE: as três
  // buscas abaixo são independentes entre si (nenhuma depende do resultado
  // de outra — todas só de `id`/`request.professional.id`, já conhecidos) e
  // antes rodavam em série, uma waterfall de 3 estágios.
  const [dispute, careTimelineResult, syncSnapshot] = await Promise.all([
    findDisputeForProfessionalRequest(id, request.professional.id),
    getCareTimelineAction(id),
    // Token do MESMO render que produziu a página. O CareUpdateForm suspende
    // o auto-sync enquanto houver rascunho, foto ou envio em voo — ver
    // formularioTemTrabalhoEmAndamento.
    getRequestSyncSnapshot(id),
  ]);
  const hasActiveDispute =
    dispute?.status === "OPEN" || dispute?.status === "UNDER_REVIEW";

  // Publicação segue exatamente o contrato atual: só IN_PROGRESS e sem disputa
  // aberta. O servidor já bloqueia; esconder o form evita que o profissional
  // bata no erro. A LEITURA é preservada em ambos os casos.
  const canPublish = request.status === "IN_PROGRESS" && !hasActiveDispute;

  if (!careTimelineResult.success) {
    if (!NOT_FOUND_TIMELINE_ERRORS.has(careTimelineResult.error)) {
      return <DiarioErrorPage id={id} />;
    }
    notFound();
  }
  const careUpdates = careTimelineResult.data;

  const initialSyncToken = syncSnapshot ? buildRequestSyncToken(syncSnapshot) : null;

  return (
    <ActiveRequestAutoRefresh
      requestId={id}
      status={request.status as RequestStatus}
      initialToken={initialSyncToken}
    >
      <div className="page-container max-w-2xl pb-4">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/requests/${id}`}
            aria-label="Voltar para a solicitação"
            className="border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground grid size-9 shrink-0 place-items-center rounded-full border transition-colors"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-foreground text-base font-semibold">
              Diário de cuidado
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              {SERVICE_TYPE_LABELS[request.serviceType as ServiceType]} · #
              {id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {canPublish ? (
            <section className="border-border/70 bg-card rounded-2xl border p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
                Nova atualização
              </h2>
              <p className="text-muted-foreground mb-4 text-xs">
                O tutor acompanha as atualizações do atendimento pelo Peteen.
              </p>
              <CareUpdateForm
                requestId={id}
                startedAt={request.startedAt}
                completedAt={request.completedAt}
              />
            </section>
          ) : null}

          <section className="border-border/70 bg-card rounded-2xl border p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
              Histórico do atendimento
            </h2>
            <CareTimeline updates={careUpdates} />
          </section>
        </div>
      </div>
    </ActiveRequestAutoRefresh>
  );
}
