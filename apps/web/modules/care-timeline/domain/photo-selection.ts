/**
 * Módulo: care-timeline
 * Camada: domain — regras da SELEÇÃO de fotos no formulário (R2B.4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É DOMÍNIO E NÃO COMPONENTE
 *
 * O projeto não tem jsdom: um `<input type="file">` e um `URL.createObjectURL`
 * só existem no navegador. Se a regra de "esta foto pode entrar?" e "esta
 * seleção pode publicar?" morasse dentro do componente, ela seria verificável
 * apenas por QA manual. Extraída aqui, vira `assert.equal` — mesmo padrão de
 * `resolveEffectiveOccurredAt`, `active-request-sync` e `dispute-form-state`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTA É A PRIMEIRA PORTA, NUNCA A ÚNICA
 *
 * Tudo aqui é conveniência de UX: recusar cedo, com uma frase que a pessoa
 * entenda, em vez de deixar subir 5 MB para o servidor responder "não". A
 * verificação que VALE é a do servidor — magic bytes em `validateMediaPaths`,
 * que baixa o objeto do bucket e olha os bytes reais. Um `.php` renomeado para
 * `.png` com MIME forjado passa por esta função e morre lá, como deve.
 *
 * Os limites são IMPORTADOS de lib/storage, nunca reescritos: divergir entre
 * cliente e servidor produziria uma tela que aceita o que o bucket recusa.
 */

// Caminho relativo com extensão .ts explícita: é o que permite este módulo ser
// carregado direto por `node --experimental-strip-types --test`, sem bundler.
// Mesmo padrão de care-media-validation.ts e das demais suítes do repo.
import {
  CARE_MEDIA_ALLOWED_TYPES,
  CARE_MEDIA_MAX_BYTES,
  CARE_MEDIA_MAX_PER_UPDATE,
  CARE_VIDEO_ALLOWED_TYPES_FOR_PATH,
  CARE_VIDEO_MAX_BYTES,
  CARE_VIDEO_MAX_DURATION_SECONDS,
  CARE_VIDEO_MAX_PER_UPDATE,
  type CareMediaMimeType,
} from "../../../lib/storage/care-media-path.ts"

export {
  CARE_MEDIA_MAX_PER_UPDATE,
  CARE_MEDIA_MAX_BYTES,
  CARE_VIDEO_MAX_BYTES,
  CARE_VIDEO_MAX_DURATION_SECONDS,
  CARE_VIDEO_MAX_PER_UPDATE,
}

/**
 * Estados de UMA foto na seleção.
 *
 * `erro` é terminal só do ponto de vista do sistema — a pessoa decide entre
 * tentar de novo (volta a `pronta`) ou remover. Nunca publicamos por conta
 * própria ignorando a que falhou (ver item 5 da missão).
 */
export type PhotoUploadStatus = "pronta" | "enviando" | "enviada" | "erro"

