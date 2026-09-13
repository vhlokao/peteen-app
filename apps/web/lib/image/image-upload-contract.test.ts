/**
 * Contrato de FIAÇÃO das superfícies de imagem —
 * PETEEN-IMAGE-UPLOAD-OPTIMIZATION-IMPLEMENTATION-001.
 *
 * Componentes são Client Components e actions são "use server": nenhum dos
 * dois roda em `node --test`. Aqui se trava pelo código-fonte que todas as
 * superfícies passam pela política única e que nenhuma volta a ter regra
 * própria, e que os fluxos críticos (loading do avatar, publicação do Diário)
 * mantêm a ordem que garante segurança e atomicidade.
 *
 * Rodar: npm run test:image
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8")
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "")

const AVATAR_BUTTON = "components/shared/avatar/AvatarUploadButton.tsx"
const PET_FIELD = "modules/pets/components/pet-photo-field.tsx"
const CARE_PICKER = "modules/care-timeline/components/CarePhotoPicker.tsx"
const CARE_ACTIONS = "modules/care-timeline/application/actions.ts"

describe("cliente: as 3 telas de upload preparam a imagem antes de enviar", () => {
  const casos: Array<[string, string]> = [
    [AVATAR_BUTTON, "AVATAR"],
    [PET_FIELD, "PET"],
    [CARE_PICKER, "CARE_PHOTO"],
  ]
  for (const [arquivo, categoria] of casos) {
    const fonte = semComentarios(ler(arquivo))

    it(`${arquivo}: usa prepareImageForUpload("${categoria}") e o accept da política`, () => {
      assert.match(fonte, /from "@\/lib\/image\/prepare-image\.client"/)
      assert.match(fonte, new RegExp(`prepareImageForUpload\\([^)]*"${categoria}"\\)`))
      assert.match(fonte, /IMAGE_ACCEPT_ATTRIBUTE/)
      assert.doesNotMatch(fonte, /accept="image\/\*"/)
    })

    it(`${arquivo}: sem limite, lista de tipos ou mensagem de imagem declarada localmente`, () => {
      assert.doesNotMatch(fonte, /\d+\s*\*\s*1024\s*\*\s*1024/)
      assert.doesNotMatch(fonte, /"image\/jpeg,image\/png,image\/webp"/)
      assert.doesNotMatch(fonte, /HEIC_HEIF_TYPES|UNINFORMATIVE_TYPES|MAX_BYTES\s*=/)
    })

    it(`${arquivo}: nunca importa o processamento de servidor (sharp)`, () => {
      assert.doesNotMatch(fonte, /process-image\.server/)
      assert.doesNotMatch(fonte, /from "sharp"/)
    })
  }

  it("avatar: o arquivo ENVIADO é o preparado, não o original", () => {
    const fonte = semComentarios(ler(AVATAR_BUTTON))
    assert.match(fonte, /formData\.set\("file", preparada\.file\)/)
    assert.doesNotMatch(fonte, /formData\.set\("file", file\)/)
  })

  it("pet: o arquivo ENVIADO é o preparado, não o original", () => {
    const fonte = semComentarios(ler(PET_FIELD))
    assert.match(fonte, /formData\.append\("file", preparada\.file\)/)
    assert.doesNotMatch(fonte, /formData\.append\("file", file\)/)
  })

  it("diário: ticket e upload usam o arquivo preparado", () => {
    const fonte = semComentarios(ler(CARE_PICKER))
    assert.match(fonte, /mimeType: arquivo\.type/)
    assert.match(fonte, /file: arquivo,/)
    assert.match(fonte, /mimeTypeAutorizado: arquivo\.type/)
  })
})

describe("avatar: o carregamento SEMPRE termina", () => {
  const fonte = semComentarios(ler(AVATAR_BUTTON))
  const corpo = fonte.slice(fonte.indexOf("async function handleFileChange"), fonte.indexOf("return (", fonte.indexOf("async function handleFileChange")))

  it("toda a sequência que pode lançar está dentro de try/catch", () => {
    const iTry = corpo.indexOf("try {")
    const iPrep = corpo.indexOf("prepareImageForUpload(")
    const iAction = corpo.indexOf("await uploadAction(")
    const iCatch = corpo.indexOf("} catch")
    assert.ok(iTry >= 0 && iPrep > iTry && iAction > iTry && iCatch > iAction)
  })

  it("todo caminho após 'uploading' define um estado final (error ou success)", () => {
    assert.match(corpo, /setState\("uploading"\)/)
    const saidas = corpo.split(/return\b/).length - 1
    const erros = (corpo.match(/setState\("error"\)/g) ?? []).length
    const sucessos = (corpo.match(/setState\("success"\)/g) ?? []).length
    assert.ok(erros >= 3, "recusa do preparo, recusa da action e exceção precisam terminar em erro")
    assert.equal(sucessos, 1)
    assert.ok(saidas >= 2)
    const blocoCatch = corpo.slice(corpo.indexOf("} catch"))
    assert.match(blocoCatch, /setState\("error"\)/)
    assert.match(blocoCatch, /setError\(IMAGE_MESSAGES\.UPLOAD_FAILED\)/)
  })
})

describe("servidor: avatar e pet gravam só a saída do processamento", () => {
  for (const arquivo of ["lib/storage/avatar-photo.ts", "lib/storage/pet-photo.ts"]) {
    const fonte = semComentarios(ler(arquivo))
    it(`${arquivo}: processPublicPhotoFile antes do upload; extensão e contentType do resultado`, () => {
      const iProc = fonte.indexOf("await processPublicPhotoFile(file,")
      const iUp = fonte.indexOf(".upload(path, foto.body")
      assert.ok(iProc >= 0 && iUp > iProc)
      assert.match(fonte, /const extension = foto\.extension/)
      assert.match(fonte, /contentType: foto\.contentType/)
      assert.match(fonte, /upsert: false/)
      assert.doesNotMatch(fonte, /await file\.arrayBuffer\(\)/)
    })
  }

  it("public-photo: sempre passa por processImageForStorage e sobe JPEG", () => {
    const fonte = semComentarios(ler("lib/storage/public-photo.ts"))
    assert.match(fonte, /await processImageForStorage\(/)
    assert.match(fonte, /new Blob\(\[resultado\.bytes\], \{ type: IMAGE_OUTPUT_MIME \}\)/)
  })

  it("o módulo antigo de re-encode no mesmo formato não existe mais", () => {
    for (const arquivo of ["lib/storage/avatar-photo.ts", "lib/storage/pet-photo.ts", "lib/storage/public-photo.ts"]) {
      assert.doesNotMatch(ler(arquivo), /image-metadata-strip|reencodeWithoutMetadata/)
    }
  })
})

describe("servidor: publicação do Diário", () => {
  const fonte = semComentarios(ler(CARE_ACTIONS))
  const publicar = fonte.slice(fonte.indexOf("export async function publishCareUpdateAction"), fonte.indexOf("export async function getCareTimelineAction"))

  it("fotos passam por finalizeCarePhotos com processImageForStorage CARE_PHOTO e chave nova", () => {
    assert.match(fonte, /await finalizeCarePhotos\(\{ paths: fotos, deps \}\)/)
    assert.match(fonte, /processImageForStorage\(\{ bytes, declaredType, category: "CARE_PHOTO" \}\)/)
    assert.match(fonte, /uploadFinal: \(bytes\) => uploadCareMediaFinalPhoto\(/)
    assert.match(fonte, /storagePath: foto\.finalPath/)
  })

  it("replay da mesma intenção é resolvido ANTES de tocar no Storage", () => {
    const iReplay = publicar.indexOf("findCareUpdateByIdempotencyKey(")
    const iValidar = publicar.indexOf("await validateMediaPaths(")
    assert.ok(iReplay >= 0 && iValidar > iReplay)
  })

  it("transação que lança ou não cria → finais da tentativa removidos; criada → originais descartados", () => {
    const iAtomic = publicar.indexOf("await createCareUpdateAtomic(")
    const trechoCatch = publicar.slice(iAtomic, publicar.indexOf("throw err", iAtomic))
    assert.match(trechoCatch, /discardCarePhotoObjects\(validacao\.finalPhotoPaths, removerFoto\)/)
    assert.match(publicar, /if \(resultado\.kind !== "created"\) \{\s*await discardCarePhotoObjects\(validacao\.finalPhotoPaths, removerFoto\)/)
    const iOriginais = publicar.indexOf("discardCarePhotoObjects(validacao.originalPhotoPaths")
    const iAuditoria = publicar.indexOf("recordCareUpdateAudit(")
    assert.ok(iOriginais > publicar.indexOf('resultado.kind === "replayed"') && iOriginais < iAuditoria)
  })

  it("falha de vídeo depois das fotos processadas também limpa os finais", () => {
    const validar = fonte.slice(fonte.indexOf("async function validateMediaPaths"), fonte.indexOf("async function toCareMediaViews"))
    const recusasDeVideo = validar.slice(validar.indexOf("readCareMediaHeadBytes("))
    const retornos = recusasDeVideo.match(/return \{\s*ok: false/g) ?? []
    const limpezas = recusasDeVideo.match(/await descartarFinais\(\)/g) ?? []
    assert.ok(retornos.length > 0)
    assert.equal(limpezas.length, retornos.length)
  })
})

describe("sharp só no servidor", () => {
  it("nenhum arquivo 'use client' importa sharp ou process-image.server", () => {
    const achados: string[] = []
    const andar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (nome === "node_modules" || nome.startsWith(".")) continue
        const p = path.join(dir, nome)
        if (statSync(p).isDirectory()) andar(p)
        else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) {
          const src = readFileSync(p, "utf8")
          if (/^\s*["']use client["']/.test(src) && /from "[^"]*process-image\.server[^"]*"|from "sharp"/.test(semComentarios(src))) {
            achados.push(path.relative(RAIZ, p))
          }
        }
      }
    }
    for (const raiz of ["app", "components", "modules", "lib"]) andar(path.join(RAIZ, raiz))
    assert.deepEqual(achados, [])
  })
})
