import Link from "next/link"
import { Bell, ChevronRight, UserCircle } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PushOptInSection } from "@/modules/notifications/components/push-opt-in-section"
import { AccountSignOutButton } from "@/components/account/account-sign-out-button"

/**
 * Conta/Configurações — estrutura V0 compartilhada entre tutor e profissional
 * (UX R1). Só contém seções com funcionalidade real por trás:
 *   - Perfil: link para a página de identidade já existente da persona.
 *   - Notificações: controle de ativação de push (movido para cá — antes
 *     vivia dentro da página de Perfil, que é sobre identidade, não
 *     comportamento).
 *   - Sair: ação de sessão única e canônica.
 *
 * "Segurança" e "Privacidade/Termos" NÃO entram nesta V0: não existe troca de
 * senha nem página de termos/privacidade no produto ainda — criar a seção
 * aqui seria prometer uma funcionalidade que não existe.
 */
export function AccountSettingsPage({
  profileHref,
  profileLabel,
  profileDescription,
}: {
  profileHref: string
  profileLabel: string
  profileDescription: string
}) {
  return (
    <div className="page-container max-w-2xl space-y-6">
      <PageHeader
        title="Conta"
        description="Configurações da sua conta no Peteen."
      />

      <Card className="p-0">
        <Link
          href={profileHref}
          className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40"
        >
          <UserCircle className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{profileLabel}</p>
            <p className="text-xs text-muted-foreground">{profileDescription}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="size-4 text-muted-foreground" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PushOptInSection />
        </CardContent>
      </Card>

      <AccountSignOutButton />
    </div>
  )
}
