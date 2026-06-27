/**
 * módulo: professional-crm
 * camada: components — Server Component
 *
 * TrustBreakdownCard: exibe o Índice de Confiança do profissional com decomposição
 * dos fatores que o compõem.
 *
 * NÃO altera nenhum cálculo. Apenas renderiza os dados já calculados por
 * calculateTrustScore(), transformando campos técnicos em linguagem de produto.
 *
 * Ownership: o chamador deve garantir que o professionalId pertence ao usuário
 * autenticado (via requireProfessionalContext na page).
 */

import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Star,
  Repeat2,
  ShieldCheck,
  Handshake,
  Network,
  ClipboardCheck,
  Award,
  TrendingUp,
  Info,
} from "lucide-react"

import type { TrustScoreResult } from "@/modules/trust-engine/domain/types"
import {
  TRUST_LEVEL_META,
  BREAKDOWN_FACTOR_META,
  HOW_TO_IMPROVE_TIPS,
  positiveFactorStatus,
  penaltyFactorStatus,
  type BreakdownFactorStatus,
} from "@/modules/trust-engine/domain/breakdown-labels"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BreakdownFactorStatus }) {
  if (status === "positive") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
  }
  if (status === "attention") {
    return <AlertTriangle className="size-4 shrink-0 text-amber-500" />
  }
  return <Circle className="size-4 shrink-0 text-neutral-300" />
}

type FactorRowProps = {
  icon:        React.ElementType
  label:       string
  description: string
  tip:         string
  status:      BreakdownFactorStatus
  context?:    string
}

