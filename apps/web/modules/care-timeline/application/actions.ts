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
import { after } from "next/server"

import { requireAuth } from "@/modules/identity/application/get-session"
import { requireProfessionalContext } from "@/modules/professional-crm/application/require-professional"
import { findRequestWithOwnershipContext } from "@/modules/service-request/infrastructure/repository"
import { findActiveDisputeByRequestId } from "@/modules/disputes/infrastructure/queries"
import { notifyCareUpdatePublished } from "@/modules/notifications/application/push-service-request-events"
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
import { normalizarDimensoes } from "../domain/media-aspect"
import { resolveEffectiveOccurredAt } from "../domain/occurred-at"
import {
  createCareUpdateAtomic,
  editCareUpdate,
  softDeleteCareUpdate,
  findCareUpdateById,
  findCareUpdateByIdempotencyKey,
  getCareTimeline,
  recordCareUpdateAudit,
} from "../infrastructure/repository"
import {
  authorizeCareMediaUpload,
  type CareMediaAuthorizationResult,
} from "./care-media-authorization"
import {
  careMediaKindFromPath,
  careMediaPathBelongsToRequest,
  declaredMimeTypeFromCareMediaPath,
  CARE_VIDEO_MAX_PER_UPDATE,
} from "@/lib/storage/care-media-path"
import {
  createCareMediaDisplayUrl,
  createCareMediaReadUrl,
  createCareMediaThumbnailUrl,
  deleteCareMediaObject,
  downloadCareMediaPhoto,
  readCareMediaForValidation,
  readCareMediaHeadBytes,
  uploadCareMediaFinalPhoto,
} from "@/lib/storage/care-media"
import {
  careMediaRejectionMessage,
  validateCareAnyMediaContent,
} from "@/lib/storage/care-media-validation"
import { processImageForStorage } from "@/lib/image/process-image.server"
import {
  discardCarePhotoObjects,
  finalizeCarePhotos,
  type CarePhotoDeps,
} from "./finalize-care-photos"
import { CARE_VIDEO_SIGNATURE_READ_LENGTH } from "@/lib/storage/care-video-signature"

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
  // A Home do tutor mostra o atendimento em curso; publicar no Diário é
  // atividade daquele atendimento, então invalidar aqui é semanticamente
  // correto — e não era feito.
  //
  // NÃO É A CORREÇÃO, porém: `revalidatePath` só afeta a próxima navegação
  // ou refresh. O caso que importa é a aba do tutor JÁ ABERTA na Home, e
  // quem resolve esse é o token de sync (ver `careSignal` em
  // domain/active-request-sync.ts). Esta linha cobre o cenário
  // complementar — voltar para a Home depois — e por isso as duas coisas
  // existem em vez de uma.
  revalidatePath("/tutor")
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
  | {
      ok: true
      media: ValidatedCareMedia[]
      /** Objetos FINAIS de foto criados nesta tentativa — descartar se não publicar. */
      finalPhotoPaths: string[]
      /** Originais de foto enviados pelo cliente — descartar depois de publicar. */
      originalPhotoPaths: string[]
    }
  | { ok: false; error: string }

/** I/O real das fotos do Diário, injetado no orquestrador puro. */
function careFotoDeps(requestId: string): CarePhotoDeps {
  return {
    download: (path) => downloadCareMediaPhoto({ path, requestId }),
    process: (bytes, declaredType) =>
      processImageForStorage({ bytes, declaredType, category: "CARE_PHOTO" }),
    uploadFinal: (bytes) => uploadCareMediaFinalPhoto({ requestId, bytes }),
    remove: (path) => deleteCareMediaObject({ path, requestId, kind: "PHOTO" }),
    declaredTypeOf: (path) => declaredMimeTypeFromCareMediaPath(path),
  }
}

