"use server"

/**
 * Módulo: care-timeline
 * Camada: application (Server Actions)
 *
 * Care Timeline V0 — o profissional publica atualizações de cuidado dentro de
 * uma request IN_PROGRESS; o tutor visualiza. Toda mutação passa pelo padrão
 * de 3 camadas: auth → ownership → guards de estado/disputa/janela.
 *
 * Guards de negócio (decisões aprovadas):
 *   - Publicar/editar/excluir só com request IN_PROGRESS
 *   - Bloqueado se houver disputa aberta (congelamento — evidência preservada)
 *   - Edição só pelo autor, dentro de 15 min da publicação
 *   - Exclusão é soft (deletedAt) — Admin ainda enxerga
 */

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"

import { requireAuth } from "@/modules/identity/application/get-session"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findRequestWithOwnershipContext } from "@/modules/service-request/infrastructure/repository"
import { findActiveDisputeByRequestId } from "@/modules/disputes/infrastructure/queries"
import type { ActionResult } from "@/modules/tutor/domain/types"
import {
  CreateCareUpdateSchema,
  CARE_UPDATE_CONTENT_MIN,
  CARE_UPDATE_CONTENT_MAX,
  CARE_UPDATE_EDIT_WINDOW_MS,
  CARE_UPDATE_MAX_MEDIA,
  type CareUpdate,
  type CareMediaView,
  type CareUpdateWithInternalMedia,
  type CreateCareUpdateInput,
  type ValidatedCareMedia,
} from "../domain/types"
import { resolveEffectiveOccurredAt } from "../domain/occurred-at"
import {
  createCareUpdateAtomic,
  editCareUpdate,
  softDeleteCareUpdate,
  findCareUpdateById,
  getCareTimeline,
  recordCareUpdateAudit,
} from "../infrastructure/repository"
import {
  authorizeCareMediaUpload,
  type CareMediaAuthorizationResult,
} from "./care-media-authorization"
import {
  careMediaPathBelongsToRequest,
  declaredMimeTypeFromCareMediaPath,
} from "@/lib/storage/care-media-path"
import {
  createCareMediaReadUrl,
  deleteCareMediaObject,
  readCareMediaForValidation,
} from "@/lib/storage/care-media"
import {
  careMediaRejectionMessage,
  validateCareMediaContent,
  CARE_MEDIA_SIGNATURE_READ_LENGTH,
} from "@/lib/storage/care-media-validation"

const DISPUTE_FROZEN_MESSAGE =
  "Esta solicitação está em disputa. A timeline de cuidado ficou congelada e não pode ser alterada."

const CONCURRENT_CHANGE_MESSAGE =
  "O estado da solicitação mudou. Recarregue a página e tente novamente."

/**
 * Log de erro seguro e categorizado.
 *
 * `console.error("[x]", err)` com um erro do Prisma despeja o objeto `data`
 * INTEIRO da query no log — incluindo o `content` livre da atualização (que
 * pode conter saúde, medicação, incidente) e os `storagePath` da mídia. Foi
 * comprovado na revisão de segurança provocando um erro real.
 *
 * Aqui só sai categoria + mensagem truncada, mesma disciplina já aplicada em
 * lib/storage/care-media.ts. `unstable_rethrow` vem antes de toda chamada:
 * redirect/notFound do Next não são erro de domínio e precisam voltar ao
 * framework, nunca virar log e resposta genérica.
 */
function logErroDeAcao(escopo: string, err: unknown): void {
  const mensagem = err instanceof Error ? err.message : String(err)
  console.error(`[care-timeline] ${escopo}`, { erro: mensagem.slice(0, 120) })
}

function revalidateCarePaths(requestId: string) {
  revalidatePath(`/requests/${requestId}`)
  revalidatePath(`/tutor/requests/${requestId}`)
  revalidatePath(`/requests/${requestId}/diario`)
  revalidatePath(`/tutor/requests/${requestId}/diario`)
}

