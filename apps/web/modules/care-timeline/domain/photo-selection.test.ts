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