/**
 * Transforma paths recebidos do cliente em mídia CONFIÁVEL — ou recusa.
 *
 * Roda INTEIRAMENTE FORA da transação: é I/O de rede e não pode acontecer com
 * o lock da request na mão.
 *
 * Para todo path: pertence a ESTA request? (`careMediaPathBelongsToRequest` —
 * comparação exata, cobre traversal e path de outro atendimento) e o tipo
 * decorre do path gerado no servidor.
 *
 * FOTO (PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001): o objeto enviado
 * nunca é publicado. `finalizeCarePhotos` baixa, reprocessa com a política
 * única (conteúdo real, ≤ 100 MP, orientação aplicada, sem EXIF/GPS, ≤ 2560 px,
 * JPEG) e grava numa CHAVE NOVA. Recusou ou falhou → os finais já criados são
 * removidos e nada é publicado; conteúdo reprovado também apaga o original.
 *
 * VÍDEO: inalterado — cabeçalho por `Range` (fallback download), magic bytes,
 * tipo × declarado e teto; reprovado é apagado.
 *
 * `mimeType` e `sizeBytes` persistidos saem SEMPRE do servidor, nunca do cliente.
 */
async function validateMediaPaths(params: {
  requestId: string
  paths: string[]
  /**
   * Hints visuais por path. NÃO cria mídia e NÃO confere posse: o laço abaixo
   * itera sobre `paths` — que passou por posse — e apenas CONSULTA este mapa.
   * Um path presente só aqui nunca é alcançado.
   */
  dimensions?: Array<{ path: string; width: number; height: number }>
}): Promise<MediaValidationOutcome> {
  const { requestId, paths, dimensions } = params

  // Mapa só para consulta. Duplicatas: a última vence — irrelevante, já que o
  // pior efeito possível é um card com a forma errada.
  const dimensoesPorPath = new Map<string, { width: number; height: number }>()
  for (const d of dimensions ?? []) {
    dimensoesPorPath.set(d.path, { width: d.width, height: d.height })
  }

  if (paths.length > CARE_UPDATE_MAX_MEDIA) {
    return { ok: false, error: `No máximo ${CARE_UPDATE_MAX_MEDIA} fotos por atualização.` }
  }

  // Paths repetidos na mesma publicação: recusa antes de qualquer I/O. Sem
  // isto, o mesmo arquivo poderia ocupar 3 vagas da cota.
  if (new Set(paths).size !== paths.length) {
    return { ok: false, error: "Há fotos repetidas nesta atualização." }
  }

  // ── 1. Posse e tipo de TODOS os paths, antes de qualquer I/O ──────────────
  const fotos: string[] = []
  for (const path of paths) {
    if (!careMediaPathBelongsToRequest(path, requestId)) {
      return { ok: false, error: "Um dos arquivos não pertence a este atendimento." }
    }
    // O TIPO vem do PATH, que o servidor gerou. O cliente não informa nada disso.
    const kind = careMediaKindFromPath(path)
    if (!kind) {
      return { ok: false, error: "Um dos arquivos não pôde ser verificado." }
    }
    if (kind === "PHOTO") fotos.push(path)
  }

  // ── 2. Fotos: reprocessadas e gravadas em chave nova ─────────────────────
  const deps = careFotoDeps(requestId)
  const finalizadas = await finalizeCarePhotos({ paths: fotos, deps })
  if (!finalizadas.ok) {
    return { ok: false, error: finalizadas.error }
  }
  const finalPorOriginal = new Map(finalizadas.photos.map((f) => [f.originalPath, f]))
  const finalPhotoPaths = finalizadas.photos.map((f) => f.finalPath)
  const descartarFinais = () => discardCarePhotoObjects(finalPhotoPaths, deps.remove)

  // ── 3. Monta a mídia na ORDEM enviada; vídeo validado como antes ──────────
  const validadas: ValidatedCareMedia[] = []

  for (const path of paths) {
    const foto = finalPorOriginal.get(path)
    if (foto) {
      // PHOTO não usa dimensões: a grade e a miniatura já resolvem o layout.
      validadas.push({
        storagePath: foto.finalPath,
        type: "PHOTO",
        mimeType: foto.mimeType,
        sizeBytes: foto.sizeBytes,
        displayWidth: null,
        displayHeight: null,
      })
      continue
    }

    // VÍDEO usa `Range` (64 bytes) em vez de baixar até 50 MB só para ler a
    // assinatura. FAIL CLOSED: se o Range falhar, cai para o download completo.
    let objeto = await readCareMediaHeadBytes({
      path,
      requestId,
      kind: "VIDEO",
      bytes: CARE_VIDEO_SIGNATURE_READ_LENGTH,
    })
    if (!objeto) {
      // Observável: distingue "Range indisponível" de falha de conteúdo.
      console.warn("[care-media] range_fallback_download", { requestId })
      objeto = await readCareMediaForValidation({
        path,
        requestId,
        kind: "VIDEO",
        bytes: CARE_VIDEO_SIGNATURE_READ_LENGTH,
      })
    }

    if (!objeto) {
      await descartarFinais()
      return { ok: false, error: "Não foi possível confirmar o envio de um dos arquivos." }
    }

    const declarado = declaredMimeTypeFromCareMediaPath(path)
    if (!declarado) {
      await descartarFinais()
      return { ok: false, error: "Um dos arquivos não pôde ser verificado." }
    }

    const veredito = validateCareAnyMediaContent({
      declaredMimeType: declarado,
      header: objeto.header,
      sizeBytes: objeto.sizeBytes,
    })

    if (!veredito.ok) {
      // Conteúdo reprovado não pode sobreviver no bucket — no bucket CERTO.
      await deleteCareMediaObject({ path, requestId, kind: "VIDEO" })
      await descartarFinais()
      return { ok: false, error: careMediaRejectionMessage(veredito.reason) }
    }

    // Hint visual: só para VIDEO, e só se passar a sanidade.
    const hint = dimensoesPorPath.get(path)
    const dims =
      veredito.kind === "VIDEO" && hint
        ? normalizarDimensoes(hint.width, hint.height)
        : null

    validadas.push({
      storagePath: path,
      // Do veredito dos magic bytes, nunca do declarado.
      type: veredito.kind,
      mimeType: veredito.mimeType,
      sizeBytes: veredito.sizeBytes,
      displayWidth: dims?.displayWidth ?? null,
      displayHeight: dims?.displayHeight ?? null,
    })
  }

  // ── Cota de VÍDEO: no máximo 1 por atualização ──────────────────────────
  // Verificada sobre o resultado JÁ VALIDADO — não sobre o que o cliente disse.
  const videos = validadas.filter((m) => m.type === "VIDEO").length
  if (videos > CARE_VIDEO_MAX_PER_UPDATE) {
    await descartarFinais()
    return {
      ok: false,
      error: `No máximo ${CARE_VIDEO_MAX_PER_UPDATE} vídeo por atualização.`,
    }
  }

  return { ok: true, media: validadas, finalPhotoPaths, originalPhotoPaths: fotos }
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
  // Em PARALELO, não em série. Cada assinatura é uma ida ao Storage; o laço
  // sequencial anterior somava a latência de todas — com 3 fotos por
  // atualização e várias atualizações na timeline, isso era parte do "demora
  // para aparecer" observado, independentemente do tamanho dos arquivos.
  const resultados = await Promise.all(
    // Retorno anotado: sem isto, o TypeScript estreita `m.type` para o literal
    // de cada ramo ("VIDEO" num, "PHOTO" no outro) e o array resultante deixa
    // de ser atribuível a CareMediaView[] — o type predicate do filter abaixo
    // falha por um detalhe de inferência, não por erro real.
    update.media.map(async (m): Promise<CareMediaView | null> => {
      const alvo = { path: m.storagePath, requestId: update.requestId }

      // VÍDEO: uma assinatura só, no bucket de vídeo. Miniatura e display
      // ficam `null` por construção — a transformação do Storage é de imagem,
      // e pedi-la para um vídeo devolveria URL que não reproduz.
      if (m.type === "VIDEO") {
        const signedUrl = await createCareMediaReadUrl({ ...alvo, kind: "VIDEO" })
        if (!signedUrl) return null
        return {
          id: m.id,
          type: m.type,
          signedUrl,
          thumbnailUrl: null,
          displayUrl: null,
          mimeType: m.mimeType,
          // Levados ao cliente para que o card FECHADO já tenha a orientação
          // certa — sem isto, saber a forma exigiria montar o vídeo, que é
          // exatamente o que a V0.1 removeu.
          displayWidth: m.displayWidth,
          displayHeight: m.displayHeight,
        }
      }

      const [signedUrl, thumbnailUrl, displayUrl] = await Promise.all([
        createCareMediaReadUrl({ ...alvo, kind: "PHOTO" }),
        createCareMediaThumbnailUrl(alvo),
        createCareMediaDisplayUrl(alvo),
      ])
      // Sem a ORIGINAL a foto é omitida, como sempre foi — ela é o fallback
      // final das duas outras superfícies. Sem MINIATURA ou DISPLAY a foto
      // continua aparecendo: cada `null` só faz a superfície correspondente
      // cair para a original (pesada, nunca ausente).
      if (!signedUrl) return null
      // PHOTO não usa dimensões: a grade e a miniatura já resolvem o layout.
      return {
        id: m.id,
        type: m.type,
        signedUrl,
        thumbnailUrl,
        displayUrl,
        mimeType: m.mimeType,
        displayWidth: null,
        displayHeight: null,
      }
    })
  )
  return resultados.filter((v): v is CareMediaView => v !== null)
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

    // REPLAY ANTECIPADO: a mesma intenção já publicada volta como sucesso
    // ANTES de tocar no Storage. Necessário porque, depois de publicar, os
    // originais enviados são descartados — um retry que chegasse até
    // `validateMediaPaths` não os encontraria e falharia. O unique
    // (requestId, idempotencyKey) dentro de `createCareUpdateAtomic` continua
    // sendo o árbitro das chamadas simultâneas.
    const jaPublicada = await findCareUpdateByIdempotencyKey(
      parsed.data.requestId,
      parsed.data.idempotencyKey
    )
    if (jaPublicada) {
      return { success: true, data: await toCareUpdateDTO(jaPublicada) }
    }

    // ── FRONTEIRA DE CONFIANÇA ────────────────────────────────────────────
    // Todo I/O de Storage acontece AQUI, antes da transação. Fotos são
    // reprocessadas e gravadas em chave nova; a transação só recebe mídia
    // FINAL, verificada e medida no servidor.
    const validacao = await validateMediaPaths({
      requestId: parsed.data.requestId,
      paths: parsed.data.mediaPaths,
      dimensions: parsed.data.mediaDimensions,
    })
    if (!validacao.ok) {
      return { success: false, error: validacao.error }
    }

    const removerFoto = (path: string) =>
      deleteCareMediaObject({ path, requestId: parsed.data.requestId, kind: "PHOTO" })

    // Criação atômica: re-verifica status/disputa/startedAt/cota sob lock da
    // request no instante da escrita. petId e professionalId são derivados da
    // request travada — nunca do client.
    let resultado: Awaited<ReturnType<typeof createCareUpdateAtomic>>
    try {
      resultado = await createCareUpdateAtomic({
        requestId: parsed.data.requestId,
        authorId: session.id,
        category: parsed.data.category,
        content: parsed.data.content,
        occurredAt,
        idempotencyKey: parsed.data.idempotencyKey,
        media: validacao.media,
      })
    } catch (err) {
      // Transação falhou: nenhum registro — os finais desta tentativa saem.
      await discardCarePhotoObjects(validacao.finalPhotoPaths, removerFoto)
      throw err
    }

    // Não publicou por ESTA tentativa (estado mudou, conflito ou replay
    // simultâneo): os objetos finais criados agora não pertencem a nenhuma
    // CareMedia e são removidos. Os originais ficam para um novo envio.
    if (resultado.kind !== "created") {
      await discardCarePhotoObjects(validacao.finalPhotoPaths, removerFoto)
    }

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

    // Publicado: os originais enviados pelo cliente (possivelmente com EXIF/GPS)
    // não servem a mais nada e são descartados — best-effort, fora da resposta.
    after(() => discardCarePhotoObjects(validacao.originalPhotoPaths, removerFoto))

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

    // ── Push best-effort — TUDO já está commitado ────────────────────────────
    // Esta linha só é alcançada depois de: magic bytes aprovados
    // (validateMediaPaths), CareUpdate persistido, CareMedia persistida quando
    // houver, e a transação de createCareUpdateAtomic concluída.
    //
    // Fica DEPOIS do early-return de `replayed`: um retry da mesma
    // idempotencyKey devolve a atualização original sem passar por aqui, então
    // a intenção repetida não gera segundo push — a idempotência do R2A já
    // cobre o canal, sem lógica própria.
    //
    // Uma publicação = uma intenção de notificação, independentemente de
    // quantas fotos ela carregue. Nunca um push por mídia.
    //
    // GATE-3-REQUEST-LATENCY-001: `after()`, não `await` — mesmo mecanismo dos
    // eventos de Push do fluxo de Request (ver service-request/application/
    // actions.ts): dispatchPush pode levar segundos em rede instável, e nada
    // aqui precisa que o push termine antes de responder ao Profissional que
    // acabou de publicar.
    after(() => notifyCareUpdatePublished(parsed.data.requestId))

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
