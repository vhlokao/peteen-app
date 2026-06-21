import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthContext } from "@/modules/identity/application/get-session";
import { prisma } from "@/lib/prisma/client";
import { findPendingVerificationRequest } from "@/modules/verification/infrastructure/repository"
import { isProfessionalVerificationActive } from "@/modules/verification/domain/verification-state";
import { RequestProfessionalVerificationCard } from "@/modules/verification/components/RequestProfessionalVerificationCard";

export default async function ProfessionalMetricsPage() {
  const ctx = await getAuthContext();

  let hasPendingRequest = false;
  let isVerified = false;

  if (ctx.authenticated && ctx.user.roles.includes("PROFESSIONAL")) {
    const pro = await prisma.professionalProfile.findFirst({
      where: { userId: ctx.user.id, deletedAt: null },
      select: { id: true, isVerified: true, verifiedIdentity: true },
    });

    if (pro) {
      isVerified = isProfessionalVerificationActive(pro);
      const pending = await findPendingVerificationRequest("PROFESSIONAL", pro.id);
      hasPendingRequest = pending !== null;
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Métricas"
        description="Recorrência, retenção e sinais reputacionais."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Verificação de perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestProfessionalVerificationCard
            hasPendingRequest={hasPendingRequest}
            isVerified={isVerified}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Analytics de confiança e recorrência — PostHog na fase 2.
        </CardContent>
      </Card>
    </div>
  );
}
