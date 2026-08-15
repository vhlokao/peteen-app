/**
 * Módulo: care-timeline
 * Camada: domain — tipos puros da Care Timeline V0
 *
 * V0: apenas texto. O profissional publica dentro de uma request IN_PROGRESS;
 * o tutor visualiza. Estes tipos não dependem de Prisma — o repositório mapeia
 * as linhas do banco para eles.
 */

import { z } from "zod"

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIAS — espelham o enum CareUpdateCategory do schema Prisma
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_UPDATE_CATEGORIES = [
  "CHECK_IN",
  "FEEDING",
  "WALK",
  "ACTIVITY",
  "REST",
  "NOTE",
  "CHECK_OUT",
] as const

export type CareUpdateCategory = (typeof CARE_UPDATE_CATEGORIES)[number]

export const CARE_CATEGORY_LABELS: Record<CareUpdateCategory, string> = {
  CHECK_IN: "Chegada",
  FEEDING: "Alimentação",
  WALK: "Passeio",
  ACTIVITY: "Atividade",
  REST: "Descanso",
  NOTE: "Observação",
  CHECK_OUT: "Saída",
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DOMÍNIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mídia como o CLIENTE a vê. É todo o DTO — não existe versão "completa"
 * exposta a Client Component.
 *
 * `storagePath` está deliberadamente FORA: o caminho interno do bucket nunca
 * atravessa a fronteira servidor→cliente. O que o cliente recebe é uma URL
 * assinada de curta duração, emitida no render depois de a autorização inteira
 * passar, e que não é persistida em lugar nenhum.
 */
export type CareMediaView = {
  id: string
  type: "PHOTO"
  /** URL assinada de leitura, de vida curta. Nunca persistida no banco. */
  signedUrl: string
  /** Só o necessário para o browser renderizar. */
  mimeType: string
}

/**
 * CareUpdate — projeção pública, exibida ao tutor e ao profissional.
 * NUNCA inclui deletedAt: itens soft-deleted são filtrados antes de virar
 * este tipo (só o Admin, via getCareTimelineAdmin, enxerga os removidos).
 */
export type CareUpdate = {
  id: string
  requestId: string
  petId: string | null
  professionalId: string
  authorId: string
  category: CareUpdateCategory
  content: string
  occurredAt: Date
  createdAt: Date
  editedAt: Date | null
  /** Vazio quando a atualização é só texto — o caso mais comum. */
  media: CareMediaView[]
}

/**
 * Teto de fotos por atualização (contrato V0).
 *
 * ONDE ESTA COTA É REALMENTE APLICADA: na PUBLICAÇÃO, dentro da transação que
 * cria a atualização — nunca na emissão de tickets. Ticket não reserva cota;
 * ele só autoriza gravar um objeto. Emitir 10 tickets em paralelo, de 2 abas,
 * continua produzindo no máximo 3 mídias por atualização, porque quem conta é
 * o array recebido no publish, já dentro do lock da request. Os objetos
 * excedentes viram órfãos rastreáveis, não mídia publicada.
 */
export const CARE_UPDATE_MAX_MEDIA = 3

/**
 * Janela de edição de uma atualização após publicada (decisão de produto V0).
 */
export const CARE_UPDATE_EDIT_WINDOW_MS = 15 * 60 * 1000

/**
 * Limite de tamanho do conteúdo (validado na Server Action).
 */
export const CARE_UPDATE_CONTENT_MIN = 10
export const CARE_UPDATE_CONTENT_MAX = 1000

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA DE CRIAÇÃO
//
// occurredAt chega do client como string ISO (UTC) — z.coerce.date() converte.
// Validações dependentes de estado (não antes de startedAt, não no futuro)
// ficam na Server Action, que tem acesso à request.
// ─────────────────────────────────────────────────────────────────────────────

export const CreateCareUpdateSchema = z.object({
  requestId: z.string().min(1, "Solicitação é obrigatória"),
  category: z.enum(CARE_UPDATE_CATEGORIES, {
    error: () => "Selecione uma categoria válida",
  }),
  // Texto continua OBRIGATÓRIO mesmo com foto. Foto complementa o relato, não
  // o substitui: uma timeline de imagens soltas não conta o que aconteceu no
  // atendimento, e é o relato que tem valor em disputa.
  content: z
    .string()
    .trim()
    .min(CARE_UPDATE_CONTENT_MIN, `A atualização precisa de pelo menos ${CARE_UPDATE_CONTENT_MIN} caracteres`)
    .max(CARE_UPDATE_CONTENT_MAX, `A atualização pode ter no máximo ${CARE_UPDATE_CONTENT_MAX} caracteres`),
  occurredAt: z.coerce.date({ error: () => "Data/hora inválida" }),
  /**
   * Paths dos objetos já enviados ao bucket. São RE-VALIDADOS no servidor
   * (pertencem a esta request? existem? os bytes são imagem de verdade?) —
   * chegar aqui não confere nenhuma confiança.
   */
  mediaPaths: z
    .array(z.string().min(1))
    .max(CARE_UPDATE_MAX_MEDIA, `No máximo ${CARE_UPDATE_MAX_MEDIA} fotos por atualização`)
    .optional()
    .default([]),
  /**
   * Identidade da INTENÇÃO de publicar, gerada pelo cliente.
   * UUID v4 exigido: formato validado no servidor para que a chave não vire um
   * campo de texto livre gravado no banco.
   */
  // `error` cobre AUSÊNCIA e tipo errado; `.uuid()` cobre formato inválido.
  // Sem o primeiro, omitir o campo devolvia o "Invalid input" cru do Zod — em
  // inglês e fora do padrão de mensagens do produto.
  idempotencyKey: z
    .string({ error: () => "Não foi possível identificar esta publicação. Recarregue a página." })
    .uuid("Não foi possível identificar esta publicação. Recarregue a página."),
})

/** Entrada crua vinda do client (occurredAt como ISO string). */
export type CreateCareUpdateInput = {
  requestId: string
  category: CareUpdateCategory
  content: string
  occurredAt: string
  mediaPaths?: string[]
  idempotencyKey: string
}

/** Mídia já validada, pronta para persistir. Só o servidor constrói isto. */
export type ValidatedCareMedia = {
  storagePath: string
  mimeType: string
  sizeBytes: number
}

/**
 * Forma SERVER-ONLY da mídia: carrega `storagePath`, que nunca pode atravessar
 * a fronteira para o cliente. O repositório devolve isto; só a camada de
 * aplicação — depois de a autorização passar — troca `storagePath` por uma URL
 * assinada e produz `CareMediaView`.
 *
 * Tipo separado, e não um campo opcional em `CareMediaView`, porque um campo
 * opcional seria esquecido: bastaria alguém devolver o objeto inteiro para o
 * path vazar. Aqui a conversão é obrigatória para o tipo bater.
 */
export type CareMediaInternal = {
  id: string
  type: "PHOTO"
  storagePath: string
  mimeType: string
}

/** O que o repositório devolve: tudo do DTO, mas com mídia em forma interna. */
export type CareUpdateWithInternalMedia = Omit<CareUpdate, "media"> & {
  media: CareMediaInternal[]
}
