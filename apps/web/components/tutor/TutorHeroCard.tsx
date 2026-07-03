import Link from "next/link"
import { Search } from "lucide-react"

type TutorHeroCardProps = {
  firstName: string
}

/**
 * Hero da home do tutor — saudação + CTA principal de busca.
 * A ação de descobrir profissionais é a intenção dominante da tela;
 * o card azul cheio garante que ela não compita com nenhum outro bloco.
 */
export function TutorHeroCard({ firstName }: TutorHeroCardProps) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Olá, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre pessoas confiáveis para cuidar do seu pet.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-sm">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 -left-8 size-28 rounded-full bg-white/10"
          aria-hidden
        />
        <div className="relative">
          <h2 className="text-lg font-semibold leading-snug">
            Quem vai cuidar do seu pet hoje?
          </h2>
          <p className="mt-1 text-sm text-primary-foreground/80">
            Busque profissionais confiáveis perto de você.
          </p>
          <Link
            href="/discover"
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-white/90"
          >
            <Search className="size-4" />
            Descobrir profissionais
          </Link>
        </div>
      </div>
    </section>
  )
}
