import Link from "next/link"
import { ArrowRight, CheckCircle2, Info } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { RequestStatus } from "@/modules/service-request/domain/types"
import { REQUEST_STATUS_META, REQUEST_STATUS_COLORS } from "../domain/request-status-display"

const GREEN = "#40916C"

/**
 * Âncora do formulário de avaliação na página de detalhe. Exportada para que o
 * CTA e o alvo nunca saiam de sincronia — um link para `#` errado falha em
 * silêncio, e é justamente o tipo de coisa que ninguém percebe até o usuário
 * clicar e nada acontecer.
 */
export const REVIEW_SECTION_ID = "avaliar-atendimento"

type TutorRequestNextStepProps = {
  status: RequestStatus
  /** true quando já existe uma review enviada para esta solicitação. */
  hasReview: boolean
  requestId: string
  /** Data (e horário, quando houver) já formatada pela regra temporal da página. */
  scheduledAtLabel: string
  professionalName: string
}

/**
 * Próximo passo do tutor — o elemento mais importante da tela de detalhe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE COMPONENTE FOI REESCRITO
 *
 * Num teste com um tutor real, sem conhecimento do sistema, a pessoa CLICOU
 * neste card querendo acompanhar o atendimento. O card não tinha — e continua
 * não tendo, no caminho informativo — nenhum `onClick`, `href` ou `button`.
 * Ele apenas *parecia* clicável: cápsula de ícone colorida, fundo tonalizado,
 * borda colorida e texto em destaque, exatamente a mesma gramática visual que
 * o resto do produto usa em elementos que SÃO clicáveis.
 *
 * A leitura do usuário estava certa; o componente é que mentia. A correção não
 * é ensinar o usuário — é fazer informação parecer informação e ação parecer
 * ação:
 *
 *   INFORMATIVO  → sem cápsula de ícone, sem borda colorida, fundo neutro,
 *                  ícone pequeno e discreto inline. Lê-se como um aviso.
 *   ACIONÁVEL    → mantém o destaque E contém um <Link> real, com rótulo de
 *                  verbo e seta. A affordance é o botão, não o card.
 *
 * Nada de `<div onClick>`: o alvo é sempre um `<Link>` de verdade, então
 * teclado, leitor de tela, abrir em nova aba e status bar do navegador
 * funcionam sem nenhum trabalho extra.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function TutorRequestNextStep({
  status,
  hasReview,
  requestId,
  scheduledAtLabel,
  professionalName,
}: TutorRequestNextStepProps) {
  // ── COMPLETED + já avaliado — encerramento, sem CTA ───────────────────────
  if (status === "COMPLETED" && hasReview) {
    return (
      <InfoCard
        etiqueta="Tudo certo"
        texto="Você já avaliou este atendimento. Obrigado pelo retorno!"
        icone={<CheckCircle2 className="size-4" />}
        cor={GREEN}
      />
    )
  }

  // ── COMPLETED sem avaliação — a avaliação É o próximo passo ───────────────
  if (status === "COMPLETED") {
    return (
      <ActionCard
        status={status}
        etiqueta="Próximo passo"
        texto="Atendimento concluído. Conte como foi."
        // Âncora nativa: o alvo tem tabIndex={-1} e scroll-margin, então o
        // foco vai junto com o scroll — requisito de acessibilidade que um
        // scrollIntoView() em JS não cumpre sozinho.
        href={`#${REVIEW_SECTION_ID}`}
        cta="Avaliar atendimento"
      />
    )
  }

  // ── IN_PROGRESS — acompanhar é a única ação natural ───────────────────────
  if (status === "IN_PROGRESS") {
    return (
      <ActionCard
        status={status}
        etiqueta="Acontecendo agora"
        texto="O atendimento está acontecendo."
        href={`/tutor/requests/${requestId}/diario`}
        cta="Acompanhar atendimento"
      />
    )
  }

  // ── ACCEPTED — confirmado, mas ainda não há o que acompanhar ──────────────
  if (status === "ACCEPTED") {
    return (
      <InfoCard
        etiqueta="Confirmado"
        texto={`Atendimento confirmado para ${scheduledAtLabel} com ${professionalName}.`}
        icone={<CheckCircle2 className="size-4" />}
        cor={REQUEST_STATUS_COLORS.ACCEPTED.fg}
      />
    )
  }

  // ── PENDING — espera, sem ação possível do tutor ──────────────────────────
  if (status === "PENDING") {
    return (
      <InfoCard
        etiqueta="Aguardando"
        texto="Solicitação enviada. Aguardando resposta do profissional."
        icone={<Info className="size-4" />}
        cor={REQUEST_STATUS_COLORS.PENDING.fg}
      />
    )
  }

  // ── Cancelamentos / expiração — copy humana já existente, sem regra nova ──
  const meta = REQUEST_STATUS_META[status]
  if (!meta.nextStep) return null

  return (
    <InfoCard
      etiqueta="Situação"
      texto={meta.nextStep}
      icone={<Info className="size-4" />}
      cor={REQUEST_STATUS_COLORS[status].fg}
    />
  )
}

/**
 * Variante SEM ação. Deliberadamente discreta: fundo neutro, borda neutra,
 * ícone pequeno inline. Nada aqui pode sugerir toque — é o que causou o erro
 * de interpretação no teste real.
 */
function InfoCard({
  etiqueta,
  texto,
  icone,
  cor,
}: {
  etiqueta: string
  texto: string
  icone: React.ReactNode
  cor: string
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
        style={{ color: cor }}
      >
        {icone}
        {etiqueta}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{texto}</p>
    </section>
  )
}

/**
 * Variante COM ação. Mantém o destaque visual (é a tarefa principal da tela) e
 * carrega um `<Link>` real, largura total, altura de toque confortável no
 * mobile — o CTA precisa ser óbvio no primeiro viewport, sem scroll.
 */
function ActionCard({
  status,
  etiqueta,
  texto,
  href,
  cta,
}: {
  status: RequestStatus
  etiqueta: string
  texto: string
  href: string
  cta: string
}) {
  const colors = REQUEST_STATUS_COLORS[status]

  return (
    <section
      className="rounded-2xl border p-5 shadow-[var(--shadow-card)]"
      style={{ borderColor: `${colors.fg}33`, background: colors.bg }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: colors.fg }}
      >
        {etiqueta}
      </p>
      <p className="mt-1 text-base font-semibold" style={{ color: "#1A1A1A" }}>
        {texto}
      </p>
      <Link
        href={href}
        className={buttonVariants({ className: "mt-4 h-11 w-full gap-2 text-sm font-semibold" })}
        style={{ background: colors.fg }}
      >
        {cta}
        <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
