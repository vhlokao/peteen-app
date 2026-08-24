/**
 * R2B.4 — regras da seleção de fotos no formulário do Diário.
 *
 * Cobre os cenários E/F/G/D/I/J/P/Q do QA da missão que são decidíveis sem
 * navegador. Os que exigem browser real (upload, magic bytes, lightbox) ficam
 * para o QA ao vivo — ver relatório.
 *
 * Rodar: npm run test:care-media
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CARE_MEDIA_MAX_BYTES,
  CARE_MEDIA_MAX_PER_UPDATE,
  canAddMorePhotos,
  careUpdateDraftKey,
  evaluatePublishReadiness,
  parseCareUpdateDraft,
  photoCounterLabel,
  PHOTO_COPY,
  remainingPhotoSlots,
  serializeCareUpdateDraft,
  validatePhotoCandidate,
  CARE_VIDEO_MAX_BYTES,
  CARE_VIDEO_MAX_DURATION_SECONDS,
  CARE_VIDEO_MAX_MB,
  isVideoMimeType,
  validateVideoCandidate,
  VIDEO_COPY,
  type PhotoSelectionItem,
} from "./photo-selection.ts"

const MB = 1024 * 1024

function item(over: Partial<PhotoSelectionItem> = {}): PhotoSelectionItem {
  return { id: "p1", status: "enviada", path: "req/abc.jpg", errorMessage: null, ...over }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de arquivo — itens E, F, G
// ─────────────────────────────────────────────────────────────────────────────

describe("validatePhotoCandidate — formatos aceitos", () => {
  it("aceita JPEG, PNG e WebP dentro do limite", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      assert.deepEqual(validatePhotoCandidate({ type, size: 1 * MB }), { ok: true }, type)
    }
  })
})

describe("item F — GIF é recusado", () => {
  it("GIF não está no contrato V0", () => {
    const r = validatePhotoCandidate({ type: "image/gif", size: 1 * MB })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, PHOTO_COPY.tipoInvalido)
  })
})

describe("item G — HEIC tem mensagem própria", () => {
  it("HEIC recebe orientação acionável, não 'imagem inválida'", () => {
    const r = validatePhotoCandidate({ type: "image/heic", size: 1 * MB })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, PHOTO_COPY.heic)
  })

  it("HEIF também", () => {
    const r = validatePhotoCandidate({ type: "image/heif", size: 1 * MB })
    assert.equal(r.ok === false && r.message, PHOTO_COPY.heic)
  })

  it("HEIC grande fala de FORMATO, não de tamanho — a ordem da checagem importa", () => {
    // Dizer "muito grande" mandaria a pessoa comprimir um arquivo que seria
    // recusado de qualquer forma.
    const r = validatePhotoCandidate({ type: "image/heic", size: 20 * MB })
    assert.equal(r.ok === false && r.message, PHOTO_COPY.heic)
  })

  it("maiúsculas não escapam da detecção", () => {
    const r = validatePhotoCandidate({ type: "IMAGE/HEIC", size: 1 * MB })
    assert.equal(r.ok === false && r.message, PHOTO_COPY.heic)
  })
})

describe("item E — tamanho acima de 5 MB", () => {
  it("acima do teto é recusado", () => {
    const r = validatePhotoCandidate({ type: "image/jpeg", size: CARE_MEDIA_MAX_BYTES + 1 })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, PHOTO_COPY.muitoGrande)
  })

  it("exatamente no teto é aceito", () => {
    assert.deepEqual(
      validatePhotoCandidate({ type: "image/jpeg", size: CARE_MEDIA_MAX_BYTES }),
      { ok: true }
    )
  })

  it("o teto do cliente é o MESMO do bucket — divergir criaria recusa tardia", () => {
    assert.equal(CARE_MEDIA_MAX_BYTES, 5 * MB)
  })
})

describe("item H — PHP fingindo PNG passa aqui, e isso é correto", () => {
  it("MIME forjado é aceito nesta porta; quem barra é o magic bytes do servidor", () => {
    // Documenta a fronteira de confiança: esta função é UX, não segurança.
    // O arquivo sobe e morre em validateMediaPaths, que lê os bytes reais.
    assert.deepEqual(validatePhotoCandidate({ type: "image/png", size: 1024 }), { ok: true })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Limite de 3 — item D
// ─────────────────────────────────────────────────────────────────────────────

describe("item D — quarta foto bloqueada", () => {
  it("o contrato V0 é 3", () => {
    assert.equal(CARE_MEDIA_MAX_PER_UPDATE, 3)
  })

  it("com 3 selecionadas não cabe mais nenhuma", () => {
    assert.equal(canAddMorePhotos(3), false)
    assert.equal(remainingPhotoSlots(3), 0)
  })

  it("com 0, 1 e 2 ainda cabe", () => {
    assert.equal(canAddMorePhotos(0), true)
    assert.equal(canAddMorePhotos(1), true)
    assert.equal(canAddMorePhotos(2), true)
  })

  it("vagas restantes são exatas", () => {
    assert.equal(remainingPhotoSlots(0), 3)
    assert.equal(remainingPhotoSlots(1), 2)
    assert.equal(remainingPhotoSlots(2), 1)
  })

  it("nunca devolve vaga negativa, mesmo com estado inconsistente", () => {
    assert.equal(remainingPhotoSlots(99), 0)
  })

  it("contador exibe 0/3 … 3/3", () => {
    assert.equal(photoCounterLabel(0), "0/3")
    assert.equal(photoCounterLabel(1), "1/3")
    assert.equal(photoCounterLabel(3), "3/3")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Publicação e erro parcial — itens A, B, C, J
// ─────────────────────────────────────────────────────────────────────────────

describe("item A — texto sem foto publica normalmente", () => {
  it("seleção vazia → pronto, sem paths", () => {
    assert.deepEqual(evaluatePublishReadiness([]), { kind: "pronto", paths: [] })
  })
})

describe("itens B/C — texto com fotos enviadas", () => {
  it("1 foto enviada → pronto com 1 path", () => {
    const r = evaluatePublishReadiness([item({ path: "req/a.jpg" })])
    assert.deepEqual(r, { kind: "pronto", paths: ["req/a.jpg"] })
  })

  it("3 fotos enviadas → pronto com 3 paths, na ordem da seleção", () => {
    const r = evaluatePublishReadiness([
      item({ id: "1", path: "req/a.jpg" }),
      item({ id: "2", path: "req/b.png" }),
      item({ id: "3", path: "req/c.webp" }),
    ])
    assert.deepEqual(r, { kind: "pronto", paths: ["req/a.jpg", "req/b.png", "req/c.webp"] })
  })
})

describe("item J — erro em uma de três NÃO publica as outras duas em silêncio", () => {
  it("uma com erro bloqueia a publicação", () => {
    const r = evaluatePublishReadiness([
      item({ id: "1", path: "req/a.jpg" }),
      item({ id: "2", status: "erro", path: null, errorMessage: PHOTO_COPY.falhaUpload }),
      item({ id: "3", path: "req/c.webp" }),
    ])
    assert.deepEqual(r, { kind: "bloqueado_por_erro", comErro: 1 })
  })

  it("erro tem precedência sobre upload em voo — a decisão humana vem primeiro", () => {
    const r = evaluatePublishReadiness([
      item({ id: "1", status: "enviando", path: null }),
      item({ id: "2", status: "erro", path: null, errorMessage: "x" }),
    ])
    assert.equal(r.kind, "bloqueado_por_erro")
  })

  it("item K — após retry bem-sucedido, volta a poder publicar", () => {
    const depoisDoRetry = evaluatePublishReadiness([
      item({ id: "1", path: "req/a.jpg" }),
      item({ id: "2", path: "req/b.png" }),
      item({ id: "3", path: "req/c.webp" }),
    ])
    assert.deepEqual(depoisDoRetry, {
      kind: "pronto",
      paths: ["req/a.jpg", "req/b.png", "req/c.webp"],
    })
  })

  it("item I — após remover a que falhou, publica só as restantes", () => {
    const depoisDeRemover = evaluatePublishReadiness([
      item({ id: "1", path: "req/a.jpg" }),
      item({ id: "3", path: "req/c.webp" }),
    ])
    assert.deepEqual(depoisDeRemover, { kind: "pronto", paths: ["req/a.jpg", "req/c.webp"] })
  })
})

describe("upload em voo bloqueia publicação", () => {
  it("enviando → aguardando_upload", () => {
    assert.deepEqual(evaluatePublishReadiness([item({ status: "enviando", path: null })]), {
      kind: "aguardando_upload",
    })
  })

  it("foto `pronta` (ainda não enviada) NÃO bloqueia — o fluxo envia antes de publicar", () => {
    const r = evaluatePublishReadiness([item({ status: "pronta", path: null })])
    assert.deepEqual(r, { kind: "pronto", paths: [] })
  })

  it("nunca vaza path nulo para o servidor", () => {
    const r = evaluatePublishReadiness([
      item({ id: "1", status: "enviada", path: null }),
      item({ id: "2", status: "enviada", path: "req/b.png" }),
    ])
    assert.deepEqual(r, { kind: "pronto", paths: ["req/b.png"] })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Rascunho — itens P e Q
// ─────────────────────────────────────────────────────────────────────────────

describe("item P — rascunho recupera texto e categoria", () => {
  it("round-trip preserva os dois campos", () => {
    const original = { content: "Rex almoçou bem.", category: "FEEDING" }
    assert.deepEqual(parseCareUpdateDraft(serializeCareUpdateDraft(original)), original)
  })

  it("a chave é por request — abas diferentes não se misturam", () => {
    assert.notEqual(careUpdateDraftKey("req_1"), careUpdateDraftKey("req_2"))
    assert.match(careUpdateDraftKey("req_1"), /req_1/)
  })
})

describe("item Q — fotos NUNCA entram no rascunho", () => {
  it("o serializado contém apenas content e category", () => {
    const raw = serializeCareUpdateDraft({ content: "texto", category: "NOTE" })
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ["category", "content"])
  })

  it("campos extras são descartados na leitura", () => {
    const comLixo = JSON.stringify({
      content: "texto",
      category: "NOTE",
      mediaPaths: ["req/a.jpg"],
      file: "data:image/png;base64,AAAA",
    })
    assert.deepEqual(parseCareUpdateDraft(comLixo), { content: "texto", category: "NOTE" })
  })

  it("a copy avisa que as fotos precisam ser reselecionadas", () => {
    assert.match(PHOTO_COPY.rascunhoRecuperado, /selecione as fotos novamente/i)
  })
})

describe("rascunho — entradas degeneradas nunca quebram a tela", () => {
  it("null, string vazia e JSON inválido devolvem null", () => {
    assert.equal(parseCareUpdateDraft(null), null)
    assert.equal(parseCareUpdateDraft(""), null)
    assert.equal(parseCareUpdateDraft("{isso não é json"), null)
  })

  it("tipos errados devolvem null", () => {
    assert.equal(parseCareUpdateDraft(JSON.stringify({ content: 42, category: "NOTE" })), null)
    assert.equal(parseCareUpdateDraft(JSON.stringify({ content: "x" })), null)
    assert.equal(parseCareUpdateDraft(JSON.stringify(["a"])), null)
    assert.equal(parseCareUpdateDraft(JSON.stringify(null)), null)
  })

  it("rascunho só de espaços não é rascunho", () => {
    assert.equal(parseCareUpdateDraft(JSON.stringify({ content: "   ", category: "NOTE" })), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Copy — item 13
// ─────────────────────────────────────────────────────────────────────────────

describe("item 13 — nenhuma copy vaza termo técnico", () => {
  it("as mensagens são humanas", () => {
    const proibidos = [
      "STORAGE_FAILURE",
      "storagePath",
      "constraint",
      "token",
      "signedUrl",
      "bucket",
      "undefined",
      "null",
    ]
    for (const [chave, frase] of Object.entries(PHOTO_COPY)) {
      for (const termo of proibidos) {
        assert.ok(
          !frase.toLowerCase().includes(termo.toLowerCase()),
          `PHOTO_COPY.${chave} contém "${termo}": ${frase}`
        )
      }
    }
  })

  it("toda copy termina em frase completa", () => {
    for (const [chave, frase] of Object.entries(PHOTO_COPY)) {
      assert.ok(frase.length > 0, `${chave} vazia`)
      assert.match(frase, /[.!?]$/, `${chave} não termina em pontuação: ${frase}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// VÍDEO — Care Timeline Video V0
// ─────────────────────────────────────────────────────────────────────────────

describe("validateVideoCandidate", () => {
  const ok = { type: "video/mp4", size: 10 * 1024 * 1024, duracaoSegundos: 30 }

  it("aceita MP4 e MOV dentro dos limites", () => {
    assert.equal(validateVideoCandidate(ok).ok, true)
    assert.equal(validateVideoCandidate({ ...ok, type: "video/quicktime" }).ok, true)
  })

  it("recusa WebM com mensagem própria — grava em Android, não toca em iPhone", () => {
    const r = validateVideoCandidate({ ...ok, type: "video/webm" })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, VIDEO_COPY.webm)
  })

  it("recusa acima de 50 MB", () => {
    const r = validateVideoCandidate({ ...ok, size: CARE_VIDEO_MAX_BYTES + 1 })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, VIDEO_COPY.muitoGrande)
  })

  it("aceita exatamente no limite de tamanho", () => {
    assert.equal(validateVideoCandidate({ ...ok, size: CARE_VIDEO_MAX_BYTES }).ok, true)
  })

  it("recusa acima de 60s", () => {
    const r = validateVideoCandidate({ ...ok, duracaoSegundos: CARE_VIDEO_MAX_DURATION_SECONDS + 1 })
    assert.equal(r.ok, false)
    assert.equal(r.ok === false && r.message, VIDEO_COPY.muitoLongo)
  })

  it("aceita exatamente no limite de duração", () => {
    assert.equal(
      validateVideoCandidate({ ...ok, duracaoSegundos: CARE_VIDEO_MAX_DURATION_SECONDS }).ok,
      true
    )
  })

  it("RECUSA quando a duração não pôde ser lida — nunca publica no escuro", () => {
    // O servidor não valida duração (ver comentário da função). Se o cliente
    // também não conseguir, ninguém validou — e aceitar seria fingir que a
    // regra dos 60s existe.
    for (const duracao of [null, NaN, Infinity]) {
      const r = validateVideoCandidate({ ...ok, duracaoSegundos: duracao })
      assert.equal(r.ok, false, `duração ${duracao} deveria recusar`)
      assert.equal(r.ok === false && r.message, VIDEO_COPY.duracaoDesconhecida)
    }
  })

  it("ordem: tipo antes de tamanho e de duração", () => {
    // Um WebM de 200 MB e 5 min deve ouvir "formato não compatível" (acionável:
    // regravar em MP4), não "muito grande" — que levaria a pessoa a comprimir
    // um arquivo que seria recusado do mesmo jeito.
    const r = validateVideoCandidate({
      type: "video/webm",
      size: CARE_VIDEO_MAX_BYTES * 4,
      duracaoSegundos: 300,
    })
    assert.equal(r.ok === false && r.message, VIDEO_COPY.webm)
  })

  it("isVideoMimeType distingue os dois mundos", () => {
    assert.equal(isVideoMimeType("video/mp4"), true)
    assert.equal(isVideoMimeType("image/jpeg"), false)
  })
})

describe("VIDEO_COPY", () => {
  it("nunca vaza termo técnico", () => {
    const proibidos = ["bucket", "storagePath", "mime", "signedUrl", "undefined", "null", "ftyp"]
    for (const [chave, frase] of Object.entries(VIDEO_COPY)) {
      for (const termo of proibidos) {
        assert.ok(
          !frase.toLowerCase().includes(termo.toLowerCase()),
          `VIDEO_COPY.${chave} contém "${termo}": ${frase}`
        )
      }
    }
  })

  it("toda copy termina em frase completa", () => {
    for (const [chave, frase] of Object.entries(VIDEO_COPY)) {
      assert.ok(frase.length > 0, `${chave} vazia`)
      assert.match(frase, /[.!?]$/, `${chave} não termina em pontuação: ${frase}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Limites anunciados — os DOIS, porque os dois valem
//
// Medição dos vídeos reais deste piloto: ~2,1 MB por segundo gravado (17,9
// Mbps, H.264, 1080x1920). Nesse bitrate, 50 MB acabam por volta de 23 s.
// Anunciar só "60 segundos" prometeria algo que a maioria dos aparelhos não
// entrega, e a recusa chegaria como surpresa depois de a pessoa já ter
// gravado. A copy passa a citar os dois tetos; reduzir a duração é decisão de
// produto separada, pendente de QA com aparelhos de bitrates diferentes.
// ─────────────────────────────────────────────────────────────────────────────

describe("CARE_VIDEO_MAX_MB", () => {
  it("deriva do limite em bytes, não é número escrito à mão", () => {
    assert.equal(CARE_VIDEO_MAX_MB, Math.round(CARE_VIDEO_MAX_BYTES / (1024 * 1024)))
  })

  it("vale 50 com o limite atual", () => {
    assert.equal(CARE_VIDEO_MAX_MB, 50)
  })

  it("a mensagem de recusa por tamanho usa a constante", () => {
    assert.match(VIDEO_COPY.muitoGrande, new RegExp(`${CARE_VIDEO_MAX_MB} MB`))
  })

  it("os dois limites são independentes — um vídeo precisa passar em AMBOS", () => {
    // 30 s no bitrate real (~2,1 MB/s) dá ~64 MB: dentro da duração, fora do
    // tamanho. É este caso que a copy de duração sozinha escondia.
    const trintaSegundosNoBitrateReal = Math.round(30 * 2.12 * 1024 * 1024)
    const veredito = validateVideoCandidate({
      type: "video/mp4",
      size: trintaSegundosNoBitrateReal,
      duracaoSegundos: 30,
    })
    assert.equal(veredito.ok, false, "30 s cabe na duração mas estoura o tamanho")
    if (!veredito.ok) {
      assert.equal(veredito.message, VIDEO_COPY.muitoGrande)
      assert.doesNotMatch(veredito.message, /segundos/, "a recusa precisa falar de TAMANHO")
    }
  })

  it("um vídeo curto o bastante passa nos dois", () => {
    const vinteSegundos = Math.round(20 * 2.12 * 1024 * 1024)
    assert.ok(vinteSegundos < CARE_VIDEO_MAX_BYTES)
    const veredito = validateVideoCandidate({
      type: "video/mp4",
      size: vinteSegundos,
      duracaoSegundos: 20,
    })
    assert.equal(veredito.ok, true)
  })
})
