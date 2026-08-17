import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireAuthOrRedirect } from "@/modules/identity/application/get-session";
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository";
import { getServiceRequestDetailAction } from "@/modules/service-request/application/actions";
import {
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/modules/professional/domain/types";
import type { RequestStatus } from "@/modules/service-request/domain/types";
import { CareTimeline, getCareTimelineAction } from "@/modules/care-timeline";
import { ActiveRequestAutoRefresh } from "@/modules/service-request/components/ActiveRequestAutoRefresh";
import { buildRequestSyncToken } from "@/modules/service-request/domain/active-request-sync";
import { getRequestSyncSnapshot } from "@/modules/service-request/infrastructure/sync-snapshot";

export const metadata: Metadata = {
  title: "Diário de cuidado",
};

type PageProps = {
  params: Promise<{ requestId: string }>;
};

/**
 * /tutor/requests/[requestId]/diario — superfície COMPLETA da Care Timeline,
 * visão do tutor (Care Operations R0). SOMENTE LEITURA.
 *
 * Espelha os guards da Request do tutor: sessão → perfil de tutor → detalhe da
 * request → posse (`request.tutorId !== tutorProfile.id` → notFound). O guard
 * do route group valida apenas a role TUTOR, não que ESTE tutor é dono DESTA
 * request — sem a checagem explícita, qualquer tutor autenticado leria o
 * diário de um atendimento alheio.
 *
 * AUTO-SYNC: usa `ActiveRequestAutoRefresh`, o mesmo mecanismo da tela de
 * detalhe (R2B.2) — probe leve a cada 20s + focus/visibilidade, e
 * `router.refresh()` só quando o token muda. Substituiu o
 * `CareTimelineAutoRefresh`, que reagia apenas a focus/visibilitychange: um
 * tutor com o Diário aberto e parado (o caso real — acompanhando o
 * atendimento) nunca disparava nenhum dos dois eventos e ficava sem ver as
 * atualizações publicadas. Continua sem socket e sem Realtime.
 */
export default async function TutorCareDiaryPage({ params }: PageProps) {
  const { requestId } = await params;
  const session = await requireAuthOrRedirect();
  const tutorProfile = await findTutorProfileByUserId(session.id);

  if (!tutorProfile) {
    redirect("/onboarding/tutor");
  }

  const detailResult = await getServiceRequestDetailAction(requestId);

  if (!detailResult.success || !detailResult.data) {
    notFound();
  }

  const request = detailResult.data;

  if (request.tutorId !== tutorProfile.id) {
    notFound();
  }

  // Mesma regra da visão do profissional: o diário só existe do início do
  // atendimento em diante.
  if (!["IN_PROGRESS", "COMPLETED"].includes(request.status)) {
    notFound();
  }

  const careTimelineResult = await getCareTimelineAction(requestId);
  if (!careTimelineResult.success) {
    notFound();
  }
  const careUpdates = careTimelineResult.data;

  // Token calculado no MESMO render que produziu a página — o primeiro probe
  // do cliente compara contra o que a tela já mostra, nunca contra nada.
  const syncSnapshot = await getRequestSyncSnapshot(requestId);
  const initialSyncToken = syncSnapshot ? buildRequestSyncToken(syncSnapshot) : null;

  return (
    <ActiveRequestAutoRefresh
      requestId={requestId}
      status={request.status as RequestStatus}
      initialToken={initialSyncToken}
    >
      <div className="page-container max-w-2xl pb-4">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/tutor/requests/${requestId}`}
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
              {requestId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        <section className="border-border/70 bg-card rounded-2xl border p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">
            Histórico do atendimento
          </h2>
          <CareTimeline updates={careUpdates} />
        </section>
      </div>
    </ActiveRequestAutoRefresh>
  );
}
