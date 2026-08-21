/**
 * Sequência canônica de logout — ÚNICA no projeto.
 *
 * Antes desta missão a mesma sequência de 4 passos estava copiada em três
 * lugares (AccountSignOutButton, AccountMenuContent, AdminSignOutButton).
 * Três cópias de uma sequência cuja ORDEM é obrigatória por razão de
 * segurança é exatamente o tipo de duplicação que diverge silenciosamente:
 * bastava alguém corrigir o `scope` em um dos três para os outros dois
 * continuarem derrubando a sessão de todos os dispositivos.
 *
 * A ordem e o porquê de cada passo estão em `lib/push/logout.ts` — este
 * módulo só a torna chamável de um lugar só.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { revogarPushAntesDoLogout } from "./logout"

export async function executarLogout(): Promise<void> {
  // 1 e 2: revogar no servidor (última janela com sessão) + unsubscribe local.
  await revogarPushAntesDoLogout()

  // 3: sessão morre por último. `scope: "local"` — o default do Supabase é
  // GLOBAL e derrubaria a sessão dos outros dispositivos deste usuário.
  // "Sair de todos os dispositivos" é ação explícita separada, ainda não
  // implementada.
  const supabase = createSupabaseBrowserClient()
  await supabase.auth.signOut({ scope: "local" })
}
