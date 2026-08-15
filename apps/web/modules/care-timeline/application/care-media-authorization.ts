import "server-only"

/**
 * Módulo: care-timeline
 * Camada: application — ÚNICO portão de autorização da mídia do Diário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPERFÍCIE (mudou em R2A)
 *
 * Em R1 esta lógica ficou deliberadamente inalcançável do browser: expor a
 * emissão de tickets sem a cota de 3 seria um minter de upload sem teto.
 * Agora `CareMedia` existe e a cota é aplicada ATOMICAMENTE na publicação, sob
 * o lock da request — então a emissão pode ser exposta.
 *
 * A exposição vive em `application/actions.ts` (arquivo "use server"), como
 * uma casca fina sobre estas funções. Este módulo continua `server-only`: a
 * regra de autorização não muda de lugar só porque ganhou um endpoint.
 *
 * COTA E TICKETS SÃO COISAS SEPARADAS — e isso é intencional:
 *   - um ticket autoriza gravar UM objeto num path único, nada mais;
 *   - ticket NÃO reserva cota e NÃO garante publicação;
 *   - a cota de 3 é contada no array recebido pelo publish, dentro da
 *     transação. Duas abas emitindo 10 tickets em paralelo continuam
 *     produzindo no máximo 3 mídias por atualização; o excedente vira órfão
 *     rastreável (ver docs/care-media-orphans.md), nunca mídia publicada.
 * Tentar reservar cota na emissão exigiria estado de reserva com expiração —
 * mais superfície, mais falha, para uma garantia que a transação já dá de graça.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AUTORIZAÇÃO — as mesmas três camadas de publishCareUpdateAction
 *
 *   1. sessão autenticada
 *   2. é o PROFISSIONAL desta request (posse lida do banco, nunca do client)
 *   3. request IN_PROGRESS e sem disputa aberta
 *
 * Nenhuma regra nova foi inventada: se o profissional não pode publicar texto
 * agora, também não pode obter permissão para gravar um arquivo agora.
 */

import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findRequestWithOwnershipContext } from "@/modules/service-request/infrastructure/repository"
import { findActiveDisputeByRequestId } from "@/modules/disputes/infrastructure/queries"
import { findCareMediaWithContext } from "../infrastructure/repository"
import { unstable_rethrow } from "next/navigation"

import {
  countCareMediaObjectsForRequest,
  createCareMediaUploadTicket,
  createCareMediaReadUrl,
  type CareMediaUploadTicket,
} from "@/lib/storage/care-media"
import {
  CARE_MEDIA_ALLOWED_TYPES,
  CARE_MEDIA_MAX_OBJECTS_PER_REQUEST,
  type CareMediaMimeType,
} from "@/lib/storage/care-media-path"

export type CareMediaAuthorizationResult =
  | { ok: true; ticket: CareMediaUploadTicket }
  | { ok: false; reason: CareMediaDenialReason; message: string }

/**
 * Motivos que PODEM atravessar para o browser.
 *
 * `DENIED` cobre, de propósito, tanto "a solicitação não existe" quanto "existe
 * mas não é sua". Uma versão anterior tinha `NOT_FOUND` e `NOT_OWNER`
 * separados, com a mesma MENSAGEM, e um comentário afirmando que a distinção
 * ficava "só no servidor" — o que era falso: a Server Action devolve o objeto
 * inteiro ao cliente, então o `reason` reabria exatamente o oráculo de
 * existência que a mensagem fechava. Um profissional podia varrer ids e
 * descobrir quais requests existem. Agora a distinção existe apenas no LOG.
 */
export type CareMediaDenialReason =
  | "DENIED"
  | "INVALID_STATE"
  | "DISPUTE_FROZEN"
  | "UNSUPPORTED_TYPE"
  | "UPLOAD_QUOTA"
  | "STORAGE_FAILURE"

/** Causa real, só para log do servidor. NUNCA retornada ao cliente. */
type CausaInternaNegacao = "NOT_FOUND" | "NOT_OWNER"

