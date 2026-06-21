import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminModerationPage() {
  return (
    <div className="page-container">
      <PageHeader title="Moderação" description="Denúncias e revisão manual de conteúdo." />
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Módulo backoffice/moderation será integrado aqui.
        </CardContent>
      </Card>
    </div>
  );
}
