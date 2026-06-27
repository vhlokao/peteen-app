"use server"

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
