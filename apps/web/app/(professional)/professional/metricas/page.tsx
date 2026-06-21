import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { getProfessionalVerificationContext } from "@/modules/professional-crm/application/verification-context"
import { getProfessionalMetricsData } from "@/modules/professional-crm/infrastructure/queries"
import { ProfessionalMetricsGrid } from "@/modules/professional-crm/components/professional-metrics-grid"
import { RequestProfessionalVerificationCard } from "@/modules/verification/components/RequestProfessionalVerificationCard"

export const metadata: Metadata = {
  title: "Métricas",
}

export default async function ProfessionalMetricsPage() {
  const { profile } = await requireProfessionalContext()
  const [metrics, verification] = await Promise.all([
    getProfessionalMetricsData(profile.id, profile),
    getProfessionalVerificationContext(profile.id, profile),
  ])

  return (
    <div className="page-container space-y-8">
      <PageHeader
        title="Métricas"
        description="Recorrência, retenção e sinais reputacionais — Trust Score em destaque."
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Indicadores operacionais
        </h2>
        <ProfessionalMetricsGrid data={metrics} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Verificação de perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestProfessionalVerificationCard
            verificationStatus={verification.operationalStatus}
          />
        </CardContent>
      </Card>
    </div>
  )
}
