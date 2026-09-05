/**
 * Módulo: invite
 * Camada: domain — o próximo passo de quem abriu o link de um profissional
 * (GATE-12-PROFESSIONAL-SHARE-INVITE-E2E-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE VIROU FUNÇÃO PURA
 *
 * A decisão morava em dois ternários encadeados dentro do Server Component da
 * landing. Funcionava, mas a matriz inteira do convite — anônimo, autenticado
 * sem persona, tutor, e autenticado com OUTRA persona — só era verificável
 * abrindo o produto com quatro sessões diferentes. É justamente a matriz que
 * esta missão precisa provar ponta a ponta, então ela passou a ser `assert`.
 *
 * Nada de comportamento mudou nos três ramos que já existiam. O que mudou foi
 * o quarto, que não existia — ver `outra-persona` abaixo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A ÂNCORA CONTINUA SENDO A LANDING
 *
 * Todo `next` gerado aqui aponta de volta para `/p/<id>`, nunca para uma etapa
 * intermediária. Quem chega pelo link pode estar em qualquer um dos estados
 * abaixo, e cada etapa concluída traz a pessoa de volta para ser reavaliada —
 * um caminho que se corrige sozinho em vez de uma sequência que quebra quando
 * alguém entra pelo meio (refresh, deep link, sessão que expirou).
 */

import { buildInviteLandingPath } from "./invite-visit.ts"

/**
 * O que a landing sabe sobre quem está olhando. Só isto — nada de sessão
 * inteira, para a regra continuar testável sem banco.
 */
export type InviteViewer = {
  authenticated: boolean
  /** O usuário tem persona de TUTOR. */
  isTutor: boolean
  /**
   * Persona ativa. `null` significa "autenticado mas ainda sem onboarding" —
   * o estado de quem acabou de criar conta pelo próprio convite.
   */
  primaryRole: string | null
}

export type InviteCtaKind =
  /** Visitante anônimo: precisa entrar, e volta para cá depois. */
  | "login"
  /** Autenticado, sem nenhuma persona: cria o perfil de tutor e volta para cá. */
  | "criar-tutor"
  /** Já é tutor: segue para o profissional. É o fim feliz do funil. */
  | "continuar"
  /**
   * Autenticado com OUTRA persona (profissional, parceiro, admin).
   *
   * Não há CTA possível: `/onboarding/tutor` recusa quem já tem persona
   * (`primaryRole !== null` → `/dashboard`), e mandar para `/login` é pior
   * ainda — o middleware vê um usuário autenticado em `/login`, redireciona
   * para `/dashboard` e APAGA o `next` no caminho
   * (`searchParams.delete("next")`), então o convite morre silenciosamente na
   * home da outra persona.
   *
   * Era exatamente o que acontecia: este caso caía no ramo `login` por
   * omissão, e o botão "Continuar com este profissional" levava a pessoa para
   * o próprio painel. Um CTA que mente é pior que a ausência dele.
   */
  | "outra-persona"

export type InviteCta = {
  kind: InviteCtaKind
  /** `null` em `outra-persona` — não há destino honesto a oferecer. */
  href: string | null
  label: string | null
}

/**
 * Link para o perfil do profissional CARREGANDO o convite como volta.
 *
 * Sem o `returnTo`, o botão Voltar de `/discover/[professionalId]` cai no
 * `fallbackHref="/discover"` — a busca genérica. Ou seja: um toque depois de
 * aceitar o convite, o tutor era despejado no marketplace com todos os outros
 * profissionais. É o item 10 da auditoria desta missão, ao pé da letra.
 *
 * `returnTo` (e não `from`): o resolvedor compartilhado normaliza `from` como
 * se fosse um caminho, então `from=tutor` é descartado antes de ser lido — o
 * ramo do `returnTo` é o que funciona de verdade hoje. Ver o RESULT desta
 * missão.
 */
export function buildInviteProfessionalHref(professionalId: string): string {
  const returnTo = encodeURIComponent(buildInviteLandingPath(professionalId))
  return `/discover/${professionalId}?returnTo=${returnTo}`
}

const LABEL: Record<Exclude<InviteCtaKind, "outra-persona">, string> = {
  login: "Continuar com este profissional",
  "criar-tutor": "Criar minha conta de tutor",
  continuar: "Solicitar atendimento",
}

export function resolveInviteCta(viewer: InviteViewer, professionalId: string): InviteCta {
  const landing = buildInviteLandingPath(professionalId)

  if (viewer.authenticated && viewer.isTutor) {
    return {
      kind: "continuar",
      href: buildInviteProfessionalHref(professionalId),
      label: LABEL.continuar,
    }
  }

  if (viewer.authenticated && viewer.primaryRole === null) {
    // Direto para `/onboarding/tutor`, contornando `/login` — é o `/login`
    // que faria o middleware apagar o `next`.
    return {
      kind: "criar-tutor",
      href: `/onboarding/tutor?next=${encodeURIComponent(landing)}`,
      label: LABEL["criar-tutor"],
    }
  }

  if (viewer.authenticated) {
    return { kind: "outra-persona", href: null, label: null }
  }

  return {
    kind: "login",
    href: `/login?next=${encodeURIComponent(landing)}`,
    label: LABEL.login,
  }
}

/**
 * Explicação para `outra-persona`. Diz o que está acontecendo e o que fazer,
 * sem prometer uma ação que o produto não tem.
 */
export const OUTRA_PERSONA_TITULO = "Você está em outra conta"
export const OUTRA_PERSONA_DETALHE =
  "Este convite é para tutores. Saia da conta atual e entre como tutor para continuar com este profissional."
