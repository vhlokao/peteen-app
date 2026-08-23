/**
 * Construção e validação de paths do bucket `care-media` — pura, sem rede,
 * sem Storage, sem Next.js.
 *
 * Separada de care-media.ts pelo mesmo motivo de pet-photo-signature.ts: o
 * runner de testes do projeto (`node --test`) não resolve o alias "@/..." nem
 * `server-only`, então a lógica que MERECE teste fica onde pode ser testada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O PATH É PARTE DO MODELO DE SEGURANÇA, NÃO SÓ UM NOME
 *
 * Formato: `requests/<requestId>/<uuid>.<ext>`
 *
 * O `requestId` no path é o que permite, mais tarde (R2), provar que um path
 * enviado pelo cliente na hora de publicar pertence à request que ele diz
 * pertencer — sem essa amarração, um profissional poderia anexar à sua própria
 * atualização um arquivo de OUTRO atendimento, apenas informando o path.
 * Por isso `careMediaPathBelongsToRequest` existe e por isso o path NUNCA é
 * montado a partir de nome de arquivo vindo do cliente.
 *
 * Toda função aqui trata a entrada como HOSTIL: `..`, barras extras, segmentos
 * vazios, path absoluto e caracteres fora do conjunto permitido são rejeitados
 * antes de qualquer uso.
 */

/** Extensões de FOTO, derivadas dos MIME types do contrato V0. */
export const CARE_MEDIA_EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

/** Extensões de VÍDEO. Ambos ISOBMFF — ver lib/storage/care-video-signature.ts. */
export const CARE_VIDEO_EXTENSION_BY_TYPE = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
} as const

export type CareMediaMimeType = keyof typeof CARE_MEDIA_EXTENSION_BY_TYPE
export type CareVideoMimeTypeForPath = keyof typeof CARE_VIDEO_EXTENSION_BY_TYPE
/** Qualquer MIME que o Diário aceita, foto ou vídeo. */
export type CareAnyMimeType = CareMediaMimeType | CareVideoMimeTypeForPath

export const CARE_MEDIA_ALLOWED_TYPES = Object.keys(
  CARE_MEDIA_EXTENSION_BY_TYPE
) as CareMediaMimeType[]

export const CARE_VIDEO_ALLOWED_TYPES_FOR_PATH = Object.keys(
  CARE_VIDEO_EXTENSION_BY_TYPE
) as CareVideoMimeTypeForPath[]

/**
 * Teto de FOTO. Igual ao `file_size_limit` do bucket `care-media` — divergir
 * faria o Storage recusar o que a app aceitou (ou o contrário).
 *
 * NÃO FOI ALTERADO pela missão de vídeo, e não deve ser: vídeo tem bucket e
 * teto próprios, justamente para que este número continue valendo.
 */
export const CARE_MEDIA_MAX_BYTES = 5 * 1024 * 1024

/** Teto de VÍDEO. Igual ao `file_size_limit` do bucket `care-media-video`. */
export const CARE_VIDEO_MAX_BYTES = 50 * 1024 * 1024

/**
 * Duração máxima do vídeo — REGRA DE PRODUTO, aplicada no CLIENTE.
 *
 * Deliberadamente NÃO é garantida no servidor: provar duração exigiria parsear
 * a caixa `mvhd` do container, e um arquivo forjado pode mentir nela. O que o
 * servidor prova é tamanho (do objeto real), container (magic bytes) e posse.
 *
 * Está aqui, junto dos outros limites, para não virar número solto no
 * componente — mas o comentário existe para que ninguém leia esta constante
 * como uma garantia server-side. Ver o comentário do enum em schema.prisma.
 */
export const CARE_VIDEO_MAX_DURATION_SECONDS = 60

/** Teto de VÍDEOS por atualização. Um só — contrato V0. */
export const CARE_VIDEO_MAX_PER_UPDATE = 1

export function isCareVideoMimeType(mime: string): mime is CareVideoMimeTypeForPath {
  return Object.prototype.hasOwnProperty.call(CARE_VIDEO_EXTENSION_BY_TYPE, mime)
}

