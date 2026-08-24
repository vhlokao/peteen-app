/**
 * Origem do Storage para preconnect.
 *
 * O valor daqui vira um hint de rede no browser de todo tutor. Um retorno
 * malformado não quebra a página, mas produz erro de console e um handshake
 * inútil — então a fronteira que importa é: ou uma origem absoluta válida, ou
 * `null`. Nunca algo no meio.
 */

import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"

import { supabaseStorageOrigin } from "./storage-origin.ts"

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL
})

describe("supabaseStorageOrigin", () => {
  it("extrai a origem de uma URL de projeto Supabase", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefgh.supabase.co"
    assert.equal(supabaseStorageOrigin(), "https://abcdefgh.supabase.co")
  })

  it("descarta path, query e barra final — preconnect é por ORIGEM", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefgh.supabase.co/storage/v1/?x=1"
    assert.equal(supabaseStorageOrigin(), "https://abcdefgh.supabase.co")
  })

  it("nunca devolve token nem caminho assinado", () => {
    // Se alguém apontar a env para uma URL assinada inteira, o preconnect
    // continua sendo só o host — credencial não pode vazar para o markup.
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://abcdefgh.supabase.co/storage/v1/object/sign/care-media-video/x.mp4?token=SEGREDO"
    const origem = supabaseStorageOrigin()
    assert.equal(origem, "https://abcdefgh.supabase.co")
    assert.doesNotMatch(origem!, /token|SEGREDO|care-media/)
  })

  it("preserva porta e host customizados (Supabase self-hosted / dev)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    assert.equal(supabaseStorageOrigin(), "http://localhost:54321")
  })

  it("sem variável, devolve null em vez de string vazia", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    assert.equal(supabaseStorageOrigin(), null)
  })

  it("URL inválida devolve null, sem lançar", () => {
    // Derrubar a timeline por causa de um hint de latência seria trocar um
    // problema pequeno por um grande.
    for (const ruim of ["", "   ", "nao-e-url", "//sem-protocolo", "abcdefgh.supabase.co"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ruim
      assert.equal(supabaseStorageOrigin(), null, `deveria recusar: ${JSON.stringify(ruim)}`)
    }
  })

  it("recusa protocolo que não seja http(s)", () => {
    for (const ruim of ["file:///etc/passwd", "data:text/plain,x", "javascript:alert(1)"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ruim
      assert.equal(supabaseStorageOrigin(), null, `deveria recusar: ${ruim}`)
    }
  })
})