// ─────────────────────────────────────────────────────────────────────────────
// MÍDIA — emissão de ticket de upload (superfície pública, R2A)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Autoriza o envio de UMA foto e devolve o destino já assinado.
 *
 * Casca fina sobre `authorizeCareMediaUpload`, que concentra a regra. Toda a
 * validação (sessão, papel, posse da request, IN_PROGRESS, disputa) acontece
 * lá e é lida do banco — o cliente informa apenas `requestId` e o tipo do
 * arquivo. O PATH é gerado no servidor; o cliente nunca escolhe onde grava.
 *
 * Um ticket não reserva cota nem promete publicação: quem limita a 3 é a
 * transação de publicação. Ver o cabeçalho de care-media-authorization.ts.
 */
export async function requestCareMediaUploadTicketAction(input: {
  requestId: string
  mimeType: string
}): Promise<CareMediaAuthorizationResult> {
  return authorizeCareMediaUpload(input)
}

// ─────────────────────────────────────────────────────────────────────────────
// MÍDIA — fronteira de confiança pós-upload
// ─────────────────────────────────────────────────────────────────────────────

type MediaValidationOutcome =
  | { ok: true; media: ValidatedCareMedia[] }
  | { ok: false; error: string }

/**
 * Transforma paths recebidos do cliente em mídia CONFIÁVEL — ou recusa.
 *
 * Roda INTEIRAMENTE FORA da transação: é I/O de rede (baixa cada objeto do
 * Storage) e não pode acontecer com o lock da request na mão.
 *
 * Cada path atravessa quatro portas, nesta ordem:
 *   1. pertence a ESTA request? (`careMediaPathBelongsToRequest` — comparação
 *      exata, cobre traversal e path de outro atendimento);
 *   2. o objeto EXISTE no bucket? (se o cliente inventou um path, não existe);
 *   3. os BYTES são JPEG/PNG/WebP de verdade? (magic bytes — o bucket aceitou
 *      Content-Type declarado, isso não vale nada);
 *   4. o tipo real bate com o declarado e o tamanho respeita o teto?
 *
 * Reprovou em (3) ou (4) → o objeto é APAGADO na hora. Deixá-lo no bucket
 * transformaria uma tentativa maliciosa em armazenamento gratuito e
 * permanente. Falhas em (1) e (2) não apagam nada: em (1) o objeto pode ser de
 * outra request (apagar seria destruir evidência alheia) e em (2) não há
 * objeto.
 *
 * `mimeType` e `sizeBytes` persistidos saem SEMPRE da inspeção do servidor,
 * nunca de campo informado pelo cliente.
 */
async function validateMediaPaths(params: {
  requestId: string
  paths: string[]
}): Promise<MediaValidationOutcome> {
  const { requestId, paths } = params

  if (paths.length > CARE_UPDATE_MAX_MEDIA) {
    return { ok: false, error: `No máximo ${CARE_UPDATE_MAX_MEDIA} fotos por atualização.` }
  }

  // Paths repetidos na mesma publicação: recusa antes de qualquer I/O. Sem
  // isto, o mesmo arquivo poderia ocupar 3 vagas da cota.
  if (new Set(paths).size !== paths.length) {
    return { ok: false, error: "Há fotos repetidas nesta atualização." }
  }

  const validadas: ValidatedCareMedia[] = []

  for (const path of paths) {
    if (!careMediaPathBelongsToRequest(path, requestId)) {
      return { ok: false, error: "Uma das fotos não pertence a este atendimento." }
    }

    const objeto = await readCareMediaForValidation({
      path,
      requestId,
      bytes: CARE_MEDIA_SIGNATURE_READ_LENGTH,
    })
    if (!objeto) {
      return { ok: false, error: "Não foi possível confirmar o envio de uma das fotos." }
    }

    // O tipo declarado é recuperado da EXTENSÃO do path — que o servidor
    // gerou a partir do mimeType informado na emissão do ticket. Não há
    // segunda fonte para essa declaração, e o cliente não controla nenhuma.
    const declarado = declaredMimeTypeFromCareMediaPath(path)
    if (!declarado) {
      return { ok: false, error: "Uma das fotos não pôde ser verificada." }
    }

    const veredito = validateCareMediaContent({
      declaredMimeType: declarado,
      header: objeto.header,
      sizeBytes: objeto.sizeBytes,
    })

    if (!veredito.ok) {
      // Conteúdo reprovado não pode sobreviver no bucket.
      await deleteCareMediaObject({ path, requestId })
      return { ok: false, error: careMediaRejectionMessage(veredito.reason) }
    }

    validadas.push({
      storagePath: path,
      mimeType: veredito.mimeType,
      sizeBytes: veredito.sizeBytes,
    })
  }

  return { ok: true, media: validadas }
}

