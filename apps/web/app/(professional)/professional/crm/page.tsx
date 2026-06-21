import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfessionalCrmPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="CRM"
        description="Gestão de clientes, pets e recorrência operacional."
      />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulo crm será integrado aqui.
        </CardContent>
      </Card>
    </div>
  );
}
