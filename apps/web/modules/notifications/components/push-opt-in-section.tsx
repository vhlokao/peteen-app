/**
 * Módulo: notifications
 * Camada: components — ponte Server → Client do opt-in de push.
 *
 * Server Component: lê a chave PÚBLICA do VAPID no servidor e a passa como prop.
 * A pública é publicável por design (é o `applicationServerKey` que o browser
 * precisa para assinar) — mas passá-la explicitamente como prop, em vez de o
 * Client Component ler `process.env` por conta própria, deixa a fronteira
 * visível na revisão de código: fica óbvio o que atravessa para o browser.
 *
 * Quando a chave não está configurada, a prop chega vazia e o componente se
 * declara indisponível — nenhuma operação de domínio é afetada.
 */

import { PushOptIn } from "./push-opt-in"

export function PushOptInSection() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Notificações no dispositivo</p>
        <p className="text-sm text-muted-foreground">
          Receba um aviso quando houver novidade nos seus atendimentos. Você pode
          desativar quando quiser.
        </p>
      </div>
      <PushOptIn vapidPublicKey={vapidPublicKey} />
    </div>
  )
}