/**
 * Troca `storagePath` por URL assinada, produzindo o DTO que vai ao cliente.
 * Chamada só DEPOIS de a autorização de leitura ter passado.
 *
 * Mídia cuja assinatura falhar é OMITIDA em vez de derrubar a timeline
 * inteira: o relato de texto é o núcleo da feature e continua legível mesmo se
 * o Storage estiver instável.
 */
async function toCareMediaViews(
  update: CareUpdateWithInternalMedia
): Promise<CareMediaView[]> {
  const views: CareMediaView[] = []
  for (const m of update.media) {
    const signedUrl = await createCareMediaReadUrl({
      path: m.storagePath,
      requestId: update.requestId,
    })
    if (!signedUrl) continue
    views.push({ id: m.id, type: m.type, signedUrl, mimeType: m.mimeType })
  }
  return views
}

/**
 * Projeção final: nunca deixa `storagePath` atravessar para o cliente.
 *
 * Os campos são listados um a um, em vez de espalhar o objeto e sobrescrever
 * `media`. Espalhar funcionaria hoje, mas transformaria toda coluna nova de
 * CareUpdate em campo publicado por acidente — inclusive uma coluna sensível
 * adicionada no futuro. Aqui, publicar algo novo exige escrever a linha.
 */
async function toCareUpdateDTO(update: CareUpdateWithInternalMedia): Promise<CareUpdate> {
  return {
    id: update.id,
    requestId: update.requestId,
    petId: update.petId,
    professionalId: update.professionalId,
    authorId: update.authorId,
    category: update.category,
    content: update.content,
    occurredAt: update.occurredAt,
    createdAt: update.createdAt,
    editedAt: update.editedAt,
    media: await toCareMediaViews(update),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICAR — apenas profissional dono, request IN_PROGRESS, sem disputa
// ─────────────────────────────────────────────────────────────────────────────

export async function publishCareUpdateAction(
  input: CreateCareUpdateInput
): Promise<ActionResult<CareUpdate>> {
  try {
    const { session } = await requireProfessionalContext()

    const parsed = CreateCareUpdateSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      }
    }

    const ctx = await findRequestWithOwnershipContext(parsed.data.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Ownership: só o profissional dono da request publica
    if (ctx.professionalUserId !== session.id) {
      return { success: false, error: "Apenas o profissional responsável pode publicar aqui." }
    }

    // Guard: request precisa estar em andamento
    if (ctx.request.status !== "IN_PROGRESS") {
      return {
        success: false,
        error: "Só é possível publicar atualizações durante um atendimento em andamento.",
      }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(parsed.data.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    // Validação temporal — regra canônica única (domain/occurred-at.ts).
    // O input do formulário tem precisão de minuto; publicar no mesmo minuto do
    // início é legítimo e o valor efetivo é elevado para startedAt.
    const resolved = resolveEffectiveOccurredAt({
      inputOccurredAt: parsed.data.occurredAt,
      startedAt: ctx.request.startedAt,
      now: new Date(),
    })
    if (!resolved.ok) {
      return {
        success: false,
        error:
          resolved.reason === "FUTURE"
            ? "A data/hora da atualização não pode ser no futuro."
            : "A data/hora da atualização não pode ser anterior ao início do atendimento.",
      }
    }
    // A partir daqui só existe UM occurredAt: o efetivo — persistido, auditado
    // e devolvido ao client.
    const occurredAt = resolved.occurredAt

    // ── FRONTEIRA DE CONFIANÇA ────────────────────────────────────────────
    // Todo I/O de Storage acontece AQUI, antes da transação. A transação só
    // recebe mídia já baixada, verificada por magic bytes e medida.
    const validacao = await validateMediaPaths({
      requestId: parsed.data.requestId,
      paths: parsed.data.mediaPaths,
    })
    if (!validacao.ok) {
      return { success: false, error: validacao.error }
    }

    // Criação atômica: re-verifica status/disputa/startedAt/cota sob lock da
    // request no instante da escrita. petId e professionalId são derivados da
    // request travada — nunca do client.
    const resultado = await createCareUpdateAtomic({
      requestId: parsed.data.requestId,
      authorId: session.id,
      category: parsed.data.category,
      content: parsed.data.content,
      occurredAt,
      idempotencyKey: parsed.data.idempotencyKey,
      media: validacao.media,
    })

    if (resultado.kind === "state_changed") {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }
    if (resultado.kind === "media_conflict") {
      return {
        success: false,
        error: "Uma das fotos já foi publicada em outra atualização.",
      }
    }

    const created = resultado.update

    // REPLAY: a mesma intenção já havia sido publicada (duplo clique, retry,
    // segunda aba, resposta perdida após o commit). Devolve a atualização
    // original como SUCESSO — do ponto de vista de quem publicou, o efeito
    // desejado aconteceu — mas sem criar linha nova e sem auditar de novo,
    // porque nenhum fato novo ocorreu.
    if (resultado.kind === "replayed") {
      return { success: true, data: await toCareUpdateDTO(created) }
    }

    // Auditoria: só metadata segura. Nunca URL assinada, token, bytes ou
    // qualquer coisa que reconstrua acesso ao arquivo — um AuditLog é lido por
    // admins e vive muito mais que uma URL de 1 hora.
    await recordCareUpdateAudit(session.id, "care_update.published", created.id, null, {
      requestId: created.requestId,
      category: created.category,
      occurredAt: created.occurredAt.toISOString(),
      authorId: session.id,
      careUpdateId: created.id,
      mediaCount: created.media.length,
      mediaIds: created.media.map((m) => m.id),
      mediaTypes: created.media.map((m) => m.mimeType),
    })

    revalidateCarePaths(parsed.data.requestId)

    return { success: true, data: await toCareUpdateDTO(created) }
  } catch (err) {
    unstable_rethrow(err)
    logErroDeAcao("publish_failed", err)
    return { success: false, error: "Erro interno ao publicar atualização." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LER — tutor OU profissional participante
// ─────────────────────────────────────────────────────────────────────────────

export async function getCareTimelineAction(
  requestId: string
): Promise<ActionResult<CareUpdate[]>> {
  try {
    const session = await requireAuth()

    const ctx = await findRequestWithOwnershipContext(requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Ownership: só participantes (tutor ou profissional) da request
    if (ctx.tutorUserId !== session.id && ctx.professionalUserId !== session.id) {
      return { success: false, error: "Você não tem acesso a esta timeline." }
    }

    // A autorização acima é o que habilita a emissão de URLs assinadas abaixo:
    // toCareUpdateDTO troca storagePath por signed URL. Só chega aqui quem já
    // provou ser participante desta request.
    const rows = await getCareTimeline(requestId)
    const data = await Promise.all(rows.map(toCareUpdateDTO))
    return { success: true, data }
  } catch (err) {
    unstable_rethrow(err)
    logErroDeAcao("get_timeline_failed", err)
    return { success: false, error: "Erro interno ao carregar a timeline." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR — autor, IN_PROGRESS, sem disputa, dentro de 15 min
// ─────────────────────────────────────────────────────────────────────────────

export async function editCareUpdateAction(
  id: string,
  content: string
): Promise<ActionResult<CareUpdate>> {
  try {
    const session = await requireAuth()

    const existing = await findCareUpdateById(id)
    if (!existing || existing.deletedAt) {
      return { success: false, error: "Atualização não encontrada." }
    }

    // Ownership: só o autor edita
    if (existing.authorId !== session.id) {
      return { success: false, error: "Apenas o autor pode editar esta atualização." }
    }

    // Janela de edição: 15 min a partir da publicação
    if (Date.now() > existing.createdAt.getTime() + CARE_UPDATE_EDIT_WINDOW_MS) {
      return {
        success: false,
        error: "A janela de edição desta atualização já expirou.",
      }
    }

    const ctx = await findRequestWithOwnershipContext(existing.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Guard: request precisa estar em andamento
    if (ctx.request.status !== "IN_PROGRESS") {
      return { success: false, error: "Só é possível editar durante um atendimento em andamento." }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(existing.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    const trimmed = content.trim()
    if (trimmed.length < CARE_UPDATE_CONTENT_MIN) {
      return { success: false, error: `A atualização precisa de pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres.` }
    }
    if (trimmed.length > CARE_UPDATE_CONTENT_MAX) {
      return { success: false, error: `A atualização pode ter no máximo ${CARE_UPDATE_CONTENT_MAX} caracteres.` }
    }

    // Guard atômico: a request precisa continuar IN_PROGRESS, sem disputa e
    // dentro da janela de 15 min no instante da escrita — se mudou desde a
    // validação acima, updated é null.
    const previousContent = existing.content
    const editedAt = new Date()
    const updated = await editCareUpdate(id, trimmed, editedAt)
    if (!updated) {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }

    // Auditoria administrativa (não exposta ao tutor, não em console):
    // preserva conteúdo anterior e novo para reconstrução pelo admin.
    await recordCareUpdateAudit(
      session.id,
      "care_update.edited",
      id,
      { content: previousContent },
      {
        content: trimmed,
        editedAt: editedAt.toISOString(),
        authorId: session.id,
        requestId: existing.requestId,
        careUpdateId: id,
      }
    )

    revalidateCarePaths(existing.requestId)

    return { success: true, data: await toCareUpdateDTO(updated) }
  } catch (err) {
    unstable_rethrow(err)
    logErroDeAcao("edit_failed", err)
    return { success: false, error: "Erro interno ao editar atualização." }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUIR (soft) — autor, IN_PROGRESS, sem disputa
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCareUpdateAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth()

    const existing = await findCareUpdateById(id)
    if (!existing || existing.deletedAt) {
      return { success: false, error: "Atualização não encontrada." }
    }

    // Ownership: só o autor exclui
    if (existing.authorId !== session.id) {
      return { success: false, error: "Apenas o autor pode excluir esta atualização." }
    }

    const ctx = await findRequestWithOwnershipContext(existing.requestId)
    if (!ctx) {
      return { success: false, error: "Solicitação não encontrada." }
    }

    // Guard: request precisa estar em andamento.
    // Regra aprovada (assimétrica e explícita): edição expira em 15 min, mas a
    // EXCLUSÃO é permitida durante todo o IN_PROGRESS — sem janela de tempo.
    if (ctx.request.status !== "IN_PROGRESS") {
      return { success: false, error: "Só é possível excluir durante um atendimento em andamento." }
    }

    // Guard: disputa aberta congela a timeline
    const dispute = await findActiveDisputeByRequestId(existing.requestId)
    if (dispute) {
      return { success: false, error: DISPUTE_FROZEN_MESSAGE }
    }

    // Snapshot ANTES de excluir — preserva evidência para reconstrução pelo admin.
    const deletedAt = new Date()
    const snapshot = {
      content: existing.content,
      category: existing.category,
      occurredAt: existing.occurredAt.toISOString(),
      authorId: existing.authorId,
      requestId: existing.requestId,
      careUpdateId: id,
    }

    // Guard atômico: aborta se a request saiu de IN_PROGRESS ou entrou em
    // disputa entre a validação acima e a escrita.
    const deleted = await softDeleteCareUpdate(id, deletedAt)
    if (!deleted) {
      return { success: false, error: CONCURRENT_CHANGE_MESSAGE }
    }

    await recordCareUpdateAudit(session.id, "care_update.deleted", id, snapshot, {
      ...snapshot,
      deletedAt: deletedAt.toISOString(),
    })

    revalidateCarePaths(existing.requestId)

    return { success: true, data: undefined }
  } catch (err) {
    unstable_rethrow(err)
    logErroDeAcao("delete_failed", err)
    return { success: false, error: "Erro interno ao excluir atualização." }
  }
}