function FactorRow({ icon: Icon, label, description, tip, status, context }: FactorRowProps) {
  const bgColor = {
    positive:  "bg-emerald-500/8 border-emerald-500/20",
    attention: "bg-amber-500/8 border-amber-500/20",
    neutral:   "bg-muted/40 border-border",
  }[status]

  return (
    <div className={cn("rounded-lg border p-4", bgColor)}>
      <div className="flex items-start gap-3">
        <Icon className={cn(
          "mt-0.5 size-4 shrink-0",
          status === "positive"  ? "text-emerald-500" :
          status === "attention" ? "text-amber-500" :
          "text-muted-foreground/50"
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <StatusIcon status={status} />
          </div>
          {context && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{context}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {status !== "positive" && (
            <p className="mt-1.5 text-xs text-muted-foreground/70 italic">
              💡 {tip}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE RING — anel SVG simples
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius    = 36
  const stroke    = 7
  const circumference = 2 * Math.PI * radius
  const filled    = circumference * (score / 100)
  const empty     = circumference - filled

  const ringColor =
    score >= 81 ? "#d97706" :  // amber — ELITE
    score >= 61 ? "#059669" :  // emerald — TRUSTED
    score >= 41 ? "#10b981" :  // green — ESTABLISHED
    score >= 21 ? "#3b82f6" :  // blue — BUILDING
                  "#d1d5db"    // gray — INITIAL

  return (
    <svg
      width={90}
      height={90}
      viewBox="0 0 90 90"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* trilha */}
      <circle
        cx={45} cy={45} r={radius}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={stroke}
      />
      {/* progresso */}
      <circle
        cx={45} cy={45} r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${empty}`}
        strokeDashoffset={circumference / 4} // começa no topo
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      {/* texto central — currentColor herda do tema */}
      <text
        x={45} y={41}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={18}
        fontWeight="700"
        fill="currentColor"
        className="text-foreground"
      >
        {score}
      </text>
      <text
        x={45} y={57}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill="currentColor"
        className="text-muted-foreground"
      >
        /100
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — profissional novo sem histórico
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <TrendingUp className="mx-auto mb-3 size-8 text-muted-foreground/30" />
      <h3 className="text-sm font-semibold text-foreground">
        Seu Índice de Confiança está em construção
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Complete seu perfil, configure seus serviços e realize seus primeiros
        atendimentos pela plataforma para começar a construir histórico.
      </p>
      <div className="mt-6 space-y-1.5 text-left mx-auto max-w-xs">
        {HOW_TO_IMPROVE_TIPS.slice(0, 4).map((tip, i) => (
          <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 size-3.5 shrink-0 rounded-full border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground/60">
              {i + 1}
            </span>
            {tip}
          </p>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  trustResult: TrustScoreResult
}

export function TrustBreakdownCard({ trustResult }: Props) {
  const { score, level, breakdown, meta } = trustResult
  const levelMeta = TRUST_LEVEL_META[level]
  const isNew     = meta.totalEvents === 0 && meta.totalCompletedRequests === 0

  return (
    <div className="space-y-6">
      {/* Header do score */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Índice de Confiança
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {score} <span className="text-base font-normal text-muted-foreground">/ 100</span>
            </p>
            <span className={cn(
              "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
              levelMeta.color
            )}>
              {levelMeta.label} — {levelMeta.tagline}
            </span>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {levelMeta.description}
            </p>
          </div>
          <ScoreRing score={score} />
        </div>

        {/* Aviso de transparência */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            O Peteen calcula este índice com base em histórico real, avaliações, recorrência
            e sinais de confiança.{" "}
            <strong className="font-medium text-foreground/80">
              Planos pagos e destaques comerciais não aumentam este índice.
            </strong>{" "}
            A confiança é construída por histórico real — não pode ser comprada.
          </p>
        </div>
      </div>

      {/* Empty state OR breakdown */}
      {isNew ? (
        <EmptyState />
      ) : (
        <>
          {/* Fatores do score */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Composição do índice
            </h3>
            <div className="space-y-2">

              {/* Avaliações */}
              <FactorRow
                icon={Star}
                label={BREAKDOWN_FACTOR_META.reviews.label}
                description={BREAKDOWN_FACTOR_META.reviews.description}
                tip={BREAKDOWN_FACTOR_META.reviews.tip}
                status={positiveFactorStatus(breakdown.reviews)}
                context={
                  breakdown.reviews > 0
                    ? `Contribuindo positivamente para o índice`
                    : undefined
                }
              />

              {/* Recorrência */}
              <FactorRow
                icon={Repeat2}
                label={BREAKDOWN_FACTOR_META.recurrence.label}
                description={BREAKDOWN_FACTOR_META.recurrence.description}
                tip={BREAKDOWN_FACTOR_META.recurrence.tip}
                status={positiveFactorStatus(breakdown.recurrence)}
                context={
                  meta.uniqueRecurringTutors > 0
                    ? `${meta.uniqueRecurringTutors} ${
                        meta.uniqueRecurringTutors === 1
                          ? "tutor retornou para atendimento"
                          : "tutores retornaram para atendimento"
                      }`
                    : undefined
                }
              />

              {/* Rede de confiança (Trust Graph) */}
              <FactorRow
                icon={Network}
                label={BREAKDOWN_FACTOR_META.trustGraphBonus.label}
                description={BREAKDOWN_FACTOR_META.trustGraphBonus.description}
                tip={BREAKDOWN_FACTOR_META.trustGraphBonus.tip}
                status={positiveFactorStatus(breakdown.trustGraphBonus)}
                context={
                  breakdown.trustGraphBonus > 0
                    ? `Conexões ativas na rede Peteen`
                    : undefined
                }
              />

              {/* Verificação de identidade */}
              <FactorRow
                icon={ShieldCheck}
                label={BREAKDOWN_FACTOR_META.identityVerified.label}
                description={BREAKDOWN_FACTOR_META.identityVerified.description}
                tip={BREAKDOWN_FACTOR_META.identityVerified.tip}
                status={positiveFactorStatus(breakdown.identityVerified)}
                context={
                  breakdown.identityVerified > 0
                    ? "Identidade verificada"
                    : undefined
                }
              />

              {/* Conclusões */}
              <FactorRow
                icon={ClipboardCheck}
                label={BREAKDOWN_FACTOR_META.completions.label}
                description={BREAKDOWN_FACTOR_META.completions.description}
                tip={BREAKDOWN_FACTOR_META.completions.tip}
                status={positiveFactorStatus(breakdown.completions)}
                context={
                  meta.totalCompletedRequests > 0
                    ? `${meta.totalCompletedRequests} ${
                        meta.totalCompletedRequests === 1
                          ? "atendimento concluído"
                          : "atendimentos concluídos"
                      }`
                    : undefined
                }
              />

              {/* Recomendações e bônus */}
              <FactorRow
                icon={Handshake}
                label={BREAKDOWN_FACTOR_META.bonuses.label}
                description={BREAKDOWN_FACTOR_META.bonuses.description}
                tip={BREAKDOWN_FACTOR_META.bonuses.tip}
                status={positiveFactorStatus(breakdown.bonuses)}
                context={
                  breakdown.bonuses > 0
                    ? "Bônus ativos no índice"
                    : undefined
                }
              />

              {/* Cancelamentos e ocorrências */}
              <FactorRow
                icon={AlertTriangle}
                label={BREAKDOWN_FACTOR_META.penalties.label}
                description={BREAKDOWN_FACTOR_META.penalties.description}
                tip={BREAKDOWN_FACTOR_META.penalties.tip}
                status={penaltyFactorStatus(breakdown.penalties)}
                context={
                  breakdown.penalties === 0
                    ? "Nenhuma ocorrência registrada"
                    : "Há ocorrências impactando o índice"
                }
              />

            </div>
          </div>

          {/* Como melhorar — apenas se não for ELITE */}
          {level !== "ELITE" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Award className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Como melhorar seu índice de forma legítima
                </h3>
              </div>
              <ul className="space-y-2">
                {HOW_TO_IMPROVE_TIPS.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 size-4 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
