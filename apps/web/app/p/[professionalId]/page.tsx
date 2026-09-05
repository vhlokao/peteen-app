import type { Metadata } from "next"
import Link from "next/link"
import { Star } from "lucide-react"

import { getAuthContext } from "@/modules/identity/application/get-session"
import { getProfessionalPublicProfileAction } from "@/modules/professional/application/actions"
import { calculateTrustScore } from "@/modules/trust-engine/application/calculate-trust-score"
import { getPublicTrustState } from "@/modules/trust-engine/domain/public-trust-display"
import { SERVICE_TYPE_LABELS, type ServiceType } from "@/modules/professional/domain/types"
import { TrustStateChip } from "@/components/shared/trust/TrustStateChip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  OUTRA_PERSONA_DETALHE,
  OUTRA_PERSONA_TITULO,
  resolveInviteCta,
} from "@/modules/invite/domain/invite-cta"
import { InviteVisitTracker } from "@/modules/invite/components/invite-visit-tracker"
import { InviteUnavailable } from "@/modules/invite/components/invite-unavailable"

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * noindex E COM PREVIEW SOCIAL — NÃO É CONTRADIÇÃO
 *
 * `robots: noindex` diz ao buscador para não colocar esta URL no índice. O
 * preview do WhatsApp não passa pelo índice de ninguém: o app busca a própria
 * URL que a pessoa colou e lê as meta tags na hora. As duas coisas convivem, e
 * é exatamente o que se quer aqui — link pessoal, fora do catálogo, mas com
 * cara de coisa séria quando alguém o cola numa conversa.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PREVIEW É GENÉRICO DE PROPÓSITO
 *
 * `generateMetadata` poderia buscar o profissional e escrever o nome dele no
 * título. Não faz, por dois motivos: a URL é adivinhável (basta um id), o que
 * transformaria o preview num oráculo de "este id existe e chama-se X" para
 * quem nunca recebeu o convite; e os previews ficam em cache nos servidores do
 * WhatsApp/Meta, fora do nosso controle e sem prazo conhecido. Quem abrir o
 * link vê o nome na página — que é onde ele deve estar.
 */
export const metadata: Metadata = {
  title: "Convite — Peteen",
  description:
    "Você recebeu um convite para acompanhar os cuidados do seu pet pela Peteen.",
  // Landing de convite não deve ser indexada: é um link pessoal compartilhado,
  // não uma página de catálogo. O perfil público indexável é outro assunto.
  robots: { index: false, follow: false },
  // `images` obrigatório aqui pelo mesmo motivo documentado na home
  // (app/(marketing)/page.tsx): um `openGraph` customizado substitui — nunca
  // mescla com — o herdado do root layout, e sem esta linha o preview do
  // WhatsApp ficava sem imagem nenhuma, silenciosamente. Reaproveita a MESMA
  // imagem genérica do produto — coerente com "o preview é genérico de
  // propósito" logo acima: nada específico do profissional entra aqui.
  openGraph: {
    type: "website",
    siteName: "Peteen",
    locale: "pt_BR",
    title: "Convite — Peteen",
    description:
      "Você recebeu um convite para acompanhar os cuidados do seu pet pela Peteen.",
    images: ["/opengraph-image.png"],
  },
}

type PageProps = {
  params: Promise<{ professionalId: string }>
}

/**
 * /p/[professionalId] — landing PÚBLICA de convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UMA ROTA NOVA, E NÃO /discover/[id] TORNADO PÚBLICO
 *
 * O Discovery é área autenticada e carrega contexto de tutor (relacionamento,
 * pets, recomendações). Abri-lo ao público significaria auditar cada uma
 * dessas dependências e arriscar vazar algo por engano. Esta rota carrega
 * SOMENTE o necessário para a decisão de quem acabou de receber um link:
 * quem é a pessoa, se dá para confiar, o que ela faz, e um botão.
 *
 * DISPONIBILIDADE: reaproveita `getProfessionalPublicProfileAction` (mesma
 * regra do Discovery: `deletedAt: null` + só serviços ativos) e adiciona a
 * exigência de ao menos UM serviço ativo. Essa segunda checagem existe porque
 * a query de detalhe, diferente da listagem, devolve o perfil mesmo sem
 * nenhum serviço — e uma landing de convite sem nada solicitável é um beco.
 *
 * O QUE NUNCA APARECE AQUI: telefone, e-mail, score bruto, ids internos além
 * do já presente na URL. O DTO público (`ProfessionalPublicProfile`) já exclui
 * `phone`, `userId` e coordenadas por contrato.
 */