const MENSAGEM_SEM_ACESSO = "Solicitação não encontrada."

function negarAcesso(causa: CausaInternaNegacao, requestId: string): CareMediaAuthorizationResult {
  // A causa precisa ser diagnosticável por quem opera, sem virar oráculo para
  // quem chama. Só id técnico, sem PII.
  console.info("[care-media] upload_denied", { causa, requestId })
  return { ok: false, reason: "DENIED", message: MENSAGEM_SEM_ACESSO }
}

export async function authorizeCareMediaUpload(input: {
  requestId: string
  mimeType: string
}): Promise<CareMediaAuthorizationResult> {
  try {
    // (1) sessão + persona profissional
    const { session } = await requireProfessionalContext()

    // Tipo antes de qualquer I/O: barato e recusa HEIC/vídeo na porta.
    if (!CARE_MEDIA_ALLOWED_TYPES.includes(input.mimeType as CareMediaMimeType)) {
      return {
        ok: false,
        reason: "UNSUPPORTED_TYPE",
        message: "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP.",
      }
    }

    const ctx = await findRequestWithOwnershipContext(input.requestId)
    if (!ctx) {
      return negarAcesso("NOT_FOUND", input.requestId)
    }

    // (2) posse — só o profissional responsável. O tutor NÃO publica mídia.
    if (ctx.professionalUserId !== session.id) {
      return negarAcesso("NOT_OWNER", input.requestId)
    }

    // (3) estado operacional
    if (ctx.request.status !== "IN_PROGRESS") {
      return {
        ok: false,
        reason: "INVALID_STATE",
        message: "Só é possível anexar fotos durante um atendimento em andamento.",
      }
    }

    const dispute = await findActiveDisputeByRequestId(input.requestId)
    if (dispute) {
      return {
        ok: false,
        reason: "DISPUTE_FROZEN",
        message:
          "Esta solicitação está em disputa. A timeline de cuidado ficou congelada e não pode ser alterada.",
      }
    }

    // (4) freio de CUSTO do bucket — não é cota de publicação.
    //
    // A cota de 3 vive na transação de publicação e continua sendo a regra de
    // produto. Este teto é outra coisa: impede que a emissão de tickets, que
    // não deixa rastro para contar, seja usada para encher o bucket. A revisão
    // de segurança mediu ~63 tickets/s e ~0,5 GB de escrita autorizada por
    // rajada, sem nenhum limite.
    //
    // FAIL-OPEN em `null`, deliberado — avaliado com a revisão de segurança:
    //   * `list` e `createSignedUploadUrl` usam o MESMO serviço e a MESMA
    //     credencial. A falha é correlacionada: se não dá para contar,
    //     quase certamente também não dá para subir. Fail-closed protegeria
    //     pouco e cobraria caro.
    //   * o cliente não controla o resultado do `list` — informa apenas
    //     requestId (validado por regex antes) e mimeType. Não há como induzir
    //     a falha para escapar do teto.
    //   * o custo do fail-closed é direto e frequente: um soluço do Storage
    //     impediria um profissional de documentar o cuidado durante um
    //     atendimento real. O risco que este teto endereça é de CUSTO, não de
    //     exposição de dado — não justifica bloquear o fluxo principal.
    // Risco residual registrado: numa indisponibilidade PARCIAL (list fora,
    // upload de pé) o teto some enquanto durar. Observável pelo log de
    // count_objects_failed.
    const objetosExistentes = await countCareMediaObjectsForRequest(input.requestId)
    if (
      objetosExistentes !== null &&
      objetosExistentes >= CARE_MEDIA_MAX_OBJECTS_PER_REQUEST
    ) {
      console.warn("[care-media] upload_quota_reached", {
        requestId: input.requestId,
        objetos: objetosExistentes,
      })
      return {
        ok: false,
        reason: "UPLOAD_QUOTA",
        message:
          "Muitas fotos enviadas neste atendimento. Publique as pendentes antes de enviar outras.",
      }
    }

    const ticket = await createCareMediaUploadTicket({
      requestId: input.requestId,
      mimeType: input.mimeType as CareMediaMimeType,
    })

    return { ok: true, ticket }
  } catch (err) {
    // Erros internos do Next (redirect, notFound) NÃO são falha desta função —
    // são o mecanismo de auth funcionando. `requireProfessionalContext` chama
    // `redirect()` para quem não é profissional, e engolir isso fazia negação
    // de PAPEL virar "não foi possível preparar o envio, tente novamente":
    // mensagem que convida a repetir uma operação permanentemente impossível,
    // e que em produção fica indistinguível de uma queda real do Storage.
    // `unstable_rethrow` devolve esses erros ao framework antes de classificar.
    unstable_rethrow(err)

    console.error("[care-media] authorize_upload_failed", {
      erro: String(err).slice(0, 120),
    })
    return {
      ok: false,
      reason: "STORAGE_FAILURE",
      message: "Não foi possível preparar o envio da foto. Tente novamente.",
    }
  }
}

