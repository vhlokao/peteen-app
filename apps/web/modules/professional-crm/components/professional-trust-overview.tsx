import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { TRUST_LEVEL_LABELS, type TrustLevel } from "@/modules/professional/domain/types"
import { cardInteractiveClasses } from "@/components/ui/card"

type ProfessionalTrustOverviewProps = {
  trustScore: number
  trustLevel: TrustLevel
}

const TRUST_LEVEL_CONTEXT: Record<TrustLevel, string> = {
  INITIAL:
    "Sua confiança está em construção. Ela avança conforme você conclui atendimentos, recebe avaliações e cria recorrência com tutores.",
  BUILDING:
    "Você já está construindo uma reputação sólida. Continue concluindo atendimentos com qualidade para evoluir de nível.",
  ESTABLISHED:
    "Seu perfil já é reconhecido como confiável na rede. Recorrência e boas avaliações continuam fortalecendo sua posição.",
  // Sem a palavra "destaque": ela lê como posição patrocinada, e o Ranking
  // não considera plano nem pagamento. Ver a nota em TRUST_LEVEL_LABELS.
  TRUSTED:
    "Sua reputação reflete um histórico consistente de bons atendimentos, reconhecido por quem já contratou você.",
  ELITE:
    "Você alcançou o nível mais alto de confiança da rede Peteen — resultado de um histórico consistente e recorrente.",
}

/**
 * Confiança na Home — a FAIXA é a leitura principal, o índice é rodapé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE MUDOU, E O QUE O QA FÍSICO MOSTROU
 *
 * A versão anterior punha a faixa e o número na MESMA linha
 * (`flex items-baseline gap-2`). Medido a 320px: "Alta confiança" ficava com
 * 85px de largura e 56px de altura — quebrado em duas linhas — disputando a
 * linha com "Índice de Confiança 67 de 100", que quebrava em três. Duas
 * informações de pesos diferentes, espremidas lado a lado, com aparência de
 * peso igual. Era isso que tornava a leitura ambígua, não o número em si.
 *
 * Agora a faixa ocupa a linha inteira, e o índice desce para o rodapé do card,
 * abaixo da explicação. Ele continua visível de propósito — no painel privado
 * o número ajuda a acompanhar evolução, e escondê-lo obrigaria o profissional
 * a procurar em outra tela o que ele já estava olhando.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O NÚMERO NUNCA APARECE SEM RÉGUA NEM SEM PROCEDÊNCIA
 *
 * "67" sozinho não responde "isso é bom?". O "de 100" dá a escala, e a linha
 * seguinte diz de onde ele vem — sem citar peso, fórmula ou "faça X para
 * ganhar Y", que transformaria reputação em placar a ser gamificado.
 */
export function ProfessionalTrustOverview({ trustScore, trustLevel }: ProfessionalTrustOverviewProps) {
  return (
    <Link
      href="/professional/metricas"
      className={`block rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)] ${cardInteractiveClasses}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Confiança profissional
          </p>
          {/* Linha inteira para a faixa — é a leitura principal. */}
          <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground">
            {TRUST_LEVEL_LABELS[trustLevel]}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {TRUST_LEVEL_CONTEXT[trustLevel]}
      </p>

      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-sm text-muted-foreground">
          Índice de confiança:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {trustScore.toFixed(0)} de 100
          </span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Construído a partir do seu histórico de atendimentos, recorrência e avaliações.
        </p>
        {/* Afordância explícita: antes o card inteiro era um link, sem nada
            dizendo que havia mais para ver. */}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          Entenda sua confiança
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
