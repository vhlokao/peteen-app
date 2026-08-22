"use client"

/**
 * Error boundary do backoffice.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ERRO NÃO É VAZIO — E ESTA ERA A CONFUSÃO REAL
 *
 * Vários repositórios do backoffice engolem a própria exceção e devolvem `[]`
 * (ver `getAdminDisputes`, `getAdminFlags`). Nessas telas, um banco fora do ar
 * produzia exatamente a mesma imagem que "não há disputas": tabela vazia, sem
 * aviso. Quem estava investigando concluía que não havia nada a investigar.
 *
 * Esta fronteira cobre o que NÃO é engolido — a exceção que sobe. E dá o que
 * faltava nos dois casos: uma frase dizendo que a falha é da carga, não da
 * ausência de dados, e um botão para tentar de novo sem perder a rota.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NADA DO ERRO CRU VAI PARA A TELA
 *
 * `error.message` de uma query Prisma pode carregar nome de tabela, coluna,
 * fragmento de SQL e até valor de parâmetro. Só o `digest` é exibido — é o
 * identificador que o Next também registra no log do servidor, e é ele que
 * conecta o que a pessoa está vendo ao stack trace real, sem publicar nada.
 */

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log no console do browser para quem estiver com o DevTools aberto. O
    // servidor já registrou o stack completo junto do mesmo digest.
    console.error("[admin] erro ao carregar a tela", {
      digest: error.digest,
      message: error.message,
    })
  }, [error])

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>

      <h1 className="mt-4 text-base font-semibold text-foreground">
        Não foi possível carregar esta tela
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        A consulta falhou — isto não significa que não existam registros. Tente
        novamente; se persistir, os dados podem estar indisponíveis no momento.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Tentar novamente
      </button>

      {error.digest ? (
        <p className="mt-4 font-mono text-[0.65rem] text-muted-foreground">
          ref: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
