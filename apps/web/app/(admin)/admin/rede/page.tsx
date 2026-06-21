import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminNetworkPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Rede de confiança"
        description="Trust graph, densidade local e qualidade da rede."
      />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulos trust-graph e growth serão integrados aqui.
        </CardContent>
      </Card>
    </div>
  );
}
