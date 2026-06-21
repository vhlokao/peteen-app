import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfessionalAgendaPage() {
  return (
    <div className="page-container">
      <PageHeader title="Agenda" description="Organize solicitações e recorrência." />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulo operations/agenda será integrado aqui.
        </CardContent>
      </Card>
    </div>
  );
}
