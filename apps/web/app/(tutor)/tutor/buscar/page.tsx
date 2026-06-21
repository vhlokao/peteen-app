import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TutorSearchPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Buscar profissional"
        description="Descoberta local com ranking contextual e trust score."
      />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulo discovery + ranking será integrado aqui.
        </CardContent>
      </Card>
    </div>
  );
}
