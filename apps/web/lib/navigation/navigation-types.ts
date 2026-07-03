import type { LucideIcon } from "lucide-react"

/**
 * Item de navegação do shell.
 *
 * Regras:
 *  - `href` deve apontar para rota existente. Itens sem rota real usam `disabled`.
 *  - `exact` controla o active state: true = só ativa em match exato do pathname
 *    (necessário para raízes de persona como /tutor, /professional).
 *  - `devOnly` esconde o item fora de development.
 */
export type NavigationItem = {
  label: string
  /** Rótulo curto para o bottom nav mobile (máximo ~10 caracteres) */
  shortLabel?: string
  href: string
  icon: LucideIcon
  exact?: boolean
  devOnly?: boolean
  /** Placeholder visual — renderizado sem navegação (rota ainda não existe) */
  disabled?: boolean
}

/** Grupo de itens dentro do AvatarMenu (ex.: "Minha área", "Trocar área", "Conta") */
export type ActorNavSection = {
  title: string
  items: NavigationItem[]
}

/**
 * Navegação operacional de uma persona.
 *
 *  - `actorSections`: itens específicos do ator, agrupados — vivem no AvatarMenu.
 *    O header desktop NÃO usa isso — ele usa getProductHeaderNavigation (navegação
 *    geral da Peteen, igual para todas as personas logadas).
 *  - `mobile`: bottom nav — exatamente 4 itens, sem notificações/conta/configurações.
 *
 * Sair não entra em nenhuma lista — é renderizado pelo AvatarMenu diretamente.
 */
export type PersonaNavigation = {
  actorSections: ActorNavSection[]
  mobile: NavigationItem[]
}

/**
 * Forma do shell desktop por persona.
 *
 *  - `top-nav`: header horizontal de produto + AvatarMenu operacional (tutor,
 *    profissional, parceiro — nenhuma persona logada usa sidebar hoje).
 *  - `rail`: sidebar estreita lateral — reservado para o caso de uma persona
 *    voltar a precisar de navegação operacional densa fora do avatar.
 *  - `none`: sem shell próprio (marketing usa a home pública; admin usa AdminShell).
 */
export type ShellLayout = "top-nav" | "rail" | "none"
