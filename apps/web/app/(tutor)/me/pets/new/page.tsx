import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PetForm } from "@/modules/pets/components/pet-form"
import { findTutorProfileByUserId } from "@/modules/tutor/infrastructure/repository"
import { requireAuthOrRedirect } from "@/modules/identity/application/get-session"
import { parseNextParam } from "@/modules/invite/domain/onboarding-next"

export const metadata: Metadata = {
  title: "Novo pet",
}

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const session = await requireAuthOrRedirect()
  const [tutorProfile, { next: rawNext }] = await Promise.all([
    findTutorProfileByUserId(session.id),
    searchParams,
  ])

  if (!tutorProfile) {
    redirect("/onboarding/tutor")
  }

  /**
   * Destino após salvar. Sem `next`, continua indo para a lista de pets — o
   * comportamento de quem entrou por "Meus pets" e só queria cadastrar mais um.
   *
   * COM `next`, volta para onde a pessoa estava: quem chega aqui vindo de um
   * convite tem um objetivo em andamento (solicitar atendimento a UM
   * profissional específico) e o cadastro do pet é um desvio no meio dele.
   * Terminar na lista de pets obrigava a pessoa a reencontrar sozinha o
   * profissional — o mesmo dead-end que o `next` do onboarding já resolvia,
   * mas que esta rota, criada para outro contexto, não conhecia.
   *
   * `parseNextParam` é a MESMA validação do login e do onboarding: só caminho
   * interno passa, nunca URL absoluta ou protocol-relative. Um `next` hostil
   * não vira redirect externo.
   */
  const destinoAposSalvar = parseNextParam(rawNext) ?? "/me/pets"

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-4">
        <Link
          href="/me/pets"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1" })}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Link>
      </div>
      <PageHeader
        title="Adicionar pet"
        description="Quanto mais contexto, melhores as recomendações e solicitações."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do pet</CardTitle>
        </CardHeader>
        <CardContent>
          <PetForm mode="create" redirectTo={destinoAposSalvar} showSkip={false} />
        </CardContent>
      </Card>
    </div>
  )
}
