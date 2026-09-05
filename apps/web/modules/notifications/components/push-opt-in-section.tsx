/**
 * Módulo: notifications
 * Camada: components — ponte Server → Client da superfície de notificações em
 * Minha conta.
 *
 * Server Component: lê a chave PÚBLICA do VAPID no servidor e a passa como prop.
 * A pública é publicável por design (é o `applicationServerKey` que o browser
 * precisa para assinar) — mas passá-la explicitamente como prop, em vez de o
 * Client Component ler `process.env` por conta própria, deixa a fronteira
 * visível na revisão de código: fica óbvio o que atravessa para o browser.
 *
 * Quando a chave não está configurada, a prop chega vazia e o componente se
 * declara indisponível — nenhuma operação de domínio é afetada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GATE-10 — POR QUE ESTE ARQUIVO PERDEU O PRÓPRIO TÍTULO
 *
 * Ele renderizava "Notificações no dispositivo" + uma frase de valor genérica,
 * dentro de uma linha que JÁ dizia "Notificações push" + "Avisos sobre seus
 * atendimentos neste aparelho", acima de um `PushOptIn` que dizia pela terceira
 * vez "Notificações desativadas — Receba avisos importantes sobre seus
 * atendimentos".
 *
 * Três cabeçalhos e três frases quase idênticas, com a única informação que
 * importava — o ESTADO — em terceiro lugar e no menor peso visual. A resposta
 * ("está ligado?") passou a ser a primeira linha, e este arquivo virou o que
 * sempre deveria ter sido: só a fronteira servidor→cliente.
 */

import { PushOptIn } from "./push-opt-in"
import type { PushInvitePersona } from "../domain/contextual-push-invite"

export function PushOptInSection({ persona }: { persona: PushInvitePersona }) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

  return (
    <PushOptIn vapidPublicKey={vapidPublicKey} apresentacao="settings" persona={persona} />
  )
}
