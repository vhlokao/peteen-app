/**
 * Módulo: notifications
 * Camada: components — ponte Server → Client do convite contextual (R2B.5).
 *
 * Server Component: lê a chave PÚBLICA do VAPID no servidor e a passa como
 * prop, pelo mesmo motivo de `PushOptInSection` — a chave é publicável por
 * design, mas passá-la explicitamente deixa a fronteira visível na revisão em
 * vez de o Client Component ler `process.env` por conta própria.
 *
 * Sem chave configurada, a prop chega vazia e o convite se cala (o próprio
 * componente trata `nao-configurado` como "não mostrar").
 */

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { ContextualPushActivation } from "./contextual-push-activation"
import type { PushInvitePersona } from "../domain/contextual-push-invite"

export function ContextualPushSection({
  persona,
  requestId,
  status,
}: {
  persona: PushInvitePersona
  requestId: string
  status: RequestStatus
}) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

  return (
    <ContextualPushActivation
      persona={persona}
      requestId={requestId}
      status={status}
      vapidPublicKey={vapidPublicKey}
    />
  )
}
