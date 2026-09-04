/**
 * Testes focados — seleção e apresentação dos Momentos do cuidado
 * (GATE-9-CARE-TIMELINE-UX-001).
 *
 * Runner: node:test nativo (mesmo padrão das demais suítes do repo).
 * Rodar: node --experimental-strip-types --test modules/care-timeline/domain/care-moments.test.ts
 *
 * Só funções puras — nenhum acesso a banco, rede, Storage ou React.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  CARE_MOMENTS_MAX,
  careUpdateAnchorId,
  resolveCareMomentCover,
  selectCareMoments,
} from "./care-moments.ts"
import type { CareMediaView, CareUpdate, CareUpdateCategory } from "./types.ts"

function midia(id: string, type: "PHOTO" | "VIDEO"): CareMediaView {
  return {
    id,
    type,
    signedUrl: `https://storage.example/${id}`,
    thumbnailUrl: type === "PHOTO" ? `https://storage.example/${id}?thumb` : null,
    displayUrl: type === "PHOTO" ? `https://storage.example/${id}?display` : null,
    mimeType: type === "PHOTO" ? "image/jpeg" : "video/mp4",
    displayWidth: 1080,
    displayHeight: 1920,
  }
}

function update(
  id: string,
  opcoes: {
    category?: CareUpdateCategory
    occurredAt?: Date
    media?: CareMediaView[]
  } = {}
): CareUpdate {
  const occurredAt = opcoes.occurredAt ?? new Date("2026-09-04T12:00:00Z")
  return {
    id,
    requestId: "req-1",
    petId: "pet-1",
    professionalId: "pro-1",
    authorId: "user-1",
    category: opcoes.category ?? "NOTE",
    content: `Relato da atualização ${id}`,
    occurredAt,
    createdAt: occurredAt,
    editedAt: null,
    media: opcoes.media ?? [],
  }
}

describe("resolveCareMomentCover", () => {
  it("sem mídia → capa de TEXTO (o momento continua legível e útil)", () => {
    assert.deepEqual(resolveCareMomentCover(update("a")), { kind: "TEXT" })
  })

  it("com foto → a foto vira a capa", () => {
    const foto = midia("m1", "PHOTO")
    const cover = resolveCareMomentCover(update("a", { media: [foto] }))
    assert.equal(cover.kind, "PHOTO")
    assert.equal(cover.kind === "PHOTO" ? cover.media.id : null, "m1")
  })

  it("com vídeo → capa de VÍDEO, tipo próprio (não existe miniatura de vídeo neste produto)", () => {
    const video = midia("v1", "VIDEO")
    const cover = resolveCareMomentCover(update("a", { media: [video] }))
    assert.equal(cover.kind, "VIDEO")
    assert.equal(cover.kind === "VIDEO" ? cover.media.id : null, "v1")
  })

  it("foto tem precedência sobre vídeo, independente da ordem do array", () => {
    const video = midia("v1", "VIDEO")
    const foto = midia("m1", "PHOTO")
    // Vídeo primeiro no array: a precedência não pode depender da ordem.
    const cover = resolveCareMomentCover(update("a", { media: [video, foto] }))
    assert.equal(cover.kind, "PHOTO")
  })

  it("usa a PRIMEIRA foto quando há várias", () => {
    const cover = resolveCareMomentCover(
      update("a", { media: [midia("m1", "PHOTO"), midia("m2", "PHOTO")] })
    )
    assert.equal(cover.kind === "PHOTO" ? cover.media.id : null, "m1")
  })
})

describe("selectCareMoments — ordem e recorte", () => {
  it("lista vazia → nenhum momento", () => {
    assert.deepEqual(selectCareMoments([], { isInProgress: true }), [])
  })

  it("preserva a ordem recebida (newest-first) — nunca reordena", () => {
    const entrada = [update("c"), update("b"), update("a")]
    const momentos = selectCareMoments(entrada, { isInProgress: false })
    assert.deepEqual(
      momentos.map((m) => m.update.id),
      ["c", "b", "a"]
    )
  })

  it("recorta no teto, mantendo os MAIS RECENTES (o começo da lista)", () => {
    const entrada = Array.from({ length: CARE_MOMENTS_MAX + 5 }, (_, i) => update(`u${i}`))
    const momentos = selectCareMoments(entrada, { isInProgress: false })
    assert.equal(momentos.length, CARE_MOMENTS_MAX)
    assert.equal(momentos[0]!.update.id, "u0")
    assert.equal(momentos.at(-1)!.update.id, `u${CARE_MOMENTS_MAX - 1}`)
  })

  it("o teto é configurável (a timeline completa nunca é afetada por ele)", () => {
    const entrada = [update("a"), update("b"), update("c")]
    assert.equal(selectCareMoments(entrada, { isInProgress: false, max: 2 }).length, 2)
  })

  it("não muta a lista recebida", () => {
    const entrada = [update("a"), update("b")]
    const copia = [...entrada]
    selectCareMoments(entrada, { isInProgress: true })
    assert.deepEqual(entrada, copia)
  })
})

describe("selectCareMoments — indicação de momento atual", () => {
  it("atendimento em andamento: só o mais recente é 'agora'", () => {
    const momentos = selectCareMoments([update("a"), update("b"), update("c")], {
      isInProgress: true,
    })
    assert.deepEqual(
      momentos.map((m) => m.isCurrent),
      [true, false, false]
    )
  })

  it("atendimento concluído: NENHUM momento é 'agora'", () => {
    const momentos = selectCareMoments([update("a"), update("b")], {
      isInProgress: false,
    })
    assert.deepEqual(
      momentos.map((m) => m.isCurrent),
      [false, false]
    )
  })

  it("um único momento em andamento é o atual", () => {
    const momentos = selectCareMoments([update("a")], { isInProgress: true })
    assert.equal(momentos[0]!.isCurrent, true)
  })
})

describe("careUpdateAnchorId", () => {
  it("deriva um id estável do id da atualização", () => {
    assert.equal(careUpdateAnchorId("abc123"), "care-update-abc123")
  })

  it("ids diferentes produzem âncoras diferentes", () => {
    assert.notEqual(careUpdateAnchorId("a"), careUpdateAnchorId("b"))
  })
})