export default async function InviteLandingPage({ params }: PageProps) {
  const { professionalId } = await params

  const [ctx, result] = await Promise.all([
    getAuthContext(),
    getProfessionalPublicProfileAction(professionalId),
  ])

  // Profissional inexistente, removido ou sem nenhum serviço ativo — falha
  // humana, nunca um perfil quebrado nem um CTA que levaria a lugar nenhum.
  if (!result.success || !result.data || result.data.services.length === 0) {
    return <InviteUnavailable />
  }

  const professional = result.data
  const trust = await calculateTrustScore(professionalId)
  const trustState = getPublicTrustState(trust.score, trust.level, {
    reviewCount: professional.reviewCount,
    isVerified: professional.isVerified,
    completedCount: trust.meta.totalCompletedRequests,
  })

  const initials = professional.displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()

  /**
   * ESTA PÁGINA É A ÂNCORA DO CONVITE — ela re-decide o próximo passo a cada
   * visita, em vez de tentar pré-calcular a jornada inteira.
   *
   * O `next` aponta sempre de volta para cá justamente por isso: quem chega
   * pelo link pode estar em estados diferentes, e cada etapa concluída traz a
   * pessoa de volta para ser reavaliada. É um caminho que se corrige sozinho,
   * em vez de uma sequência que quebra quando alguém entra pelo meio.
   *
   * A decisão em si virou função pura em GATE-12 (`resolveInviteCta`), com a
   * matriz de estados coberta por teste — inclusive o quarto caso, que antes
   * caía por omissão no ramo de login e produzia um CTA que levava a pessoa
   * para o próprio painel. Ver modules/invite/domain/invite-cta.ts.
   */
  const cta = resolveInviteCta(
    {
      authenticated: ctx.authenticated,
      isTutor: ctx.authenticated && ctx.user.roles.includes("TUTOR"),
      primaryRole: ctx.authenticated ? ctx.user.primaryRole : null,
    },
    professionalId
  )

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 pb-12">
      {/* Registro da visita: efeito, não render. Fica num client component
          dedicado que chama um Route Handler — Server Component de página não
          pode escrever cookie, e o cookie do visitante precisa ser emitido
          exatamente aqui. */}
      <InviteVisitTracker professionalId={professionalId} />

      <p className="mb-4 text-sm text-muted-foreground">
        Você foi convidado por{" "}
        <strong className="font-semibold text-foreground">{professional.displayName}</strong>
      </p>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0 rounded-2xl">
            {professional.avatarUrl ? (
              <AvatarImage src={professional.avatarUrl} alt={professional.displayName} />
            ) : null}
            <AvatarFallback className="rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-foreground">
              {professional.displayName}
            </h1>
            {professional.locationLabel ? (
              <p className="truncate text-xs text-muted-foreground">
                {professional.locationLabel}
              </p>
            ) : null}
            <div className="mt-1.5">
              <TrustStateChip
                trustState={trustState}
                trustLevel={trust.level}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Avaliações sempre com contexto de quantidade — nunca "5,0" sozinho. */}
        {professional.averageRating !== null && professional.reviewCount > 0 ? (
          <p className="mt-4 flex items-center gap-1.5 text-sm">
            <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="font-semibold text-foreground">
              {professional.averageRating.toFixed(1)}
            </span>
            <span className="text-muted-foreground">
              {professional.reviewCount === 1
                ? "· 1 avaliação"
                : `· ${professional.reviewCount} avaliações`}
            </span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Ainda sem avaliações.</p>
        )}

        {professional.bio ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {professional.bio}
          </p>
        ) : null}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Serviços
        </h2>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {professional.services.map((service) => (
            <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
                <p className="text-xs text-muted-foreground">
                  {SERVICE_TYPE_LABELS[service.serviceType as ServiceType]}
                </p>
              </div>
              {service.priceMin !== null ? (
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  R$ {service.priceMin}
                  {service.priceMax && service.priceMax !== service.priceMin
                    ? `–${service.priceMax}`
                    : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA fixo no fim do fluxo de leitura, com alvo de toque confortável.
          `touch-target` é a utility do design system (44px).

          Sem `href` o convite não tem ação possível (quem está autenticado com
          OUTRA persona): a página explica em vez de oferecer um botão que
          levaria ao painel da própria pessoa. */}
      {cta.href && cta.label ? (
        <>
          <Link
            href={cta.href}
            className={`${buttonVariants({ size: "lg" })} touch-target mt-6 w-full`}
          >
            {cta.label}
          </Link>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            {cta.kind === "continuar"
              ? "Solicite um atendimento com este profissional."
              : "Cadastre seu pet e solicite um atendimento pela Peteen."}
          </p>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 text-center">
          <p className="text-sm font-medium text-foreground">{OUTRA_PERSONA_TITULO}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {OUTRA_PERSONA_DETALHE}
          </p>
        </div>
      )}
    </main>
  )
}
