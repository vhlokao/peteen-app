import { NextResponse } from "next/server"

import { ensureVisitorKey } from "@/modules/invite/application/visitor-key"
import { trackInviteVisitorAssociation } from "@/modules/invite/application/track"
import { recordInviteOpen } from "@/modules/invite/infrastructure/repository"
import { findPublicProfessionalById } from "@/modules/professional/infrastructure/repository"
import { getAuthContext } from "@/modules/identity/application/get-session"

/**
 * POST /api/invite/visit — registra a abertura de uma landing de convite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM ROUTE HANDLER
 *
 * É o único contexto (junto de Server Actions) onde o Next permite EMITIR
 * cookie, e a chave anônima do visitante precisa nascer exatamente na
 * primeira visita. A landing é um Server Component e não poderia fazê-lo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE ENDPOINT NÃO CONCEDE NADA
 *
 * Ele não autentica, não autoriza e não devolve dado nenhum — só grava uma
 * linha de observabilidade. Um atacante que o chame em loop consegue, no
 * máximo, inflar a contagem de aberturas da PRÓPRIA chave dele, que o índice
 * único já colapsa numa linha só por profissional. Não há privilégio a
 * escalar, e por isso não há autenticação a exigir: exigi-la mataria
 * justamente o caso de uso (visitante anônimo).
 *
 * O `professionalId` é VALIDADO contra o banco antes de virar linha: sem
 * isso, qualquer string viraria uma visita órfã (a FK barraria, mas só
 * depois de um round-trip inútil) e o endpoint viraria sonda de existência
 * de perfil — daí a resposta ser sempre 204, independente do resultado.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { professionalId?: unknown }
    const professionalId = body?.professionalId

    if (typeof professionalId !== "string" || professionalId.length === 0 || professionalId.length > 60) {
      return new NextResponse(null, { status: 204 })
    }

    // Mesma regra de disponibilidade da landing: só conta visita para
    // profissional que de fato existe e está publicável.
    const professional = await findPublicProfessionalById(professionalId)
    if (!professional || professional.services.length === 0) {
      return new NextResponse(null, { status: 204 })
    }

    const visitorKey = await ensureVisitorKey()
    await recordInviteOpen(visitorKey, professionalId)

    // Se quem abriu JÁ está autenticado, a visita passa a ter dono agora —
    // sem isso, um tutor que já tinha conta e chegou por um convite jamais
    // teria a Request seguinte atribuída à landing certa. Associação não é
    // cadastro: `signedUpAt` continua reservado ao TutorProfile novo.
    const ctx = await getAuthContext()
    if (ctx.authenticated) {
      await trackInviteVisitorAssociation(ctx.user.id)
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[POST /api/invite/visit]", err)
    // 204 mesmo em falha: o cliente não tem nada a fazer com o erro, e
    // devolver detalhe transformaria o endpoint num oráculo.
    return new NextResponse(null, { status: 204 })
  }
}
