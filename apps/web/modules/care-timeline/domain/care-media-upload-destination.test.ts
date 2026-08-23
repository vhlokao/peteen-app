/**
 * Regressão do incidente "Invalid signature" no primeiro upload real de vídeo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE QUEBROU
 *
 * O servidor assinava a URL de upload para `care-media-video`, mas o cliente
 * chamava `.from()` com uma CONSTANTE local — `care-media`, o bucket de foto.
 * Como a assinatura do Supabase cobre o bucket, apresentar o token no bucket
 * errado devolve `Invalid signature` (400). Nenhum byte chegou ao Storage,
 * nenhum órfão ficou para trás, e a tela mostrou "não foi possível enviar esta
 * foto" — depois de o profissional ter gravado um VÍDEO.
 *
 * Enquanto só existia foto, a constante acertava por coincidência. Foi preciso
 * um segundo bucket para o defeito aparecer, e ele só apareceu no aparelho
 * físico: `uploadCareMediaToTicket` é I/O de browser e nenhuma suíte de
 * domínio o exercitava.
 *
 * Estes testes cobrem as duas metades do que falhou:
 *   1. o DESTINO por tipo de mídia (função pura);
 *   2. o cliente não voltar a completar o endereço por conta própria
 *      (verificação estrutural do fonte, mesmo padrão já usado em
 *      care-update-timing.test.ts para a regressão da foto que não publicava);
 *   3. a COPY nunca chamar vídeo de foto.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  bucketForCareMediaKind,
  CARE_MEDIA_BUCKET_NAME,
  CARE_MEDIA_VIDEO_BUCKET_NAME,
} from "./care-media-bucket.ts"
import { copyDeFalhaUpload, PHOTO_COPY, VIDEO_COPY } from "./photo-selection.ts"

// ─────────────────────────────────────────────────────────────────────────────
// 1. Destino por tipo de mídia
// ─────────────────────────────────────────────────────────────────────────────

describe("bucketForCareMediaKind — destino do ticket de upload", () => {
  it("PHOTO vai para care-media", () => {
    assert.equal(bucketForCareMediaKind("PHOTO"), "care-media")
    assert.equal(bucketForCareMediaKind("PHOTO"), CARE_MEDIA_BUCKET_NAME)
  })

  it("VIDEO vai para care-media-video", () => {
    assert.equal(bucketForCareMediaKind("VIDEO"), "care-media-video")
    assert.equal(bucketForCareMediaKind("VIDEO"), CARE_MEDIA_VIDEO_BUCKET_NAME)
  })

  it("os dois buckets são DIFERENTES — é isso que torna o destino uma decisão", () => {
    // Se um dia colapsarem num só, o bug original volta a ser invisível: o
    // cliente poderia hardcodar qualquer um e continuar passando.
    assert.notEqual(
      bucketForCareMediaKind("PHOTO"),
      bucketForCareMediaKind("VIDEO")
    )
  })

  it("VIDEO nunca resolve para o bucket de foto", () => {
    // A asserção que teria reprovado o código que foi a produção.
    assert.notEqual(bucketForCareMediaKind("VIDEO"), CARE_MEDIA_BUCKET_NAME)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. O cliente obedece ao ticket — verificação estrutural
// ─────────────────────────────────────────────────────────────────────────────

const CLIENTE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../infrastructure/upload-care-media-client.ts"
  ),
  "utf8"
)

/** Remove comentários: o texto que explica o incidente cita os nomes dos
 *  buckets, e isso não pode reprovar o teste. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("upload-care-media-client — o destino vem do ticket, não do cliente", () => {
  const codigo = semComentarios(CLIENTE)

  it("usa ticket.bucket no .from()", () => {
    assert.match(
      codigo,
      /\.from\(\s*ticket\.bucket\s*\)/,
      "o upload precisa endereçar o bucket que o servidor assinou"
    )
  })

  it("não importa nenhuma constante de bucket", () => {
    // A raiz do incidente foi exatamente este import.
    assert.doesNotMatch(
      codigo,
      /CARE_MEDIA_BUCKET_NAME|CARE_MEDIA_VIDEO_BUCKET_NAME|bucketForCareMediaKind/,
      "o cliente não pode conhecer nomes de bucket — o ticket já traz o destino"
    )
  })

  it("não contém nome de bucket literal", () => {
    assert.doesNotMatch(
      codigo,
      /["'`]care-media(-video)?["'`]/,
      "nome de bucket literal no cliente reintroduz o bug"
    )
  })

  it("falha fechado quando o ticket vem sem bucket", () => {
    // Um fallback para `care-media` aqui recriaria o incidente em silêncio, e
    // só para vídeo — o modo de falha mais difícil de perceber.
    assert.match(
      codigo,
      /if\s*\(\s*!\s*ticket\.bucket\s*\)/,
      "ticket sem bucket precisa ser recusado, não adivinhado"
    )
  })

  it("loga kind e bucket para diagnóstico", () => {
    assert.match(codigo, /kind:/, "sem kind não se distingue foto de vídeo no log")
    assert.match(codigo, /bucket:\s*ticket\.bucket/)
  })

  it("NUNCA loga token nem signedUrl", () => {
    // O token é credencial de escrita; a URL assinada o contém.
    assert.doesNotMatch(
      codigo,
      /console\.(error|warn|log|info)\([^)]*(token|signedUrl)/,
      "credencial de escrita não pode ir para log"
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Copy — vídeo nunca é chamado de foto
// ─────────────────────────────────────────────────────────────────────────────

describe("copyDeFalhaUpload", () => {
  it("VIDEO devolve a mensagem de vídeo", () => {
    assert.equal(copyDeFalhaUpload("VIDEO"), VIDEO_COPY.falhaUpload)
  })

  it("PHOTO devolve a mensagem de foto", () => {
    assert.equal(copyDeFalhaUpload("PHOTO"), PHOTO_COPY.falhaUpload)
  })

  it("VIDEO nunca menciona 'foto' — o defeito exato relatado no QA físico", () => {
    const mensagem = copyDeFalhaUpload("VIDEO")
    assert.doesNotMatch(mensagem, /foto/i)
    assert.match(mensagem, /vídeo/i)
  })

  it("PHOTO nunca menciona 'vídeo'", () => {
    const mensagem = copyDeFalhaUpload("PHOTO")
    assert.doesNotMatch(mensagem, /vídeo/i)
    assert.match(mensagem, /foto/i)
  })

  it("as duas mensagens são distintas", () => {
    assert.notEqual(copyDeFalhaUpload("PHOTO"), copyDeFalhaUpload("VIDEO"))
  })

  it("nenhuma das duas expõe termo técnico ao usuário", () => {
    for (const kind of ["PHOTO", "VIDEO"] as const) {
      const m = copyDeFalhaUpload(kind)
      assert.doesNotMatch(m, /bucket|storage|supabase|signature|400|token|upload/i)
      assert.match(m, /\.$/, "mensagem ao usuário termina com ponto")
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. O componente escolhe a copy pelo tipo do item
// ─────────────────────────────────────────────────────────────────────────────

const PICKER = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../components/CarePhotoPicker.tsx"
  ),
  "utf8"
)

describe("CarePhotoPicker — copy de falha segue o tipo do item", () => {
  const codigo = semComentarios(PICKER)

  it("não passa PHOTO_COPY.falhaUpload fixo para o upload", () => {
    assert.doesNotMatch(
      codigo,
      /mensagemDeFalha:\s*PHOTO_COPY\.falhaUpload/,
      "era isto que fazia o vídeo falhar dizendo 'foto'"
    )
  })

  it("resolve a copy por kind, no upload e no fallback da lista", () => {
    const ocorrencias = codigo.match(/copyDeFalhaUpload\(/g) ?? []
    assert.ok(
      ocorrencias.length >= 2,
      `esperado ao menos 2 usos (upload + fallback), encontrado ${ocorrencias.length}`
    )
  })

  it("o fallback da lista de erros não usa a copy de foto fixa", () => {
    assert.doesNotMatch(codigo, /errorMessage\s*\?\?\s*PHOTO_COPY\.falhaUpload/)
  })

  it("propaga o kind ao enviar — foto e vídeo têm caminhos distintos", () => {
    assert.match(codigo, /enviarFoto\([^)]*"PHOTO"\)/)
    assert.match(codigo, /enviarFoto\([^)]*"VIDEO"\)/)
  })
})
