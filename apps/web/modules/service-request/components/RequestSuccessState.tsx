import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

type RequestSuccessStateProps = {
  professionalName: string
  /** Rota real de acompanhamento — mesma usada hoje no redirect pós-envio. */
  trackHref: string
  /** Rota real da home do tutor. */
  homeHref: string
}

/**
 * Etapa 5 — sucesso. Substitui o toast + redirect silencioso por uma tela
 * de confirmação explícita dentro do próprio Sheet. As rotas usadas
 * (`trackHref`, `homeHref`) já existem — nenhuma rota nova foi criada.
 */
export function RequestSuccessState({
  professionalName,
  trackHref,
  homeHref,
}: RequestSuccessStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-8" />
      </span>

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Solicitação enviada!</h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">{professionalName}</strong> recebeu sua
          solicitação. Você poderá acompanhar o andamento pelos seus pedidos.
        </p>
      </div>

      <div className="mt-2 flex w-full flex-col gap-2">
        <Link href={trackHref} className={buttonVariants({ className: "w-full" })}>
          Acompanhar solicitação
        </Link>
        <Link href={homeHref} className={buttonVariants({ variant: "outline", className: "w-full" })}>
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
