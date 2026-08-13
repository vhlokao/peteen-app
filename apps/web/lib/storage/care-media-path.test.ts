/**
 * Testes da lógica de path do bucket `care-media`.
 *
 * O foco é ADVERSARIAL: a maior parte dos casos aqui são tentativas de escapar
 * do formato — traversal, path absoluto, profundidade errada, extensão fora do
 * contrato e, sobretudo, ACESSO CRUZADO entre requests, que é a falha mais
 * grave possível nesta feature (ver a foto do atendimento de outra pessoa).
 *
 * Rodar: npm run test:care-media
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildCareMediaPath,
  careMediaPathBelongsToRequest,
  parseCareMediaPath,
  CARE_MEDIA_MAX_BYTES,
  CARE_MEDIA_MAX_PER_UPDATE,
  CARE_MEDIA_ALLOWED_TYPES,
} from "./care-media-path.ts"

const REQ = "cmsrq9m3w00002ksckjtk406e"
const OUTRA_REQ = "cms29pe3x000004jjjvihjeds"
const FILE = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"

describe("buildCareMediaPath", () => {
  it("monta o formato requests/<requestId>/<fileId>.<ext>", () => {
    assert.equal(
      buildCareMediaPath({ requestId: REQ, fileId: FILE, mimeType: "image/jpeg" }),
      `requests/${REQ}/${FILE}.jpg`
    )
    assert.equal(
      buildCareMediaPath({ requestId: REQ, fileId: FILE, mimeType: "image/png" }),
      `requests/${REQ}/${FILE}.png`
    )
    assert.equal(
      buildCareMediaPath({ requestId: REQ, fileId: FILE, mimeType: "image/webp" }),
      `requests/${REQ}/${FILE}.webp`
    )
  })

  it("recusa requestId com traversal ou separador", () => {
    for (const ruim of ["..", "../etc", "a/b", "a\\b", "", "  ", "a".repeat(65)]) {
      assert.throws(
        () => buildCareMediaPath({ requestId: ruim, fileId: FILE, mimeType: "image/jpeg" }),
        /requestId inválido/,
        `deveria recusar requestId ${JSON.stringify(ruim)}`
      )
    }
  })

  it("recusa fileId com traversal ou separador", () => {
    for (const ruim of ["..", "a/b", "a.b", ""]) {
      assert.throws(
        () => buildCareMediaPath({ requestId: REQ, fileId: ruim, mimeType: "image/jpeg" }),
        /fileId inválido/
      )
    }
  })

  it("recusa chaves herdadas de Object.prototype como mimeType", () => {
    // Acesso indexado direto num objeto literal resolve pela cadeia de
    // protótipos: `M["constructor"]` devolve a função Object, que é truthy e
    // passaria por uma guarda `if (!extensao)`. O path resultante levaria
    // "function Object() { [native code] }" na extensão.
    for (const ruim of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
      assert.throws(
        () => buildCareMediaPath({ requestId: REQ, fileId: FILE, mimeType: ruim as never }),
        /mimeType não suportado/,
        `deveria recusar a chave herdada ${ruim}`
      )
    }
  })

  it("recusa mimeType fora do contrato V0 (inclusive HEIC e vídeo)", () => {
    for (const ruim of ["image/heic", "image/heif", "image/gif", "video/mp4", "application/pdf"]) {
      assert.throws(
        () =>
          buildCareMediaPath({
            requestId: REQ,
            fileId: FILE,
            // cast proposital: simula caller mal-intencionado furando o tipo
            mimeType: ruim as never,
          }),
        /mimeType não suportado/
      )
    }
  })
})

describe("parseCareMediaPath", () => {
  it("aceita um path bem formado e devolve as partes", () => {
    const r = parseCareMediaPath(`requests/${REQ}/${FILE}.jpg`)
    assert.deepEqual(r, { requestId: REQ, fileName: `${FILE}.jpg` })
  })

  it("recusa traversal em qualquer segmento", () => {
    const ataques = [
      `requests/../${REQ}/${FILE}.jpg`,
      `requests/${REQ}/../${FILE}.jpg`,
      `../requests/${REQ}/${FILE}.jpg`,
      `requests/..%2F${REQ}/${FILE}.jpg`,
      `requests/${REQ}/..`,
    ]
    for (const a of ataques) {
      assert.equal(parseCareMediaPath(a), null, `deveria recusar ${a}`)
    }
  })

  it("recusa path absoluto, barra dupla e backslash", () => {
    for (const a of [
      `/requests/${REQ}/${FILE}.jpg`,
      `requests//${REQ}/${FILE}.jpg`,
      `requests\\${REQ}\\${FILE}.jpg`,
      `//requests/${REQ}/${FILE}.jpg`,
    ]) {
      assert.equal(parseCareMediaPath(a), null, `deveria recusar ${a}`)
    }
  })

  it("recusa profundidade diferente de 3 segmentos", () => {
    for (const a of [
      `requests/${REQ}`,
      `${FILE}.jpg`,
      `requests/${REQ}/sub/${FILE}.jpg`,
      `requests/${REQ}/${FILE}.jpg/x`,
    ]) {
      assert.equal(parseCareMediaPath(a), null, `deveria recusar ${a}`)
    }
  })

  it("recusa prefixo diferente de 'requests'", () => {
    for (const a of [`avatars/${REQ}/${FILE}.jpg`, `pets/${REQ}/${FILE}.jpg`, `x/${REQ}/${FILE}.jpg`]) {
      assert.equal(parseCareMediaPath(a), null)
    }
  })

  it("recusa extensão fora do contrato", () => {
    for (const ext of ["heic", "gif", "mp4", "svg", "pdf", "php", "js"]) {
      assert.equal(parseCareMediaPath(`requests/${REQ}/${FILE}.${ext}`), null, `recusar .${ext}`)
    }
  })

  it("recusa entradas não-string sem lançar", () => {
    for (const a of [null, undefined, 42, {}, [], true]) {
      assert.equal(parseCareMediaPath(a), null)
    }
  })
})

describe("careMediaPathBelongsToRequest — acesso cruzado", () => {
  it("aceita apenas o path da própria request", () => {
    const path = `requests/${REQ}/${FILE}.jpg`
    assert.equal(careMediaPathBelongsToRequest(path, REQ), true)
    assert.equal(careMediaPathBelongsToRequest(path, OUTRA_REQ), false)
  })

  it("não aceita requestId que é apenas PREFIXO de outro", () => {
    // A falha clássica de usar startsWith: "req1" casaria "req12".
    const path = `requests/req12/${FILE}.jpg`
    assert.equal(careMediaPathBelongsToRequest(path, "req1"), false)
    assert.equal(careMediaPathBelongsToRequest(path, "req12"), true)
  })

  it("recusa path malformado mesmo quando o requestId aparece dentro dele", () => {
    for (const a of [
      `requests/${OUTRA_REQ}/../${REQ}/${FILE}.jpg`,
      `requests/${OUTRA_REQ}/${REQ}.jpg`,
      `${REQ}`,
    ]) {
      assert.equal(careMediaPathBelongsToRequest(a, REQ), false, `deveria recusar ${a}`)
    }
  })
})

describe("constantes do contrato V0", () => {
  it("espelha 5 MB, 3 arquivos e os 3 formatos aprovados", () => {
    assert.equal(CARE_MEDIA_MAX_BYTES, 5 * 1024 * 1024)
    assert.equal(CARE_MEDIA_MAX_PER_UPDATE, 3)
    assert.deepEqual(CARE_MEDIA_ALLOWED_TYPES.sort(), [
      "image/jpeg",
      "image/png",
      "image/webp",
    ])
  })
})
