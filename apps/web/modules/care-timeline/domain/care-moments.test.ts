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
  clampMomentIndex,
  momentPositionLabel,
  neighborPreloadIndexes,
  nextMomentIndex,
  previousMomentIndex,
  resolveCareMomentCover,
  resolveCareMomentMedia,
  selectCareMoments,
  MOMENT_VISUAL_DURATION_MS,
  clampProgressFraction,
  segmentFill,
  videoProgressFraction,
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

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZADOR IMERSIVO — GATE-9-CARE-TIMELINE-UX-REFINE-002
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCareMomentMedia", () => {
  it("sem mídia → nenhuma foto e nenhum vídeo", () => {
    assert.deepEqual(resolveCareMomentMedia(update("a")), { photos: [], video: null })
  })

  it("devolve TODAS as fotos, não só a capa — nada da atualização some no viewer", () => {
    const m = resolveCareMomentMedia(
      update("a", { media: [midia("m1", "PHOTO"), midia("m2", "PHOTO"), midia("m3", "PHOTO")] })
    )
    assert.deepEqual(m.photos.map((p) => p.id), ["m1", "m2", "m3"])
    assert.equal(m.video, null)
  })

  it("separa vídeo das fotos — superfícies diferentes, contratos de rede diferentes", () => {
    const m = resolveCareMomentMedia(
      update("a", { media: [midia("v1", "VIDEO"), midia("m1", "PHOTO")] })
    )
    assert.deepEqual(m.photos.map((p) => p.id), ["m1"])
    assert.equal(m.video?.id, "v1")
  })
})

describe("nextMomentIndex / previousMomentIndex — limites sem dar a volta", () => {
  it("navega para frente dentro da lista", () => {
    assert.equal(nextMomentIndex(0, 3), 1)
    assert.equal(nextMomentIndex(1, 3), 2)
  })

  it("ÚLTIMO momento: não há próximo (null, não volta ao primeiro)", () => {
    assert.equal(nextMomentIndex(2, 3), null)
  })

  it("navega para trás dentro da lista", () => {
    assert.equal(previousMomentIndex(2, 3), 1)
    assert.equal(previousMomentIndex(1, 3), 0)
  })

  it("PRIMEIRO momento: não há anterior (null, não pula para o último)", () => {
    assert.equal(previousMomentIndex(0, 3), null)
  })

  it("um único momento: nem anterior nem próximo", () => {
    assert.equal(nextMomentIndex(0, 1), null)
    assert.equal(previousMomentIndex(0, 1), null)
  })

  it("lista vazia nunca produz índice", () => {
    assert.equal(nextMomentIndex(0, 0), null)
    assert.equal(previousMomentIndex(0, 0), null)
  })
})

describe("clampMomentIndex — abrir num índice específico com segurança", () => {
  it("índice válido passa intacto (abrir exatamente no momento tocado)", () => {
    assert.equal(clampMomentIndex(0, 5), 0)
    assert.equal(clampMomentIndex(3, 5), 3)
    assert.equal(clampMomentIndex(4, 5), 4)
  })

  it("índice além do fim cai no último — a lista pode ENCOLHER com o auto-refresh", () => {
    assert.equal(clampMomentIndex(9, 3), 2)
  })

  it("índice negativo cai no primeiro", () => {
    assert.equal(clampMomentIndex(-2, 3), 0)
  })

  it("lista vazia → null (não há momento para abrir)", () => {
    assert.equal(clampMomentIndex(0, 0), null)
  })
})

describe("neighborPreloadIndexes — só os vizinhos imediatos", () => {
  it("no meio da lista, pré-carrega anterior e próximo", () => {
    assert.deepEqual(neighborPreloadIndexes(2, 5), [1, 3])
  })

  it("no primeiro, só o próximo", () => {
    assert.deepEqual(neighborPreloadIndexes(0, 5), [1])
  })

  it("no último, só o anterior", () => {
    assert.deepEqual(neighborPreloadIndexes(4, 5), [3])
  })

  it("com um único momento, nada a pré-carregar", () => {
    assert.deepEqual(neighborPreloadIndexes(0, 1), [])
  })

  it("nunca pré-carrega a lista inteira — no máximo 2, independente do tamanho", () => {
    assert.equal(neighborPreloadIndexes(10, 50).length, 2)
  })
})