/** Tipo de mídia (domínio) a partir do MIME. `null` para o que não é aceito. */
export function careMediaKindFromMimeType(mime: string): "PHOTO" | "VIDEO" | null {
  if (isCareVideoMimeType(mime)) return "VIDEO"
  if (Object.prototype.hasOwnProperty.call(CARE_MEDIA_EXTENSION_BY_TYPE, mime)) return "PHOTO"
  return null
}

/** Teto de bytes correspondente ao tipo. Nunca misturar os dois. */
export function maxBytesForCareMediaKind(kind: "PHOTO" | "VIDEO"): number {
  return kind === "VIDEO" ? CARE_VIDEO_MAX_BYTES : CARE_MEDIA_MAX_BYTES
}

/** Teto de arquivos por atualização (contrato V0), aplicado na publicação. */
export const CARE_MEDIA_MAX_PER_UPDATE = 3

/**
 * Teto de OBJETOS no bucket por request. NÃO é cota de publicação — é freio de
 * CUSTO do bucket.
 *
 * Por que precisa existir: a cota de 3 é aplicada na publicação, não na emissão
 * de tickets, e ticket não deixa rastro nenhum para contar. A revisão de
 * segurança mediu ~63 tickets/s de um único processo, com 5 MB autorizados por
 * ticket — cerca de 0,5 GB de escrita autorizada por rajada, sem teto por
 * usuário, por request ou por janela, e sem coletor de órfãos. O excedente não
 * vira mídia publicada, mas vira armazenamento pago e permanente.
 *
 * 60 é folgado de propósito: são ~20 publicações de 3 fotos no mesmo
 * atendimento, com margem para retentativas. Um pet-sitting longo e legítimo
 * cabe; uma rajada automatizada, não.
 */
export const CARE_MEDIA_MAX_OBJECTS_PER_REQUEST = 60

/** Prefixo fixo — mantém o bucket organizável e o parser previsível. */
const PREFIXO = "requests"

/**
 * Conjunto conservador o bastante para cobrir cuid/cuid2/uuid e barrar
 * separador de path, traversal e qualquer coisa exótica.
 */
const ID_SEGURO = /^[A-Za-z0-9_-]{1,64}$/

/** Extensões válidas de QUALQUER mídia do Diário — foto e vídeo. */
const EXTENSOES = new Set<string>([
  ...Object.values(CARE_MEDIA_EXTENSION_BY_TYPE),
  ...Object.values(CARE_VIDEO_EXTENSION_BY_TYPE),
])

/** MIME → extensão, cobrindo os dois tipos. Fonte única do mapeamento. */
const EXTENSION_BY_ANY_TYPE: Record<string, string> = {
  ...CARE_MEDIA_EXTENSION_BY_TYPE,
  ...CARE_VIDEO_EXTENSION_BY_TYPE,
}

/** Nome de arquivo: <uuid|id>.<ext>, sem ponto extra e sem caminho embutido. */
const NOME_ARQUIVO = /^([A-Za-z0-9_-]{1,64})\.([a-z0-9]{2,5})$/

export function isCareMediaRequestId(valor: string): boolean {
  return ID_SEGURO.test(valor)
}

/**
 * Monta o path de destino de um arquivo novo.
 *
 * `fileId` é injetado (em vez de gerado aqui) para manter a função pura e
 * determinística no teste; o chamador de produção passa `crypto.randomUUID()`.
 * Lança em entrada inválida: um path malformado não deve virar objeto no
 * bucket, e sinalizar cedo evita gravar lixo silenciosamente.
 */
