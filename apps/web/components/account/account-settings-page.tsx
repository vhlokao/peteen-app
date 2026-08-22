import { Bell, FileText, ShieldCheck, UserCircle } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageHeader } from "@/components/layout/page-header"
import { PushOptInSection } from "@/modules/notifications/components/push-opt-in-section"
import { AccountSignOutButton } from "@/components/account/account-sign-out-button"
import { LEGAL_LINK_LABELS, legalHref } from "@/modules/legal/domain/legal-documents"
import {
  SettingsGroup,
  SettingsLinkRow,
  SettingsStaticRow,
} from "@/components/account/settings-row"

/**
 * Minha conta — central compartilhada entre tutor e profissional.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTA TELA DELIBERADAMENTE NÃO TEM
 *
 * A auditoria desta missão mediu o que o backend realmente suporta hoje. Cada
 * ausência abaixo é uma lacuna REPORTADA, não um esquecimento — e nenhuma
 * delas virou um botão que não faz nada:
 *
 *   - SEGURANÇA (trocar e-mail/senha): `supabase.auth.updateUser` não é
 *     chamado em lugar nenhum do projeto. Só existem magic link, Google OAuth
 *     e sign-in por senha. Além disso, quem entrou por magic link ou Google
 *     pode nem ter senha — um "alterar senha" seria falso para essas contas.
 *
 *
 *   - AJUDA/SUPORTE: não existe e-mail, rota ou contrato de suporte no
 *     produto — só menções em prosa.
 *
 *   - EXCLUIR/DESATIVAR CONTA: não há nenhuma action de exclusão ou
 *     desativação de User. Exclusão pela metade é pior que exclusão nenhuma.
 *
 *   - TEMA/APARÊNCIA: fora da superfície do piloto por decisão de produto.
 *     A infraestrutura dark continua existindo, só não é exposta.
 *
 * O que sobrou tem funcionalidade real por trás: identidade, perfil,
 * notificações push (preferência de verdade, com backend) e sair.
 */
export function AccountSettingsPage({
  displayName,
  email,
  avatarUrl,
  roleLabel,
  profileHref,
  profileLabel,
  profileDescription,
}: {
  displayName: string
  email: string
  avatarUrl: string | null
  roleLabel: string
  profileHref: string
  profileLabel: string
  profileDescription: string
}) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0] ?? "")
    .join("")
    .toUpperCase()

  return (
    <div className="page-container max-w-2xl space-y-6 pb-4">
      <PageHeader title="Minha conta" description="Suas informações e preferências no Peteen." />

      {/* Identidade — quem está logado, respondido antes de qualquer ação.
          O e-mail só aparecia no menu do avatar até aqui; numa tela chamada
          "Minha conta", não mostrar de qual conta se trata é a primeira
          pergunta sem resposta. */}
      <section className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4">
        <Avatar className="size-14 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
          {/* `break-all`: e-mails longos quebram o layout em 320px sem isto. */}
          <p className="break-all text-xs text-muted-foreground">{email}</p>
          <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
            {roleLabel}
          </span>
        </div>
      </section>

      <SettingsGroup title="Perfil">
        <SettingsLinkRow
          href={profileHref}
          icon={UserCircle}
          title={profileLabel}
          description={profileDescription}
        />
      </SettingsGroup>

      <SettingsGroup title="Notificações">
        {/* Linha estática, não link: hospeda o próprio controle de ativação.
            Uma linha-link com botão dentro criaria alvos aninhados. */}
        <SettingsStaticRow
          icon={Bell}
          title="Notificações push"
          description="Avisos sobre seus atendimentos neste aparelho."
        >
          <PushOptInSection />
        </SettingsStaticRow>
      </SettingsGroup>

      {/* Legal — as rotas passaram a existir nesta missão. Antes elas eram
          deliberadamente omitidas daqui porque devolviam 404, e multiplicar um
          link quebrado é pior que não oferecê-lo. O conteúdo jurídico ainda
          está em elaboração, e a própria página declara isso. */}
      <SettingsGroup title="Legal">
        <SettingsLinkRow
          href={legalHref("termos")}
          icon={FileText}
          title={LEGAL_LINK_LABELS.termos}
          description="Condições de uso da plataforma."
        />
        <SettingsLinkRow
          href={legalHref("privacidade")}
          icon={ShieldCheck}
          title={LEGAL_LINK_LABELS.privacidade}
          description="Como tratamos seus dados."
        />
      </SettingsGroup>

      {/* Ação destrutiva separada do resto, no fim — nunca no meio das linhas
          de navegação normais. */}
      <section className="pt-2">
        <AccountSignOutButton />
      </section>
    </div>
  )
}
