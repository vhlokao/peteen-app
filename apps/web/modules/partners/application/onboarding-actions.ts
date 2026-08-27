"use server"

/**
 * módulo: partners
 * camada: application — onboarding público (Etapa 6.1)
 *
 * Sem login de parceiro. Cria/atualiza entidade Partner e Trust Graph.
 */

import { revalidatePath } from "next/cache"

import { createTrustConnection } from "@/modules/trust-graph/infrastructure/repository"
import { TRUST_CONNECTION_WEIGHTS } from "@/modules/trust-graph/domain/constants"
import { BUSCA_PROFISSIONAIS_INDISPONIVEL } from "../domain/constants"
import { recordPartnerAudit } from "./partner-audit"
import {
  emitirSessaoOnboarding,
  lerSessaoOnboarding,
  ONBOARDING_SESSAO_INVALIDA,
} from "./onboarding-session"
import { requestVerification } from "@/modules/verification/application/request-verification"
import { ensurePartnerVerificationRequest } from "@/modules/verification/infrastructure/repository"
import {
  createPartnerOnboarding,
  updatePartnerOnboardingBusiness,
  updatePartnerOnboardingTrust,
  completePartnerOnboarding,
  getPartnerById,
  getProfessionalsForOnboarding,
  getPartnerOperationalMetrics,
  getPartnerOnboardingResult,
} from "../infrastructure/repository"
import type {
  PartnerOnboardingBusinessInput,
  PartnerOnboardingTrustInput,
  PartnerOnboardingCompleteResult,
  ProfessionalOnboardingOption,
  PartnerOperationalMetrics,
} from "../domain/types"

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/**
 * Profissionais para a etapa Recomendações.
 *
 * Devolve `ActionResult` e não um array cru porque array não sabe dizer
 * "falhou". O repository devolvia `[]` no `catch`, e a tela então anunciava
 * "Nenhum profissional encontrado em X" para um timeout de banco — afirmando
 * ao parceiro que a cidade dele está vazia quando ninguém chegou a olhar.
 *
 * Aqui as duas situações passam a ter formas diferentes:
 *   { ok: true,  data: [] }  → a busca rodou e a cidade não tem ninguém
 *   { ok: false, error }     → a busca não rodou; nada foi provado sobre a cidade
 */
export async function getProfessionalsForOnboardingAction(
  city?: string
): Promise<ActionResult<ProfessionalOnboardingOption[]>> {
  try {
    const data = await getProfessionalsForOnboarding(city)
    return { ok: true, data }
  } catch (err) {
    // Log no servidor com o detalhe real; para o cliente, só a mensagem humana.
    console.error("[getProfessionalsForOnboardingAction]", err)
    return { ok: false, error: BUSCA_PROFISSIONAIS_INDISPONIVEL }
  }
}

