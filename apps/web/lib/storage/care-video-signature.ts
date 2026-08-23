/**
 * Detecção de container de VÍDEO por magic bytes — pura, sem rede, sem Storage.
 *
 * Irmão de `pet-photo-signature.ts`, mesma filosofia: o MIME declarado pelo
 * cliente NUNCA é prova. A auditoria de R1 demonstrou, no Storage real, que um
 * arquivo arbitrário declarado como `image/png` é aceito e armazenado com esse
 * Content-Type. Para vídeo vale igual — com o agravante de que o objeto pode
 * ter 50 MB.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISOBMFF: A MESMA ESTRUTURA QUE JÁ RECONHECEMOS PARA RECUSAR HEIC
 *
 * MP4, QuickTime/MOV e HEIC são todos ISO Base Media File Format. O arquivo
 * começa com uma caixa `ftyp`:
 *
 *   offset 0..3    tamanho da caixa (uint32 big-endian)
 *   offset 4..7    'ftyp'
 *   offset 8..11   major_brand              (4 chars ASCII)
 *   offset 12..15  minor_version            (uint32)
 *   offset 16..    compatible_brands[]      (4 chars cada, até o fim da caixa)
 *
 * `pet-photo-signature.ts` já lê essa caixa para reconhecer HEIC e dar uma
 * mensagem melhor. Aqui a lemos para o efeito oposto — e por isso a lista de
 * brands HEIC é IMPORTADA de lá, nunca reescrita: um HEIC tem `ftyp` e passaria
 * por uma checagem ingênua de "é ISOBMFF, logo é vídeo".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALLOWLIST FECHADA, NUNCA DENYLIST
 *
 * Só os brands abaixo são aceitos. Um container desconhecido — mesmo sendo
 * ISOBMFF válido — é RECUSADO. É o contrário de "recuse o que eu sei que é
 * ruim": aqui só entra o que sabemos reproduzir no player nativo dos dois
 * sistemas que o piloto atende.
 *
 * WebM/Matroska não aparece nesta lista nem por engano: além de fora da
 * allowlist do bucket, ele nem é ISOBMFF (começa com EBML `0x1A45DFA3`), então
 * é recusado já na primeira guarda.
 */

// Caminho relativo com extensão .ts explícita: permite carregar este módulo
// direto por `node --experimental-strip-types --test`, sem bundler. Mesmo
// padrão de care-media-validation.ts e photo-selection.ts.
import { HEIC_HEIF_BRANDS } from "./pet-photo-signature.ts"

export const CARE_VIDEO_ALLOWED_TYPES = ["video/mp4", "video/quicktime"] as const
export type CareVideoMimeType = (typeof CARE_VIDEO_ALLOWED_TYPES)[number]

/**
 * Quantos bytes o parser precisa ler do início do objeto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE NÚMERO É DERIVADO, NÃO ARBITRÁRIO
 *
 *   8 bytes   tamanho da caixa + 'ftyp'
 * + 4 bytes   major_brand
 * + 4 bytes   minor_version
 * = 16 bytes  cabeçalho fixo — o mínimo para decidir por major_brand
 *
 * + 48 bytes  espaço para até 12 compatible_brands (4 bytes cada)
 * = 64 bytes  total
 *
 * Doze brands compatíveis é folgado: arquivos reais de iPhone e Android trazem
 * de 2 a 6. Se uma caixa `ftyp` for maior que isso, os brands além do byte 64
 * simplesmente não são consultados — e isso é seguro, porque a decisão já terá
 * sido tomada pelo major_brand ou pelos primeiros compatíveis. Nunca é uma
 * decisão de ACEITAR baseada em dado que não lemos.
 *
 * O ponto de ler pouco: no caminho de publicação isto vira uma requisição
 * `Range` de 64 bytes em vez de baixar até 50 MB. Ver `readCareMediaHeadBytes`.
 */
export const CARE_VIDEO_SIGNATURE_READ_LENGTH = 64

/** Mínimo absoluto para decidir qualquer coisa: caixa + major_brand + minor. */
const CABECALHO_FIXO = 16