/**
 * URL assinada de leitura para um participante da request.
 *
 * Diferente do upload, aqui o TUTOR também é autorizado — ler é o ponto
 * inteiro da feature. A posse é verificada pelos dois lados
 * (tutorUserId / professionalUserId), exatamente como getCareTimelineAction.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A ENTRADA É UM ID DE CareMedia, NUNCA UM PATH.
 *
 * Esta é a mudança central em relação ao R1, onde a função aceitava um
 * `storagePath` do chamador — o que fazia "conhecer o path" ser condição
 * suficiente para obter a URL. Agora o path vem do BANCO, resolvido a partir
 * do id, e o chamador não tem como apontar para um objeto arbitrário.
 *
 * Os cinco elos, todos provados antes de qualquer assinatura:
 *   1. a CareMedia EXISTE (linha só nasce após validação de magic bytes —
 *      logo, existir já prova que o conteúdo foi verificado);
 *   2. pertence a um CareUpdate real (join, não confiança na entrada);
 *   3. esse CareUpdate NÃO está soft-deletado (evidência preservada para o
 *      admin, invisível para tutor e profissional);
 *   4. o CareUpdate pertence a uma ServiceRequest concreta;
 *   5. quem pede é tutor OU profissional daquela request.
 *
 * Só então a URL é emitida — e `createCareMediaReadUrl` ainda re-confere que o
 * path pertence à request, como terceira camada.
 *
 * O que isto torna impossível, e antes não era:
 *   - ÓRFÃO (enviado, nunca publicado): não tem linha CareMedia → sem id → sem URL;
 *   - REPROVADO por magic bytes: idem, nunca chega a ter linha;
 *   - APAGADO (CareUpdate soft-deletado): barrado no elo 3;
 *   - MÍDIA DE OUTRA REQUEST: barrado no elo 5, e de novo na checagem de path.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function authorizeCareMediaRead(input: {
  careMediaId: string
}): Promise<string | null> {
  try {
    const { requireAuth } = await import("@/modules/identity/application/get-session")
    const session = await requireAuth()

    // Elos 1, 2 e 4: mídia, atualização-mãe e request vêm juntas do banco.
    const media = await findCareMediaWithContext(input.careMediaId)
    if (!media) return null

    // Elo 3: soft delete esconde para as partes (o admin tem contrato próprio).
    if (media.careUpdateDeletedAt) return null

    // Elo 5: participante da request de origem — lida do banco, não da entrada.
    if (media.tutorUserId !== session.id && media.professionalUserId !== session.id) {
      return null
    }

    return createCareMediaReadUrl({
      path: media.storagePath,
      requestId: media.requestId,
    })
  } catch (err) {
    // Mesma razão do upload: redirect/notFound do Next são o auth funcionando,
    // não falha de leitura — devolvê-los ao framework antes de virar `null`.
    unstable_rethrow(err)
    console.error("[care-media] authorize_read_failed", { erro: String(err).slice(0, 120) })
    return null
  }
}
