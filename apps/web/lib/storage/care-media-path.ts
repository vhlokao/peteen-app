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

/** Extensões aceitas, derivadas dos únicos MIME types do contrato V0. */
export const CARE_MEDIA_EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

export type CareMediaMimeType = keyof typeof CARE_MEDIA_EXTENSION_BY_TYPE

export const CARE_MEDIA_ALLOWED_TYPES = Object.keys(
  CARE_MEDIA_EXTENSION_BY_TYPE
) as CareMediaMimeType[]

/** Igual ao file_size_limit do bucket — divergir faria o Storage recusar o que a app aceitou. */
export const CARE_MEDIA_MAX_BYTES = 5 * 1024 * 1024

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

const EXTENSOES = new Set(Object.values(CARE_MEDIA_EXTENSION_BY_TYPE))

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
  mimeType: CareMediaMimeType
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
  const extensao = Object.prototype.hasOwnProperty.call(CARE_MEDIA_EXTENSION_BY_TYPE, mimeType)
    ? CARE_MEDIA_EXTENSION_BY_TYPE[mimeType]
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
  if (!EXTENSOES.has(match[2] as (typeof CARE_MEDIA_EXTENSION_BY_TYPE)[CareMediaMimeType])) {
    return null
  }

  return { requestId, fileName }
}

/** Extensão → MIME. Inverso exato de CARE_MEDIA_EXTENSION_BY_TYPE. */
const TYPE_BY_EXTENSION: Record<string, CareMediaMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
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
export function declaredMimeTypeFromCareMediaPath(path: unknown): CareMediaMimeType | null {
  const partes = parseCareMediaPath(path)
  if (!partes) return null
  const ext = partes.fileName.split(".").pop()
  if (!ext) return null
  return TYPE_BY_EXTENSION[ext] ?? null
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