/**
 * Brands de MP4 que o player nativo reproduz em Android e iOS.
 *
 * `isom`/`iso2` são os genéricos do padrão; `mp41`/`mp42` são as versões do
 * MPEG-4; `avc1` aparece em gravações H.264; `mmp4` e `dash` surgem em
 * arquivos de alguns apps de câmera. Todos convergem para `video/mp4`.
 */
const BRANDS_MP4 = new Set([
  "isom", "iso2", "iso4", "iso5", "iso6",
  "mp41", "mp42",
  "avc1",
  "mmp4",
  "dash",
  "M4V ",
])

/**
 * QuickTime. O brand tem DOIS ESPAÇOS À DIREITA — `"qt  "`, não `"qt"`.
 * É o que o iPhone grava nativamente em `.mov`, e escrever sem os espaços
 * faria a comparação falhar silenciosamente para todo vídeo de iPhone.
 */
const BRAND_QUICKTIME = "qt  "

function lerBrand(bytes: Uint8Array, offset: number): string | null {
  if (bytes.length < offset + 4) return null
  // Latin-1, não UTF-8: brands são 4 bytes ASCII por especificação, e um byte
  // alto num arquivo hostil viraria U+FFFD em UTF-8, podendo colidir entre
  // entradas diferentes. Latin-1 mapeia 1 byte para 1 caractere, sempre.
  let s = ""
  for (let i = offset; i < offset + 4; i++) s += String.fromCharCode(bytes[i]!)
  return s
}

function mimeDoBrand(brand: string): CareVideoMimeType | null {
  if (brand === BRAND_QUICKTIME) return "video/quicktime"
  if (BRANDS_MP4.has(brand)) return "video/mp4"
  return null
}

/**
 * Tipo real do vídeo pelos magic bytes, ou `null` para qualquer coisa que não
 * seja um container da allowlist.
 *
 * `null` é a resposta para TUDO que não é comprovadamente aceito: não-ISOBMFF,
 * HEIC, brand desconhecido, arquivo truncado. Quem chama recusa — fail closed.
 */
export function detectVideoTypeFromBytes(bytes: Uint8Array): CareVideoMimeType | null {
  if (bytes.length < CABECALHO_FIXO) return null

  // Guarda 1 — é uma caixa `ftyp`? Barra WebM, MKV, AVI, executável, script.
  const isFtyp =
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  if (!isFtyp) return null

  const major = lerBrand(bytes, 8)
  if (!major) return null

  // Guarda 2 — HEIC/HEIF é ISOBMFF e tem `ftyp`, mas é IMAGEM. Recusado pelo
  // brand, antes de qualquer tentativa de mapear para vídeo. Lista importada
  // do detector de foto para não existirem duas versões.
  if (HEIC_HEIF_BRANDS.has(major)) return null

  // Guarda 3 — major_brand na allowlist decide.
  const porMajor = mimeDoBrand(major)
  if (porMajor) return porMajor

  // Guarda 4 — major desconhecido: os compatible_brands podem revelar um
  // container que sabemos reproduzir (acontece com apps que escrevem um major
  // proprietário). Percorremos apenas o que REALMENTE lemos e o que a caixa
  // declara conter — o menor dos dois.
  const tamanhoCaixa = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!
  const fimUtil = Math.min(bytes.length, tamanhoCaixa > 0 ? tamanhoCaixa : bytes.length)

  for (let offset = CABECALHO_FIXO; offset + 4 <= fimUtil; offset += 4) {
    const compat = lerBrand(bytes, offset)
    if (!compat) break
    // Um compatible brand de HEIC também desqualifica: nenhum arquivo que se
    // declara compatível com HEIC deve entrar como vídeo.
    if (HEIC_HEIF_BRANDS.has(compat)) return null
    const porCompat = mimeDoBrand(compat)
    if (porCompat) return porCompat
  }

  return null
}

/** true quando os bytes são de um HEIC/HEIF — para mensagem específica. */
export function isHeicByVideoProbe(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const isFtyp =
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  if (!isFtyp) return false
  const major = lerBrand(bytes, 8)
  return major !== null && HEIC_HEIF_BRANDS.has(major)
}
