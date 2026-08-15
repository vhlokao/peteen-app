import { AlertTriangle, CheckCircle2, Info, Play } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RequestStatus } from "@/modules/service-request/domain/types"
import { PROFESSIONAL_REQUEST_NOW_STEP } from "../domain/request-status-display"
import { REQUEST_STATUS_COLORS } from "@/modules/tutor-portal/domain/request-status-display"

const STATUS_ICON: Record<RequestStatus, LucideIcon> = {
  PENDING: Info,
  ACCEPTED: Info,
  IN_PROGRESS: Play,
  COMPLETED: CheckCircle2,
  CANCELLED_BY_TUTOR: Info,
  CANCELLED_BY_PROFESSIONAL: Info,
  DISPUTED: AlertTriangle,
  EXPIRED: Info,
}

type Props = {
  status: RequestStatus
  /**
   * true quando o RequestActions está sendo renderizado logo abaixo, com os
   * botões reais (aceitar/recusar/iniciar/concluir).
   */
  hasActions: boolean
}

/**
 * Orientação do profissional no detalhe da solicitação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE CARD NÃO TEM — E NÃO DEVE TER — CTA PRÓPRIO
 *
 * Toda ação real do profissional (aceitar, recusar, iniciar, concluir) já vive
 * em `RequestActions`, renderizado imediatamente abaixo, com botões de verdade
 * que disparam as transições. Dar um CTA a este card criaria dois botões
 * diferentes para a mesma ação — e o usuário teria de adivinhar qual é o certo.
 * O caminho para o diário também já existe, no card de resumo do Diário.
 *
 * O que mudou em R2B.1 foi só a HONESTIDADE VISUAL. Antes o card usava cápsula
 * de ícone colorida sobre fundo tonalizado e borda colorida — a mesma gramática
 * dos elementos clicáveis do produto — e um usuário real tentou clicar num
 * card equivalente esperando que ele levasse a algum lugar. Agora ele se
 * apresenta como o que é: um aviso.
 *
 * O título também deixou de mentir: "O que fazer agora" só aparece quando de
 * fato existe algo a fazer logo abaixo. Em estado terminal, vira "Situação".
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ProfessionalRequestNextStep({ status, hasActions }: Props) {
  const cor = REQUEST_STATUS_COLORS[status].fg
  const Icon = STATUS_ICON[status]

  return (
    <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest"
        style={{ color: cor }}
      >
        <Icon className="size-4" />
        {hasActions ? "O que fazer agora" : "Situação"}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
        {PROFESSIONAL_REQUEST_NOW_STEP[status]}
      </p>
    </section>
  )
}
