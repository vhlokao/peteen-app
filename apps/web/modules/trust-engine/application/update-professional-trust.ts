import "server-only"

/**
 * módulo: trust-engine
 * camada: application
 *
 * updateProfessionalTrust — recalcula e persiste o Trust Score de um profissional.
 *
 * Chamado após qualquer evento que possa alterar o score:
 *   - Review criada (createReviewAction)
 *   - Atendimento concluído (completeServiceRequestAction)
 *   - TrustEvent relevante criado
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `server-only` E NÃO `"use server"`
 *
 * Este arquivo começava com `"use server"`. Em Next.js isso transforma TODO
 * export num endpoint RPC — e esta função recebe `professionalId` por parâmetro
 * e escreve `trustScore`/`trustLevel` no perfil. Ou seja: existia uma segunda
 * porta, sem fechadura, para a mesma mutação que `recalculateSingleTrustAction`
 * protege com `assertAdmin()`.
 *
 * Ela nunca foi um entrypoint público: os 12 call sites são todos internos
 * (review, conclusão de request, verification, recomendação de partner,
 * backoffice) e cada um já autoriza no seu próprio fluxo. A correção portanto
 * não é adicionar guard aqui dentro — é TIRAR da superfície RPC, que é o mesmo
 * padrão aplicado em modules/verification/application/request-verification.ts.
 *
 * `server-only` faz o build quebrar se algum Client Component importar isto,
 * o que impede a exposição de voltar por descuido.
 *
 * CONTRATO: esta função NÃO autentica. Quem chama é responsável por ter
 * autorizado a operação antes.
 *
 * Design:
 *   - Falha silenciosa: erros são logados mas NÃO propagados para quem chamou.
 *     O Trust Engine não pode quebrar fluxos críticos (criação de review, conclusão).
 *   - Idempotente: pode ser chamado múltiplas vezes sem efeitos colaterais.
 *   - Fire-and-forget seguro: pode ser aguardado quando a UI precisa do score atualizado.
 */

import { prisma } from "@/lib/prisma/client"
import { revalidatePath } from "next/cache"
import { calculateTrustScore } from "./calculate-trust-score"

export async function updateProfessionalTrust(professionalId: string): Promise<void> {
  try {
    const result = await calculateTrustScore(professionalId)

    await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        trustScore:     result.score,
        trustLevel:     result.level,
        trustUpdatedAt: new Date(),
      },
    })

    // Invalida cache de descoberta — URLs reais, sem route group prefix
    revalidatePath("/discover")
    revalidatePath(`/discover/${professionalId}`)
  } catch (err) {
    console.error("[updateProfessionalTrust]", err)
    // Falha silenciosa — não lança erro para preservar a operação principal
  }
}