export type PhotoSelectionItem = {
  /** Identidade local da seleção. Não é o id da CareMedia (que só existe pós-publicação). */
  id: string
  status: PhotoUploadStatus
  /** Path devolvido pelo ticket — só existe depois de `enviada`. */
  path: string | null
  /** Mensagem humana da última falha. Nunca código técnico. */
  errorMessage: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy — humana, sem jargão. Ver item 13 da missão.
// ─────────────────────────────────────────────────────────────────────────────

export const PHOTO_COPY = {
  tipoInvalido: "Esta foto não parece ser uma imagem válida.",
  /** HEIC/HEIF merece frase própria: é o padrão do iPhone e a pessoa não tem culpa. */
  heic: "Este formato ainda não é compatível. Escolha JPEG, PNG ou WebP.",
  muitoGrande: "Esta foto é muito grande.",
  falhaUpload: "Não foi possível enviar esta foto. Tente novamente.",
  publicacaoFalhou:
    "As fotos foram enviadas, mas a atualização não foi publicada. Tente novamente.",
  /** Contexto APÓS a causa real — nunca no lugar dela. Ver CareUpdateForm. */
  fotosPreservadas: "Suas fotos continuam enviadas; ajuste e publique novamente.",
  limiteAtingido: `Você já selecionou ${CARE_MEDIA_MAX_PER_UPDATE} fotos.`,
  rascunhoRecuperado: "Seu texto foi recuperado. Selecione as fotos novamente.",
} as const

export const VIDEO_COPY = {
  tipoInvalido: "Este arquivo não parece ser um vídeo MP4 ou MOV válido.",
  /** WebM merece frase própria: é gravável em alguns Android, mas não toca no iPhone. */
  webm: "Este formato de vídeo ainda não é compatível. Grave em MP4 ou MOV.",
  muitoGrande: `Este vídeo é muito grande. O limite é ${Math.round(CARE_VIDEO_MAX_BYTES / (1024 * 1024))} MB.`,
  muitoLongo: `Este vídeo é muito longo. O limite é ${CARE_VIDEO_MAX_DURATION_SECONDS} segundos.`,
  /** Sem metadata não dá para provar a duração — e não publicamos no escuro. */
  duracaoDesconhecida:
    "Não foi possível ler a duração deste vídeo. Tente gravar novamente ou escolher outro arquivo.",
  limiteAtingido: `Você já selecionou ${CARE_VIDEO_MAX_PER_UPDATE} vídeo.`,
  /** Contrato V0: mídia de um tipo só por atualização. */
  misturaComFoto: "Publique o vídeo sozinho, sem fotos na mesma atualização.",
  falhaUpload: "Não foi possível enviar este vídeo. Tente novamente.",
} as const

/**
 * Copy de falha de upload correspondente ao tipo de mídia.
 *
 * Existe porque o caminho de upload é COMPARTILHADO entre foto e vídeo, e a
 * mensagem estava fixada na de foto: no primeiro upload real de vídeo, o
 * profissional gravou um vídeo e leu "não foi possível enviar esta foto". As
 * duas copies já existiam; faltava escolher entre elas.
 *
 * Função, e não um `Record` inline no componente, para que a regra "vídeo
 * nunca fala 'foto'" possa ser testada sem montar React.
 */
export function copyDeFalhaUpload(kind: "PHOTO" | "VIDEO"): string {
  return kind === "VIDEO" ? VIDEO_COPY.falhaUpload : PHOTO_COPY.falhaUpload
}

/** Formatos que existem no mundo real e merecem mensagem específica. */
const TIPOS_HEIC = ["image/heic", "image/heif"]

/** Containers de vídeo que aparecem em aparelhos reais mas não suportamos. */
const TIPOS_VIDEO_INCOMPATIVEIS = ["video/webm", "video/x-matroska", "video/3gpp", "video/avi"]

export function isVideoMimeType(tipo: string): boolean {
  return tipo.toLowerCase().startsWith("video/")
}

/**
 * Um vídeo candidato pode entrar na seleção?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A DURAÇÃO SÓ EXISTE AQUI — E ISSO É UMA ESCOLHA, NÃO UMA LACUNA
 *
 * Este é o ÚNICO lugar do sistema que verifica os 60 segundos. O servidor não
 * verifica, e o comentário do enum em schema.prisma diz isso explicitamente:
 * provar duração exigiria parsear a caixa `mvhd` do container, e um arquivo
 * forjado pode mentir nela. O que o servidor prova é tamanho (do objeto real),
 * container (magic bytes) e posse.
 *
 * Ou seja: 60s é regra de PRODUTO, 50 MB é regra de SEGURANÇA. Quem contornar
 * o cliente consegue publicar um vídeo mais longo — desde que caiba em 50 MB.
 * Aceito no V0, registrado, e não disfarçado de garantia.
 *
 * `duracaoSegundos` é `null` quando o browser não conseguiu ler a metadata.
 * Nesse caso RECUSAMOS: publicar sem saber a duração seria aceitar em silêncio
 * o que a regra existe para limitar.
 */
export function validateVideoCandidate(file: {
  type: string
  size: number
  duracaoSegundos: number | null
}): PhotoValidation {
  const tipo = file.type.toLowerCase()

  if (TIPOS_VIDEO_INCOMPATIVEIS.includes(tipo)) {
    return { ok: false, message: VIDEO_COPY.webm }
  }
  if (!(CARE_VIDEO_ALLOWED_TYPES_FOR_PATH as string[]).includes(tipo)) {
    return { ok: false, message: VIDEO_COPY.tipoInvalido }
  }
  if (file.size > CARE_VIDEO_MAX_BYTES) {
    return { ok: false, message: VIDEO_COPY.muitoGrande }
  }
  if (file.duracaoSegundos === null || !Number.isFinite(file.duracaoSegundos)) {
    return { ok: false, message: VIDEO_COPY.duracaoDesconhecida }
  }
  if (file.duracaoSegundos > CARE_VIDEO_MAX_DURATION_SECONDS) {
    return { ok: false, message: VIDEO_COPY.muitoLongo }
  }

  return { ok: true }
}

export type PhotoRejection = { ok: false; message: string }
export type PhotoAcceptance = { ok: true }
export type PhotoValidation = PhotoAcceptance | PhotoRejection

/**
 * Uma foto candidata pode entrar na seleção?
 *
 * Ordem deliberada: TIPO antes de TAMANHO. Um HEIC de 8 MB deve ouvir "este
 * formato não é compatível" (acionável: reexportar) e não "muito grande"
 * (levaria a pessoa a comprimir um arquivo que seria recusado do mesmo jeito).
 *
 * `type` vazio é comum em mobile — alguns navegadores não preenchem o MIME.
 * Tratamos como inválido aqui porque o ticket exige um MIME declarado; a
 * pessoa recebe a frase genérica de imagem inválida, que é verdadeira.
 */
export function validatePhotoCandidate(file: { type: string; size: number }): PhotoValidation {
  if (TIPOS_HEIC.includes(file.type.toLowerCase())) {
    return { ok: false, message: PHOTO_COPY.heic }
  }

  if (!(CARE_MEDIA_ALLOWED_TYPES as string[]).includes(file.type)) {
    return { ok: false, message: PHOTO_COPY.tipoInvalido }
  }

  if (file.size > CARE_MEDIA_MAX_BYTES) {
    return { ok: false, message: PHOTO_COPY.muitoGrande }
  }

  return { ok: true }
}

/** Quantas fotos ainda cabem. Nunca negativo. */
export function remainingPhotoSlots(selecionadas: number): number {
  return Math.max(0, CARE_MEDIA_MAX_PER_UPDATE - selecionadas)
}

export function canAddMorePhotos(selecionadas: number): boolean {
  return remainingPhotoSlots(selecionadas) > 0
}

/** Rótulo do contador: "0/3", "1/3", … */
export function photoCounterLabel(selecionadas: number): string {
  return `${selecionadas}/${CARE_MEDIA_MAX_PER_UPDATE}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Decisão de publicação — o coração do item 5 (erro parcial)
// ─────────────────────────────────────────────────────────────────────────────

export type PublishReadiness =
  /** Nada a enviar ou tudo já enviado: pode publicar com estes paths. */
  | { kind: "pronto"; paths: string[] }
  /** Há foto em voo — esperar, não publicar pela metade. */
  | { kind: "aguardando_upload" }
  /**
   * Há foto com erro. NUNCA publicamos silenciosamente só as que deram certo:
   * a pessoa selecionou 3 porque queria 3. Ela decide retry ou remover, e só
   * então publica conscientemente.
   */
  | { kind: "bloqueado_por_erro"; comErro: number }

/**
 * Dado o estado atual da seleção, publicar agora é seguro?
 *
 * Note que `pronta` (selecionada mas ainda não enviada) NÃO bloqueia: o fluxo
 * de publicação envia as pendentes primeiro. Quem bloqueia é `enviando`
 * (corrida) e `erro` (decisão humana pendente).
 */
export function evaluatePublishReadiness(itens: PhotoSelectionItem[]): PublishReadiness {
  const comErro = itens.filter((i) => i.status === "erro").length
  if (comErro > 0) {
    return { kind: "bloqueado_por_erro", comErro }
  }

  if (itens.some((i) => i.status === "enviando")) {
    return { kind: "aguardando_upload" }
  }

  // Só entram paths de fotos comprovadamente enviadas. Uma `pronta` sem path
  // nunca vira string vazia no array — isso viraria erro de validação no
  // servidor com mensagem incompreensível.
  const paths = itens
    .filter((i) => i.status === "enviada" && i.path !== null)
    .map((i) => i.path as string)

  return { kind: "pronto", paths }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rascunho — item 7
// ─────────────────────────────────────────────────────────────────────────────

export type CareUpdateDraft = {
  content: string
  category: string
}

/**
 * Chave por request: dois atendimentos abertos em abas diferentes não podem
 * misturar rascunho. `sessionStorage` (não `local`) porque o rascunho é da
 * sessão de trabalho, não um documento a preservar entre dias.
 */
export function careUpdateDraftKey(requestId: string): string {
  return `peteen:care-draft:${requestId}`
}

/**
 * Só texto e categoria — NUNCA File/Blob.
 *
 * Não é limitação de espaço: `sessionStorage` guarda string, e serializar
 * bytes de imagem em base64 seria (a) lento, (b) capaz de estourar a cota com
 * 3 fotos de 5 MB, e (c) uma cópia não criptografada de conteúdo do
 * atendimento no disco do dispositivo. Por isso o contrato é explícito com a
 * pessoa: o texto volta, as fotos precisam ser escolhidas de novo.
 */
export function serializeCareUpdateDraft(draft: CareUpdateDraft): string {
  return JSON.stringify({ content: draft.content, category: draft.category })
}

/** Devolve `null` para qualquer entrada que não seja um rascunho íntegro. */
export function parseCareUpdateDraft(raw: string | null): CareUpdateDraft | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const { content, category } = parsed as Record<string, unknown>
    if (typeof content !== "string" || typeof category !== "string") return null
    if (content.trim().length === 0) return null
    return { content, category }
  } catch {
    // sessionStorage corrompido ou de uma versão antiga do formato: ignorar em
    // silêncio é melhor que quebrar a tela de publicação.
    return null
  }
}

/** Tipo estreito para o ticket, sem depender de tipo server-only no client. */
export type CareMediaMimeTypeForUpload = CareMediaMimeType