export function buildCareMediaPath(params: {
  requestId: string
  fileId: string
  /** Foto OU vídeo — a extensão sai daqui, e é ela que o parser reconhece. */
  mimeType: CareAnyMimeType
}): string {
  const { requestId, fileId, mimeType } = params

  if (!isCareMediaRequestId(requestId)) {
    throw new Error("requestId inválido para path de care-media")
  }
  if (!ID_SEGURO.test(fileId)) {
    throw new Error("fileId inválido para path de care-media")
  }
  // hasOwnProperty em vez de acesso indexado direto: o objeto literal herda de
  // Object.prototype, então `CARE_MEDIA_EXTENSION_BY_TYPE["constructor"]` (ou
  // "__proto__", "toString", "valueOf", "hasOwnProperty") devolve um valor
  // TRUTHY e atravessaria a guarda abaixo, gerando um path com espaços e
  // colchetes — que depois nem sequer casa em parseCareMediaPath, quebrando a
  // amarração path↔request na publicação.
  // Hoje nenhum caller chega aqui com essas chaves (a allowlist a montante usa
  // Object.keys), mas este arquivo se declara defesa própria contra entrada
  // hostil: ele não pode depender de validação de terceiros para valer.
  const extensao = Object.prototype.hasOwnProperty.call(EXTENSION_BY_ANY_TYPE, mimeType)
    ? EXTENSION_BY_ANY_TYPE[mimeType]
    : undefined
  if (!extensao) {
    throw new Error("mimeType não suportado para care-media")
  }

  return `${PREFIXO}/${requestId}/${fileId}.${extensao}`
}

export type CareMediaPathParts = {
  requestId: string
  fileName: string
}

/**
 * Decompõe um path do bucket. Retorna null para QUALQUER coisa que não seja
 * exatamente `requests/<id>/<nome>.<ext>` com extensão do contrato — incluindo
 * profundidade errada, segmento vazio, `..`, path absoluto ou extensão fora da
 * lista. Null significa "não é um path nosso"; nunca lança, porque a entrada
 * esperada aqui vem de fora e recusar é o caminho normal.
 */
export function parseCareMediaPath(path: unknown): CareMediaPathParts | null {
  if (typeof path !== "string") return null
  if (path.length === 0 || path.length > 200) return null
  // Barra inicial, barra dupla ou backslash já indicam path manipulado.
  if (path.startsWith("/") || path.includes("//") || path.includes("\\")) return null

  const partes = path.split("/")
  if (partes.length !== 3) return null

  const [prefixo, requestId, fileName] = partes as [string, string, string]
  if (prefixo !== PREFIXO) return null
  if (!ID_SEGURO.test(requestId)) return null

  const match = NOME_ARQUIVO.exec(fileName)
  if (!match) return null
  if (!EXTENSOES.has(match[2]!)) {
    return null
  }

  return { requestId, fileName }
}

/** Extensão → MIME. Inverso exato dos dois mapas de extensão. */
const TYPE_BY_EXTENSION: Record<string, CareAnyMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
}

/**
 * Recupera o tipo DECLARADO no momento da emissão do ticket, a partir da
 * extensão do path.
 *
 * Por que a extensão é fonte confiável para isso: o path inteiro é gerado pelo
 * servidor em `buildCareMediaPath`, e a extensão sai do `mimeType` que o
 * chamador declarou ali. O cliente não escolhe o path, então não escolhe a
 * extensão. Guardar essa declaração em outro lugar (estado de ticket, campo
 * extra no publish) só criaria uma segunda fonte, passível de divergir do path
 * — ou, pior, controlável pelo cliente.
 *
 * É contra ESTE valor que os magic bytes são comparados na publicação.
 */
export function declaredMimeTypeFromCareMediaPath(path: unknown): CareAnyMimeType | null {
  const partes = parseCareMediaPath(path)
  if (!partes) return null
  const ext = partes.fileName.split(".").pop()
  if (!ext) return null
  return TYPE_BY_EXTENSION[ext] ?? null
}

/**
 * Tipo de mídia derivado do PATH — que o servidor gerou. É assim que a
 * publicação sabe em qual bucket procurar o objeto e qual teto aplicar, sem
 * receber nada disso do cliente.
 */
export function careMediaKindFromPath(path: unknown): "PHOTO" | "VIDEO" | null {
  const mime = declaredMimeTypeFromCareMediaPath(path)
  return mime ? careMediaKindFromMimeType(mime) : null
}

/**
 * A amarração que impede anexar mídia de um atendimento a outro.
 * Comparação exata — nada de `startsWith`, que aceitaria "req1" como prefixo
 * de "req12".
 */
export function careMediaPathBelongsToRequest(path: unknown, requestId: string): boolean {
  const partes = parseCareMediaPath(path)
  if (!partes) return false
  return partes.requestId === requestId
}
