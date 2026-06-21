import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminAntifraudPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Antifraude"
        description="Sinais suspeitos, redes artificiais e proteção reputacional."
      />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulo antifraud será integrado aqui.
        </CardContent>
      </Card>
    </div>
  );
}
