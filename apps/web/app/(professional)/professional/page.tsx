import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Área do profissional",
};

export default function ProfessionalDashboardPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Painel profissional"
        description="Construa reputação sustentável e organize sua operação diária."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Badge variant="trust">Trust Score</Badge>
            <CardTitle className="mt-2">Reputação</CardTitle>
            <CardDescription>
              Score baseado em recorrência, consistência e validação social.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Em breve</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CRM</CardTitle>
            <CardDescription>
              Organize clientes, pets e histórico para aumentar retenção.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Em breve</CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>Previsibilidade para tutores e profissionais.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Em breve</CardContent>
        </Card>
      </div>
    </div>
  );
}
