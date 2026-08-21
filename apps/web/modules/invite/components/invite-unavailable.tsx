import Link from "next/link"
import { UserX } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/**
 * Landing de convite indisponível — profissional inexistente, removido ou
 * sem nenhum serviço ativo.
 *
 * Fala com quem acabou de clicar num link recebido de alguém, provavelmente
 * no WhatsApp. Não mostra 404 cru nem "erro": explica em linguagem humana
 * que aquele convite não está disponível e oferece um caminho adiante, em
 * vez de deixar a pessoa num beco. Também não diz QUAL das condições falhou
 * — se o profissional foi removido, está sem serviços ou nunca existiu é
 * informação interna, e vazá-la só serviria para sondar o cadastro.
 */
export function InviteUnavailable() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <UserX className="size-7" aria-hidden="true" />
      </div>

      <h1 className="mb-2 text-lg font-bold text-foreground">
        Este convite não está disponível
      </h1>
      <p className="mb-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
        O perfil que você tentou abrir não está aceitando solicitações no
        momento. Você pode procurar outros profissionais de confiança na
        Peteen.
      </p>

      <Link href="/" className={`${buttonVariants({ variant: "outline" })} touch-target`}>
        Conhecer a Peteen
      </Link>
    </main>
  )
}
