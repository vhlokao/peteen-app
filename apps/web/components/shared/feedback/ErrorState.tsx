import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { RetryLink } from "./RetryLink"

type ErrorStateProps = {
  title?: string
  description?: string
  /**
   * Versão reduzida para ocupar o lugar de UM card dentro de uma tela que
   * continua funcionando (ex.: a seção "Próximo atendimento" de um
   * dashboard, quando só a busca de requests falhou). A versão cheia
   * assume a área principal de uma tela inteira.
   */
  compact?: boolean
}

/**
 * Falha real de leitura (banco, rede, erro interno) — distinta de "não
 * encontrado" (`notFound()`, correto para o caso real de 404) e distinta de
 * "vazio de verdade" (`EmptyState`). Antes desta missão, várias telas
 * tratavam qualquer `!result.success` como um desses dois outros casos,
 * escondendo o erro real do usuário. Mensagem sempre humana — nunca o texto
 * técnico de `result.error` (que pode conter detalhes internos).
 */
export function ErrorState({
  title = "Não deu para carregar agora",
  description = "Algo falhou ao buscar esses dados. Tente novamente em alguns instantes.",
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center",
        compact ? "gap-3 px-4 py-8" : "gap-4 py-16"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive",
          compact ? "size-11" : "size-16"
        )}
      >
        <AlertTriangle className={compact ? "size-5" : "size-7"} />
      </div>

      <div className="space-y-1.5">
        <h3
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm" : "text-base"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mx-auto max-w-xs leading-relaxed text-muted-foreground",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {description}
        </p>
      </div>

      <RetryLink />
    </div>
  )
}
