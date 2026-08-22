import { cn } from "@/lib/utils"
import {
  PUSH_OUTCOME_LABELS,
  type PushDeliveryOutcome,
  type PushDeliveryReading,
} from "@/modules/backoffice/domain/push-observability"

/**
 * Badge do resultado de uma entrega de push.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A COR CARREGA SIGNIFICADO OPERACIONAL, NÃO "BOM/RUIM"
 *
 * `ACCEPTED_BY_PROVIDER` é verde-água e não verde-forte de propósito: aceito
 * pelo provedor é o MELHOR desfecho observável, mas não é confirmação de que a
 * pessoa viu — um verde de "sucesso" ensinaria exatamente a leitura errada.
 *
 * `NO_ELIGIBLE_DEVICE` é neutro, nunca vermelho: não houve falha nenhuma, só
 * não havia aparelho elegível no momento.
 *
 * Vermelho fica reservado ao que exige alguém DA EQUIPE agir (configuração) e
 * âmbar ao que descreve o mundo dando errado sozinho (transitório/permanente).
 */
const ESTILOS: Record<PushDeliveryOutcome, string> = {
  ACCEPTED_BY_PROVIDER:
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  NO_ELIGIBLE_DEVICE: "bg-muted text-muted-foreground",
  CONFIGURATION_FAILURE:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  TRANSIENT_FAILURE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PERMANENT_FAILURE:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  UNCLASSIFIED_FAILURE:
    "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

export function PushOutcomeBadge({ leitura }: { leitura: PushDeliveryReading }) {
  return (
    <div className="space-y-1">
      <span
        className={cn(
          "inline-flex whitespace-nowrap items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
          ESTILOS[leitura.outcome]
        )}
      >
        {PUSH_OUTCOME_LABELS[leitura.outcome]}
      </span>

      {/* Entrega multi-device com desfechos diferentes. Sem esta linha, o badge
          sozinho esconderia metade do que aconteceu — em qualquer direção. */}
      {leitura.parcial ? (
        <span className="block text-[0.6rem] text-muted-foreground">
          parcial — houve aceite em outro aparelho
        </span>
      ) : null}
    </div>
  )
}
