import "server-only"

/**
 * Módulo: care-timeline
 * Camada: application — ÚNICO portão de autorização da mídia do Diário.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO NÃO É UMA SERVER ACTION (ainda)
 *
 * Marcar este arquivo com "use server" publicaria um endpoint capaz de emitir
 * autorizações de escrita no bucket para qualquer profissional com um
 * atendimento em andamento — sem nenhuma UI que o consuma e, principalmente,
 * SEM a cota de 3 arquivos por atualização, que só pode ser contada quando
 * `CareMedia` existir (R2). O resultado seria um minter de upload sem teto:
 * cada chamada gera um destino gravável novo, e nada limitaria quantos.
 *
 * Enquanto a cota não existe, a função fica como módulo server-only comum,
 * exercitável por script de QA e por testes, mas inalcançável a partir do
 * browser. Em R2 ela vira Server Action junto com a contagem real.
 *
 * (Isto é, deliberadamente e por tempo limitado, o mesmo padrão registrado
 * como achado em edit/deleteCareUpdateAction — "capacidade de domínio sem
 * superfície de produto". A diferença é que ali a exposição já existe e aqui
 * ela é justamente o que estamos evitando.)
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
import {
  createCareMediaUploadTicket,
  createCareMediaReadUrl,
  type CareMediaUploadTicket,
} from "@/lib/storage/care-media"
import {
  CARE_MEDIA_ALLOWED_TYPES,
  type CareMediaMimeType,
} from "@/lib/storage/care-media-path"

export type CareMediaAuthorizationResult =
  | { ok: true; ticket: CareMediaUploadTicket }
  | { ok: false; reason: CareMediaDenialReason; message: string }

export type CareMediaDenialReason =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "INVALID_STATE"
  | "DISPUTE_FROZEN"
  | "UNSUPPORTED_TYPE"
  | "STORAGE_FAILURE"

/**
 * Mensagens deliberadamente iguais para NOT_FOUND e NOT_OWNER.
 *
 * Diferenciar as duas transformaria a função num oráculo de existência: um
 * profissional poderia varrer ids e descobrir quais requests existem no
 * sistema pela mensagem retornada. O `reason` distinto continua disponível
 * para log e teste no servidor; o texto entregue ao usuário, não.
 */
const MENSAGEM_SEM_ACESSO = "Solicitação não encontrada."

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
      return { ok: false, reason: "NOT_FOUND", message: MENSAGEM_SEM_ACESSO }
    }

    // (2) posse — só o profissional responsável. O tutor NÃO publica mídia.
    if (ctx.professionalUserId !== session.id) {
      return { ok: false, reason: "NOT_OWNER", message: MENSAGEM_SEM_ACESSO }
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

    const ticket = await createCareMediaUploadTicket({
      requestId: input.requestId,
      mimeType: input.mimeType as CareMediaMimeType,
    })

    return { ok: true, ticket }
  } catch (err) {
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
 * ⚠️ INCOMPLETA — NÃO LIGAR A NENHUMA UI COMO ESTÁ.
 *
 * O que falta NÃO é uma dependência de dados ("é só esperar CareMedia
 * existir"). São QUATRO ELOS DE AUTORIZAÇÃO ausentes.
 *
 * Hoje a cadeia é apenas: participante da request + o path pertence à request.
 * Ou seja: CONHECER O storagePath BASTA — e isso nunca pode bastar.
 *
 * Consequência concreta se alguém ligar isto a uma tela agora: ficam legíveis,
 * para qualquer participante daquela request, três classes de objeto que não
 * deveriam ser visíveis:
 *   - ÓRFÃOS: enviados e nunca publicados (o docs/care-media-orphans.md
 *     garante que vão existir por construção);
 *   - REPROVADOS: conteúdo que falhou na validação de magic bytes e ainda não
 *     foi apagado;
 *   - APAGADOS: mídia de CareUpdate soft-deletada — cujo objeto físico é
 *     preservado de propósito, para auditoria/disputa.
 *
 * O tutor vendo a foto que o profissional subiu e desistiu de publicar, ou que
 * apagou, é exatamente o "eu tinha apagado aquilo" que destrói a confiança que
 * esta feature existe para construir.
 *
 * R2 é OBRIGADO a acrescentar, ANTES de qualquer consumo real, nesta ordem:
 *   (a) CareMedia carregada por ID — o path vem do BANCO, nunca do cliente;
 *   (b) CareMedia.careUpdateId → CareUpdate válido e não oculto (soft delete);
 *   (c) CareUpdate.requestId === a MESMA ServiceRequest autorizada (join real,
 *       não confiança na entrada);
 *   (d) participante autorizado (a checagem que já existe abaixo);
 *   (e) validação de magic bytes concluída (ex.: CareMedia.validatedAt não
 *       nulo) — ver readCareMediaHeader em lib/storage/care-media.ts;
 *   → somente então emitir a signed read.
 *
 * A re-validação de path dentro de createCareMediaReadUrl permanece como
 * camada final, nunca como substituta de (a)–(e).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function authorizeCareMediaRead(input: {
  requestId: string
  path: string
}): Promise<string | null> {
  try {
    const { requireAuth } = await import("@/modules/identity/application/get-session")
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(input.requestId)
    if (!ctx) return null

    if (ctx.tutorUserId !== session.id && ctx.professionalUserId !== session.id) {
      return null
    }

    return createCareMediaReadUrl({ path: input.path, requestId: input.requestId })
  } catch (err) {
    console.error("[care-media] authorize_read_failed", { erro: String(err).slice(0, 120) })
    return null
  }
}
