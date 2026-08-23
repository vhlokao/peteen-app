/**
 * Detecção de container de vídeo por magic bytes.
 *
 * O teste central é o de que HEIC NÃO passa: HEIC e MP4/MOV são ambos ISOBMFF
 * e começam com a mesma caixa `ftyp`, então uma checagem ingênua de container
 * aceitaria uma foto de iPhone como vídeo.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CARE_VIDEO_SIGNATURE_READ_LENGTH,
  detectVideoTypeFromBytes,
  isHeicByVideoProbe,
} from "./care-video-signature.ts"

/**
 * Monta uma caixa `ftyp` real: [tamanho][ftyp][major][minor][compatíveis...].
 * Escrever os bytes à mão (em vez de fixtures binárias) mantém o teste legível
 * e deixa explícito QUAL byte cada guarda está exercitando.
 */
function ftyp(major: string, compatibles: string[] = []): Uint8Array {
  const tamanho = 16 + compatibles.length * 4
  const b = new Uint8Array(Math.max(tamanho, 16))
  b[0] = (tamanho >> 24) & 0xff
  b[1] = (tamanho >> 16) & 0xff
  b[2] = (tamanho >> 8) & 0xff
  b[3] = tamanho & 0xff
  const escrever = (s: string, off: number) => {
    for (let i = 0; i < 4; i++) b[off + i] = s.charCodeAt(i)
  }
  escrever("ftyp", 4)
  escrever(major, 8)
  // minor_version fica em 12..15 (zeros)
  compatibles.forEach((c, i) => escrever(c, 16 + i * 4))
  return b
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE CENTRAL — HEIC não pode virar vídeo
// ─────────────────────────────────────────────────────────────────────────────

describe("HEIC nunca é aceito como vídeo", () => {
  it("recusa todos os brands HEIC/HEIF como major", () => {
    for (const brand of ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]) {
      assert.equal(detectVideoTypeFromBytes(ftyp(brand)), null, `aceitou HEIC brand ${brand}`)
    }
  })

  it("recusa mesmo quando o major é desconhecido e HEIC aparece nos compatíveis", () => {
    // Caso real de arquivo hostil: major inventado, compatível declarando heic.
    assert.equal(detectVideoTypeFromBytes(ftyp("XXXX", ["heic", "isom"])), null)
  })

  it("isHeicByVideoProbe identifica para mensagem específica", () => {
    assert.equal(isHeicByVideoProbe(ftyp("heic")), true)
    assert.equal(isHeicByVideoProbe(ftyp("isom")), false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Aceitos
// ─────────────────────────────────────────────────────────────────────────────

describe("containers aceitos", () => {
  it("QuickTime do iPhone — brand com DOIS espaços à direita", () => {
    // Escrever "qt" sem os espaços faria todo vídeo de iPhone ser recusado.
    assert.equal(detectVideoTypeFromBytes(ftyp("qt  ")), "video/quicktime")
  })

  it("brands de MP4 comuns em Android e iOS", () => {
    for (const brand of ["isom", "iso2", "mp41", "mp42", "avc1", "mmp4", "dash"]) {
      assert.equal(detectVideoTypeFromBytes(ftyp(brand)), "video/mp4", brand)
    }
  })

  it("major desconhecido é resgatado por compatible brand conhecido", () => {
    assert.equal(detectVideoTypeFromBytes(ftyp("XXXX", ["isom", "mp42"])), "video/mp4")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Recusados — allowlist fechada
// ─────────────────────────────────────────────────────────────────────────────

describe("allowlist fechada", () => {
  it("recusa container ISOBMFF desconhecido", () => {
    assert.equal(detectVideoTypeFromBytes(ftyp("ZZZZ")), null)
    assert.equal(detectVideoTypeFromBytes(ftyp("ZZZZ", ["YYYY", "WWWW"])), null)
  })

  it("recusa WebM — nem chega a ser ISOBMFF", () => {
    // EBML magic: 1A 45 DF A3. Sem caixa `ftyp`, morre na primeira guarda.
    const webm = new Uint8Array(32)
    webm.set([0x1a, 0x45, 0xdf, 0xa3], 0)
    assert.equal(detectVideoTypeFromBytes(webm), null)
  })

  it("recusa arquivo sem caixa ftyp", () => {
    const lixo = new Uint8Array(64).fill(0x41) // "AAAA..."
    assert.equal(detectVideoTypeFromBytes(lixo), null)
  })

  it("recusa JPEG e PNG (que são mídia válida, mas não vídeo)", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])
    assert.equal(detectVideoTypeFromBytes(jpeg), null)
    assert.equal(detectVideoTypeFromBytes(png), null)
  })

  it("recusa arquivo truncado — nunca decide com menos que o cabeçalho fixo", () => {
    assert.equal(detectVideoTypeFromBytes(new Uint8Array(0)), null)
    assert.equal(detectVideoTypeFromBytes(ftyp("isom").slice(0, 15)), null)
  })

  it("aceita exatamente no limite do cabeçalho fixo (16 bytes)", () => {
    assert.equal(detectVideoTypeFromBytes(ftyp("isom").slice(0, 16)), "video/mp4")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Janela de leitura — o que sustenta o Range pequeno
// ─────────────────────────────────────────────────────────────────────────────

describe("janela de leitura", () => {
  it("64 bytes cobrem cabeçalho fixo + 12 compatible brands", () => {
    assert.equal(CARE_VIDEO_SIGNATURE_READ_LENGTH, 64)
    assert.equal(16 + 12 * 4, CARE_VIDEO_SIGNATURE_READ_LENGTH)
  })

  it("é pequena o bastante para não justificar baixar o objeto", () => {
    // O ponto inteiro do Range: 64 bytes contra até 50 MB.
    assert.ok(CARE_VIDEO_SIGNATURE_READ_LENGTH <= 256)
  })

  it("não decide por brand além do que foi lido", () => {
    // Caixa declara 40 bytes de conteúdo, mas só entregamos 20. O brand válido
    // que ficaria em 24..27 NÃO pode ser considerado — decidir com dado não
    // lido seria aceitar por suposição.
    const completo = ftyp("XXXX", ["YYYY", "ZZZZ", "isom"])
    const truncado = completo.slice(0, 20)
    assert.equal(detectVideoTypeFromBytes(truncado), null)
    // Com os bytes completos, o mesmo arquivo é aceito.
    assert.equal(detectVideoTypeFromBytes(completo), "video/mp4")
  })
})
