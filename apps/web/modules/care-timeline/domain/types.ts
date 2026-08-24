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
  /**
   * VIDEO só produz `signedUrl` — `thumbnailUrl` e `displayUrl` são sempre
   * `null`, porque a transformação do Storage opera apenas em imagem. O player
   * usa a original com `preload="metadata"`, sem baixar o arquivo inteiro.
   */
  type: "PHOTO" | "VIDEO"
  /**
   * URL assinada da ORIGINAL, de vida curta. Nunca persistida no banco.
   * Usada pelo lightbox — a visualização de evidência.
   */
  signedUrl: string
  /**
   * URL assinada da MINIATURA (redimensionada na leitura pelo Storage) para a
   * grade da timeline. `null` quando a assinatura da variante falhou: a grade
   * cai para `signedUrl` e a foto continua aparecendo, só pesada — ver
   * `resolveTimelineImageSrc` em lib/storage/care-media-transform.ts.
   *
   * Nenhum objeto novo existe no bucket por causa deste campo.
   */
  thumbnailUrl: string | null
  /**
   * URL assinada da versão de VISUALIZAÇÃO (1600px) para o lightbox. `null`
   * cai para `signedUrl`. Como a miniatura, é derivada na leitura — nenhum
   * objeto novo existe no bucket por causa deste campo.
   */
  displayUrl: string | null
  /** Só o necessário para o browser renderizar. */
  mimeType: string
  /**
   * Forma do card ANTES de qualquer request. É isto que permite ao card
   * fechado ter a orientação certa sem montar `<video>`: o contrato de rede da
   * V0.1 (zero request antes do clique) depende de a proporção vir daqui, do
   * banco, e não de sondar o arquivo. `null` cai no fallback portrait-first.
   */
  displayWidth: number | null
  displayHeight: number | null
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
   * Dimensões de EXIBIÇÃO por path — hint visual, não fonte de verdade.
   *
   * Opcional por dois motivos: PHOTO não envia (não usa), e uma aba aberta
   * durante o deploy continua publicando sem o campo — cai no fallback
   * portrait-first em vez de quebrar.
   *
   * SEGURANÇA: este array NÃO cria mídia e NÃO confere posse. Um path que
   * apareça só aqui, sem estar em `mediaPaths`, é ignorado — quem decide o que
   * vira `CareMedia` continua sendo o pipeline canônico de validação, que
   * confere posse da request e os magic bytes do objeto. O pior que um cliente
   * mentindo consegue é um card com a forma errada.
   */
  mediaDimensions: z
    .array(
      z.object({
        path: z.string().min(1),
        width: z.number(),
        height: z.number(),
      })
    )
    .max(CARE_UPDATE_MAX_MEDIA)
    .optional(),
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
  /** Hint visual por path — ver CreateCareUpdateSchema.mediaDimensions. */
  mediaDimensions?: Array<{ path: string; width: number; height: number }>
  idempotencyKey: string
}

/** Mídia já validada, pronta para persistir. Só o servidor constrói isto. */
export type ValidatedCareMedia = {
  storagePath: string
  /**
   * Derivado dos MAGIC BYTES, nunca do declarado — é o mesmo veredito que
   * decide o bucket de origem. Persistido em `CareMedia.type`.
   */
  type: "PHOTO" | "VIDEO"
  mimeType: string
  sizeBytes: number
  /**
   * Dimensões de EXIBIÇÃO — hint do cliente, já filtrado pela sanidade do
   * domínio (`normalizarDimensoes`). `null` quando ausente ou implausível.
   * Não participa de nenhuma decisão de segurança; ver schema.prisma.
   */
  displayWidth: number | null
  displayHeight: number | null
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
  type: "PHOTO" | "VIDEO"
  storagePath: string
  mimeType: string
  displayWidth: number | null
  displayHeight: number | null
}

/** O que o repositório devolve: tudo do DTO, mas com mídia em forma interna. */
export type CareUpdateWithInternalMedia = Omit<CareUpdate, "media"> & {
  media: CareMediaInternal[]
}