export async function savePartnerOnboardingBusinessAction(
  input: PartnerOnboardingBusinessInput
): Promise<ActionResult<{ partnerId: string; slug: string }>> {
  try {
    if (!input.businessName.trim() || !input.city.trim() || !input.state.trim() || !input.phone.trim()) {
      return { ok: false, error: "Preencha nome, cidade, estado e telefone." }
    }

    const partner = await createPartnerOnboarding(input)

    // A capability nasce AQUI e só aqui: este é o único ponto em que o servidor
    // acabou de criar o Partner e portanto sabe, sem depender do cliente, de
    // quem é a sessão. Todas as etapas seguintes derivam o parceiro deste
    // cookie — nenhuma volta a aceitar um id como autoridade.
    const emitida = await emitirSessaoOnboarding(partner.id)
    if (!emitida) {
      return { ok: false, error: ONBOARDING_SESSAO_INVALIDA }
    }

    await recordPartnerAudit("partner.onboarding_started", partner.id, {
      category:     partner.category,
      businessName: partner.businessName,
      city:         partner.city,
    })

    revalidatePath("/admin/partners")
    return { ok: true, data: { partnerId: partner.id, slug: partner.slug } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar dados do negócio"
    return { ok: false, error: msg }
  }
}

/**
 * O `partnerId` do parâmetro foi REMOVIDO do contrato.
 *
 * Mantê-lo "por compatibilidade" e apenas ignorá-lo deixaria no código uma
 * pergunta permanente — "este id é usado ou não?" — que só se responde lendo o
 * corpo inteiro. Tirando o parâmetro, a resposta vira impossível de errar.
 */
export async function updatePartnerOnboardingBusinessAction(
  input: PartnerOnboardingBusinessInput
): Promise<ActionResult<{ partnerId: string }>> {
  try {
    const sessao = await lerSessaoOnboarding()
    if (!sessao.ok) return { ok: false, error: ONBOARDING_SESSAO_INVALIDA }

    const partner = await updatePartnerOnboardingBusiness(sessao.partnerId, input)
    return { ok: true, data: { partnerId: partner.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao atualizar" }
  }
}

export async function savePartnerOnboardingTrustAction(
  input: PartnerOnboardingTrustInput
): Promise<ActionResult<void>> {
  try {
    const sessao = await lerSessaoOnboarding()
    if (!sessao.ok) return { ok: false, error: ONBOARDING_SESSAO_INVALIDA }

    // `input.partnerId` continua no tipo (o formulário ainda o envia), mas
    // perdeu toda autoridade: o alvo é sobrescrito pelo id da capability. É por
    // aqui que a verificação de PARTNER era alcançável com id alheio.
    const partner = await updatePartnerOnboardingTrust({
      ...input,
      partnerId: sessao.partnerId,
    })

    if (input.requestVerification) {
      const notes =
        [
          input.yearsInBusiness != null ? `Anos: ${input.yearsInBusiness}` : null,
          input.hasCnpj ? "Possui CNPJ" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined

      const verificationResult = await requestVerification({
        entityType: "PARTNER",
        entityId:   partner.id,
        notes,
      })

      if (!verificationResult.ok) {
        const ensured = await ensurePartnerVerificationRequest(partner.id, notes)
        if (!ensured) {
          return {
            ok: false,
            error: verificationResult.error ?? "Não foi possível registrar solicitação de verificação.",
          }
        }
      }

      await recordPartnerAudit("partner.verification_requested", partner.id, {
        yearsInBusiness: input.yearsInBusiness ?? null,
        hasCnpj:         input.hasCnpj,
      })
    }

    revalidatePath("/admin/partners")
    return { ok: true, data: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao salvar confiança" }
  }
}

export async function savePartnerOnboardingRecommendationsAction(
  professionalIds: string[]
): Promise<ActionResult<{ connectionsCreated: number }>> {
  try {
    const sessao = await lerSessaoOnboarding()
    if (!sessao.ok) return { ok: false, error: ONBOARDING_SESSAO_INVALIDA }

    const partner = await getPartnerById(sessao.partnerId)
    if (!partner) return { ok: false, error: "Parceiro não encontrado." }
    if (partner.onboardingStatus === "COMPLETED") {
      return { ok: false, error: "Onboarding já concluído." }
    }

    const uniqueIds = [...new Set(professionalIds.filter(Boolean))]
    if (uniqueIds.length === 0) {
      return { ok: true, data: { connectionsCreated: 0 } }
    }

    let connectionsCreated = 0
    let firstRecommendation = false

    for (const targetId of uniqueIds) {
      try {
        await createTrustConnection({
          sourceType:      "PARTNER",
          sourceId:        partner.id,
          sourceName:      partner.businessName,
          sourcePartnerId: partner.id,
          targetId,
          connectionType:  "PARTNER_RECOMMENDS_PROFESSIONAL",
          weight:          TRUST_CONNECTION_WEIGHTS.PARTNER_RECOMMENDS_PROFESSIONAL,
        })
        connectionsCreated++
        if (!firstRecommendation) {
          firstRecommendation = true
          await recordPartnerAudit("partner.first_recommendation", partner.id, {
            targetId,
            businessName: partner.businessName,
          })
        }
      } catch (err) {
        if (!(err instanceof Error && err.message.includes("Unique constraint"))) {
          throw err
        }
      }
    }

    revalidatePath("/admin/trust-graph")
    revalidatePath("/discover", "layout")
    return { ok: true, data: { connectionsCreated } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao criar recomendações" }
  }
}

export async function completePartnerOnboardingAction(): Promise<
  ActionResult<PartnerOnboardingCompleteResult>
> {
  try {
    const sessao = await lerSessaoOnboarding()
    if (!sessao.ok) return { ok: false, error: ONBOARDING_SESSAO_INVALIDA }

    const partner = await completePartnerOnboarding(sessao.partnerId)

    const result = await getPartnerOnboardingResult(sessao.partnerId)

    await recordPartnerAudit("partner.onboarding_completed", partner.id, {
      businessName:        partner.businessName,
      slug:                partner.slug,
      recommendationCount: result.recommendationCount,
      activationScore:     result.activationScore,
    })

    revalidatePath("/admin/partners")
    revalidatePath("/admin/verifications")
    revalidatePath(`/partners/${partner.slug}`)
    revalidatePath("/discover", "layout")

    return { ok: true, data: result }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao concluir onboarding" }
  }
}

/**
 * Leitura protegida pela MESMA capability das mutações.
 *
 * Métricas operacionais de um parceiro não são "menos graves" por serem
 * leitura — eram o pior item da lista original, porque expunham o desempenho
 * de um negócio a qualquer um que soubesse o id.
 */
export async function getPartnerOperationalMetricsAction(): Promise<PartnerOperationalMetrics | null> {
  const sessao = await lerSessaoOnboarding()
  if (!sessao.ok) return null
  return getPartnerOperationalMetrics(sessao.partnerId)
}

/**
 * Retomada do onboarding — o parceiro vem da capability, não da URL.
 *
 * É isto que faz "retomar" significar "voltar ao SEU cadastro" em vez de
 * "abrir o cadastro de quem eu souber o id".
 */
export async function getPartnerOnboardingResumeAction() {
  const sessao = await lerSessaoOnboarding()
  if (!sessao.ok) return null

  const partner = await getPartnerById(sessao.partnerId)
  if (!partner || partner.onboardingStatus === "COMPLETED") return null
  return partner
}