describe("momentPositionLabel", () => {
  it("conta a partir de 1, como a pessoa lê", () => {
    assert.equal(momentPositionLabel(0, 8), "1 de 8")
    assert.equal(momentPositionLabel(7, 8), "8 de 8")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSO DOS SEGMENTOS — GATE-9-CARE-TIMELINE-UX-REFINE-005
// ─────────────────────────────────────────────────────────────────────────────

describe("clampProgressFraction", () => {
  it("mantém frações válidas", () => {
    assert.equal(clampProgressFraction(0.5), 0.5)
  })

  it("trava nos limites 0 e 1", () => {
    assert.equal(clampProgressFraction(-3), 0)
    assert.equal(clampProgressFraction(0), 0)
    assert.equal(clampProgressFraction(1), 1)
    assert.equal(clampProgressFraction(9), 1)
  })

  it("NaN e Infinity viram 0 — a barra nunca inventa progresso", () => {
    assert.equal(clampProgressFraction(Number.NaN), 0)
    assert.equal(clampProgressFraction(Number.POSITIVE_INFINITY), 0)
  })
})

describe("videoProgressFraction — a barra é dirigida pelo próprio vídeo", () => {
  it("calcula currentTime / duration", () => {
    assert.equal(videoProgressFraction(3, 12), 0.25)
    assert.equal(videoProgressFraction(6, 12), 0.5)
  })

  it("duration NaN (metadados ainda não chegaram) → 0, não finge progresso", () => {
    assert.equal(videoProgressFraction(2, Number.NaN), 0)
  })

  it("duration 0 ou Infinity → 0", () => {
    assert.equal(videoProgressFraction(2, 0), 0)
    assert.equal(videoProgressFraction(2, Number.POSITIVE_INFINITY), 0)
  })

  it("currentTime além da duração satura em 1, sem passar", () => {
    assert.equal(videoProgressFraction(20, 12), 1)
  })

  it("início do vídeo é 0", () => {
    assert.equal(videoProgressFraction(0, 12), 0)
  })
})

describe("segmentFill — anteriores cheios, atual em progresso, seguintes vazios", () => {
  it("segmentos anteriores ficam 100%", () => {
    assert.equal(segmentFill(0, 2, 0.3), 1)
    assert.equal(segmentFill(1, 2, 0.3), 1)
  })

  it("o segmento atual reflete o progresso real", () => {
    assert.equal(segmentFill(2, 2, 0.42), 0.42)
  })

  it("segmentos seguintes ficam vazios", () => {
    assert.equal(segmentFill(3, 2, 0.9), 0)
    assert.equal(segmentFill(9, 2, 0.9), 0)
  })

  it("no primeiro Momento, nada atrás está preenchido", () => {
    assert.equal(segmentFill(0, 0, 0), 0)
    assert.equal(segmentFill(1, 0, 0.5), 0)
  })

  it("no último Momento, todos os anteriores estão cheios", () => {
    assert.equal(segmentFill(0, 3, 1), 1)
    assert.equal(segmentFill(2, 3, 1), 1)
    assert.equal(segmentFill(3, 3, 1), 1)
  })

  it("o atual também respeita os limites 0/1", () => {
    assert.equal(segmentFill(1, 1, -2), 0)
    assert.equal(segmentFill(1, 1, 5), 1)
    assert.equal(segmentFill(1, 1, Number.NaN), 0)
  })
})

describe("MOMENT_VISUAL_DURATION_MS", () => {
  it("é uma duração de leitura calma, não um cronômetro apertado", () => {
    assert.ok(MOMENT_VISUAL_DURATION_MS >= 5000)
    assert.ok(MOMENT_VISUAL_DURATION_MS <= 12000)
  })
})
