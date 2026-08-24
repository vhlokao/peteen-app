/**
 * Regressão do P1 — cross-user avatar overwrite (bucket "avatars").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO PROTEGE
 *
 * O bug real: `professionals/<Prisma User.id>/...` nunca casava com a policy
 * ownership-scoped (`auth.uid()`), e duas policies permissivas — sem checar
 * dono algum — bastavam sozinhas para autorizar qualquer usuário autenticado a
 * escrever ou apagar o avatar de QUALQUER outro, num bucket público. Corrigido
 * no commit 35e521e (código) e confirmado ao vivo por auditoria independente
 * (Supabase real: 3 objetos, 3 referências, zero órfão, zero policy
 * permissiva remanescente, path = auth.uid() em todos).
 *
 * Este arquivo é a garantia de que isso não regride em silêncio. São DOIS
 * tipos de verificação, cada um cobrindo o que o outro não alcança:
 *
 *   1. ESTRUTURAL (código-fonte) — sempre roda, em qualquer máquina, sem
 *      banco. Prova que o CÓDIGO ainda constrói o path certo, a partir da
 *      fonte certa de identidade, pelo caminho certo.
 *   2. LIVE (Supabase real) — só roda com DATABASE_URL/DIRECT_URL disponível
 *      (skip automático, nunca falha por ausência de banco). Prova que a
 *      POLICY DE FATO GRAVADA no Supabase ainda é a que o código pressupõe —
 *      o código pode estar perfeito e a policy, alterada manualmente via
 *      Supabase Studio por engano, poderia divergir sem que teste algum
 *      pegasse isso. Só uma consulta real ao banco fecha esse caminho.
 *
 * NENHUM teste aqui faz escrita — nem no bucket, nem numa tabela, nem contra
 * usuário real. Tudo é leitura: `SELECT` em `pg_policies`/`storage.objects` e
 * `readFileSync` de código-fonte.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ_APP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function ler(relativo: string): string {
  return readFileSync(path.join(RAIZ_APP, relativo), "utf8")
}

/** Remove comentários — o cabeçalho deste próprio arquivo, e os dos que ele
 *  inspeciona, citam os padrões antigos ao explicá-los, o que não pode
 *  reprovar a asserção que busca a ausência deles no código REAL. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ESTRUTURAL — o contrato de path e a fonte da identidade
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_PHOTO = semComentarios(ler("lib/storage/avatar-photo.ts"))

describe("avatar-photo.ts — contrato de path (item 5 e 6)", () => {
  it("o path é construído como `${authId}/${uuid}.${ext}`", () => {
    assert.match(
      AVATAR_PHOTO,
      /const path = `\$\{authId\}\/\$\{crypto\.randomUUID\(\)\}\.\$\{extension\}`/,
      "o primeiro segmento do path precisa ser exatamente o parâmetro authId"
    )
  })

  it("uploadAvatarPhoto recebe authId como parâmetro explícito — nunca deriva sozinho", () => {
    // Se a função passasse a resolver identidade por conta própria (ex.: lendo
    // sessão internamente), o chamador perderia a obrigação de já ter validado
    // ownership do PERFIL antes de subir o arquivo — as duas checagens
    // (ownership do perfil + path do storage) precisam continuar em pontos
    // diferentes e complementares.
    assert.match(
      AVATAR_PHOTO,
      /export async function uploadAvatarPhoto\(file: File, authId: string\)/
    )
  })

  it("NÃO restou nenhuma referência a Prisma User.id/Profile.id compondo o path", () => {
    // O bug inteiro era isto: `professionals/<Prisma User.id>/...`. Qualquer
    // reaparecimento de "professionals/" concatenado a um id de perfil, aqui,
    // é o mesmo bug voltando.
    assert.doesNotMatch(AVATAR_PHOTO, /professionals\/\$\{/)
    assert.doesNotMatch(AVATAR_PHOTO, /profile\.id/i)
    assert.doesNotMatch(AVATAR_PHOTO, /\$\{profileId\}/)
  })

  it("upload não usa upsert — cada objeto é novo, nunca sobrescreve por nome", () => {
    assert.match(AVATAR_PHOTO, /upsert:\s*false/)
  })

  it("a remoção do avatar antigo só acontece via URL persistida no banco, não por path adivinhado", () => {
    // `deleteAvatarByUrl` deriva o path de uma URL que já passou por
    // `isAvatarUrl` — não aceita string livre nem reconstrói path a partir de
    // IDs. Um path "adivinhado" poderia, por engano de implementação futura,
    // apontar para a pasta de outro usuário.
    assert.match(AVATAR_PHOTO, /export async function deleteAvatarByUrl/)
    assert.match(AVATAR_PHOTO, /if \(!isAvatarUrl\(url\)\) return/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. ESTRUTURAL — os dois pontos de upload (item 8)
// ─────────────────────────────────────────────────────────────────────────────

const PROFESSIONAL_ACTIONS = semComentarios(ler("modules/professional/application/actions.ts"))
const TUTOR_ACTIONS = semComentarios(ler("modules/tutor/application/actions.ts"))

describe("pontos de upload — mesmo pipeline canônico, para os dois papéis", () => {
  it("professional importa uploadAvatarPhoto/deleteAvatarByUrl do módulo compartilhado", () => {
    assert.match(PROFESSIONAL_ACTIONS, /from "@\/lib\/storage\/avatar-photo"/)
    assert.match(PROFESSIONAL_ACTIONS, /uploadAvatarPhoto/)
  })

  it("tutor importa uploadAvatarPhoto/deleteAvatarByUrl do MESMO módulo compartilhado", () => {
    // "mesmo" é a palavra que importa: dois módulos DIFERENTES reimplementando
    // a mesma lógica é exatamente o tipo de divergência silenciosa que este
    // arquivo existe para impedir — um dos dois poderia reintroduzir o bug
    // enquanto o outro continua correto.
    assert.match(TUTOR_ACTIONS, /from "@\/lib\/storage\/avatar-photo"/)
    assert.match(TUTOR_ACTIONS, /uploadAvatarPhoto/)
  })

  it("nenhum dos dois reimplementa upload direto ao Storage por conta própria", () => {
    // Um `.storage.from(` fora de avatar-photo.ts, em qualquer um dos dois
    // arquivos de action, seria um segundo caminho de escrita não coberto por
    // este teste de contrato — a garantia do path certo vale só para quem
    // passa por `uploadAvatarPhoto`.
    assert.doesNotMatch(PROFESSIONAL_ACTIONS, /\.storage\.from\(/)
    assert.doesNotMatch(TUTOR_ACTIONS, /\.storage\.from\(/)
  })

  it("as duas actions verificam ownership do PERFIL antes de chamar o upload", () => {
    // Defesa em profundidade: mesmo que a policy de Storage um dia enfraqueça,
    // esta checagem sozinha já impede A de gravar no perfil de B — o servidor
    // nunca tenta subir o arquivo se o dono não bate.
    assert.match(PROFESSIONAL_ACTIONS, /profile\.userId !== session\.id/)
    assert.match(TUTOR_ACTIONS, /profile\.userId !== session\.id/)
  })

  it("authId vem da sessão resolvida no servidor, nunca de entrada do formulário", () => {
    // `session.authId` — não `formData.get("authId")`, não um parâmetro da
    // action. Se um dia alguém aceitar authId vindo do cliente, a policy
    // continua funcionando tecnicamente (ela casa o path informado), mas
    // deixa de significar OWNERSHIP — passaria a autorizar quem quer que o
    // cliente diga que é.
    for (const [nome, fonte] of [
      ["professional", PROFESSIONAL_ACTIONS],
      ["tutor", TUTOR_ACTIONS],
    ] as const) {
      assert.match(
        fonte,
        /uploadAvatarPhoto\(file, session\.authId\)/,
        `${nome}: authId precisa vir de session.authId`
      )
      assert.doesNotMatch(
        fonte,
        /uploadAvatarPhoto\(file,\s*(formData|input|params)\./,
        `${nome}: authId não pode vir de entrada controlada pelo cliente`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. ESTRUTURAL — o componente de UI não tem acesso direto ao Storage
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_BUTTON = semComentarios(ler("components/shared/avatar/AvatarUploadButton.tsx"))

describe("AvatarUploadButton — compartilhado, sem storage no cliente", () => {
  it("o componente não importa cliente do Supabase nem chama .storage.", () => {
    // Todo o ownership é resolvido no SERVIDOR. Um componente client-side com
    // acesso a `.storage.from()` reabriria exatamente a classe de bug original
    // — upload direto do browser, sem passar pela Server Action que checa
    // sessão e perfil.
    assert.doesNotMatch(UPLOAD_BUTTON, /createSupabaseBrowserClient/)
    assert.doesNotMatch(UPLOAD_BUTTON, /\.storage\.from\(/)
  })

  it("recebe a Server Action como prop — não a importa fixa para um papel só", () => {
    assert.match(UPLOAD_BUTTON, /uploadAction:/)
  })

  it("é o MESMO arquivo usado por profissional e tutor", () => {
    for (const consumidor of [
      "modules/professional/components/professional-profile-edit-form.tsx",
      "modules/tutor/components/tutor-profile-edit-form.tsx",
    ]) {
      const fonte = ler(consumidor)
      assert.match(
        fonte,
        /from "@\/components\/shared\/avatar\/AvatarUploadButton"/,
        `${consumidor} precisa importar o componente compartilhado`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVE — as policies de fato gravadas no Supabase
//
// Skip automático sem banco disponível: nunca falha um `npm test` numa
// máquina sem `.env.local`, mas prova o estado REAL sempre que há conexão.
// ─────────────────────────────────────────────────────────────────────────────

function stringDeConexao(): string | null {
  for (const chave of ["DIRECT_URL", "DATABASE_URL"]) {
    if (process.env[chave]) return process.env[chave]!
  }
  for (const arquivo of [".env.local", ".env"]) {
    try {
      const conteudo = readFileSync(path.join(RAIZ_APP, arquivo), "utf8")
      for (const chave of ["DIRECT_URL", "DATABASE_URL"]) {
        const achado = new RegExp(`^${chave}=(.+)$`, "m").exec(conteudo)
        if (achado?.[1]) return achado[1].trim().replace(/^["']|["']$/g, "")
      }
    } catch {
      // arquivo ausente — tenta o próximo
    }
  }
  return null
}

type PolicyRow = {
  policyname: string
  cmd: string
  roles: string[]
  qual: string | null
  with_check: string | null
}

async function lerPoliciesDeAvatars(connectionString: string): Promise<PolicyRow[]> {
  const { Pool } = await import("pg")
  const pool = new Pool({ connectionString })
  try {
    const { rows } = await pool.query<PolicyRow>(
      `SELECT policyname, cmd, roles, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'
         AND (qual ILIKE '%avatars%' OR with_check ILIKE '%avatars%')
       ORDER BY policyname`
    )
    return rows
  } finally {
    await pool.end()
  }
}

async function contarObjetosOrfaosOuForaDoPadrao(
  connectionString: string
): Promise<{ totalObjetos: number; foraDoPadrao: number }> {
  const { Pool } = await import("pg")
  const pool = new Pool({ connectionString })
  try {
    const total = await pool.query<{ n: string }>(
      `SELECT count(*)::text as n FROM storage.objects WHERE bucket_id = 'avatars'`
    )
    // Um UUID v4 de auth.users como primeiro segmento — qualquer objeto cujo
    // path não comece assim está fora do contrato (path antigo, ou nome
    // inesperado).
    const foraDoPadrao = await pool.query<{ n: string }>(
      `SELECT count(*)::text as n FROM storage.objects
       WHERE bucket_id = 'avatars'
         AND (storage.foldername(name))[1] !~ '^[0-9a-fA-F-]{36}$'`
    )
    return {
      totalObjetos: Number(total.rows[0]!.n),
      foraDoPadrao: Number(foraDoPadrao.rows[0]!.n),
    }
  } finally {
    await pool.end()
  }
}

const conexao = stringDeConexao()

/**
 * `npm run test:avatar` (uso comum, dev sem banco à mão) faz SKIP silencioso
 * sem credenciais — é o comportamento certo para não quebrar `npm test` numa
 * máquina sem `.env.local`.
 *
 * `npm run test:avatar:live` (gate manual de release) define esta variável e
 * PROÍBE o skip: rodar esse comando sem prova viva contra o Supabase real não
 * pode voltar "verde" por omissão — teria o mesmo efeito prático de nunca ter
 * rodado o gate, só que parecendo que rodou.
 */
export function exigirConexaoSeObrigatorio(obrigatorio: boolean, conexao: string | null): void {
  if (obrigatorio && !conexao) {
    throw new Error(
      "[test:avatar:live] DATABASE_URL/DIRECT_URL ausente. Este comando é o gate manual de release " +
        "e não pode fazer skip silencioso — configure .env.local ou rode `npm run test:avatar`, que " +
        "tolera a ausência de banco."
    )
  }
}

describe("exigirConexaoSeObrigatorio", () => {
  it("obrigatório sem conexão: lança", () => {
    assert.throws(() => exigirConexaoSeObrigatorio(true, null))
  })

  it("obrigatório com conexão: não lança", () => {
    assert.doesNotThrow(() => exigirConexaoSeObrigatorio(true, "postgres://x"))
  })

  it("não obrigatório, sem conexão: não lança — é o caminho do skip normal", () => {
    assert.doesNotThrow(() => exigirConexaoSeObrigatorio(false, null))
  })
})

// A checagem em SI é um `it()`, não um throw solto no nível do módulo: um
// throw fora de teste vira "uncaughtException" no relatório do node:test —
// funciona (sai != 0), mas se mistura com erro de infraestrutura de verdade.
// Como teste, a falha aparece como reprovação normal, com a mensagem clara.
it("test:avatar:live exige banco disponível — não pode voltar verde por omissão", () => {
  exigirConexaoSeObrigatorio(process.env.AVATAR_LIVE_REQUIRED === "1", conexao)
})

describe("policies live no Supabase — bucket avatars", { skip: conexao ? false : "sem DATABASE_URL/DIRECT_URL" }, () => {
  const url = conexao as string

  it("existe exatamente UMA policy de INSERT, e ela exige ownership (item 1, 4, 7)", async () => {
    const policies = await lerPoliciesDeAvatars(url)
    const inserts = policies.filter((p) => p.cmd === "INSERT")
    assert.equal(
      inserts.length,
      1,
      `esperada 1 policy de INSERT para avatars, encontrada(s) ${inserts.length}: ${inserts.map((p) => p.policyname).join(", ")} — mais de uma combina por OR e reabre o furo`
    )
    const check = inserts[0]!.with_check ?? ""
    assert.match(check, /storage\.foldername\(name\)/, "precisa checar o primeiro segmento do path")
    assert.match(check, /auth\.uid\(\)/, "precisa comparar contra auth.uid()")
    assert.match(check, /auth\.role\(\)\s*=\s*'authenticated'/, "precisa exigir usuário autenticado")
  })

  it("existe exatamente UMA policy de UPDATE, e ela exige ownership (item 2, 4)", async () => {
    const policies = await lerPoliciesDeAvatars(url)
    const updates = policies.filter((p) => p.cmd === "UPDATE")
    assert.equal(updates.length, 1, `esperada 1 policy de UPDATE, encontrada(s) ${updates.length}`)
    const using = updates[0]!.qual ?? ""
    assert.match(using, /storage\.foldername\(name\)/)
    assert.match(using, /auth\.uid\(\)/)
  })

  it("existe exatamente UMA policy de DELETE, e ela exige ownership (item 3, 4)", async () => {
    const policies = await lerPoliciesDeAvatars(url)
    const deletes = policies.filter((p) => p.cmd === "DELETE")
    assert.equal(deletes.length, 1, `esperada 1 policy de DELETE, encontrada(s) ${deletes.length}`)
    const using = deletes[0]!.qual ?? ""
    assert.match(using, /storage\.foldername\(name\)/)
    assert.match(using, /auth\.uid\(\)/)
  })

  it("nenhuma policy de escrita permite bucket_id='avatars' sem também checar auth.uid() (item 4, 7)", async () => {
    // Esta é a asserção que teria pego o bug original: uma policy permissiva
    // extra em INSERT/UPDATE/DELETE, mesmo que a "boa" também exista — RLS
    // combina múltiplas policies do MESMO comando por OR, então uma única
    // policy fraca já é suficiente para o furo, não importa quantas fortes
    // existam ao lado dela.
    const policies = await lerPoliciesDeAvatars(url)
    const escritas = policies.filter((p) => p.cmd !== "SELECT")
    for (const p of escritas) {
      const expressao = `${p.qual ?? ""} ${p.with_check ?? ""}`
      assert.match(
        expressao,
        /auth\.uid\(\)/,
        `policy "${p.policyname}" (${p.cmd}) não checa auth.uid() — writer sem ownership`
      )
    }
  })

  it("nenhuma escrita é alcançável sem sessão — anônimo nunca escreve (item 7)", async () => {
    // `roles = {public}` numa policy do Supabase NÃO significa "acesso
    // anônimo liberado" — é o slot padrão de `CREATE POLICY` sem `TO <role>`,
    // e TODAS as policies de avatars (inclusive as corretas) o usam. A
    // restrição real mora na EXPRESSÃO: `auth.role() = 'authenticated'`. Testar
    // a coluna `roles` sozinha teria acusado as próprias policies boas como se
    // fossem o furo — o teste certo é sobre o texto da condição, não sobre a
    // lista de roles.
    const policies = await lerPoliciesDeAvatars(url)
    const escritas = policies.filter((p) => p.cmd !== "SELECT")
    assert.ok(escritas.length > 0, "esperada ao menos uma policy de escrita para inspecionar")
    for (const p of escritas) {
      const expressao = `${p.qual ?? ""} ${p.with_check ?? ""}`
      assert.match(
        expressao,
        /auth\.role\(\)\s*=\s*'authenticated'/,
        `policy "${p.policyname}" (${p.cmd}) não exige authenticated na expressão — anônimo alcançaria escrita`
      )
    }
  })

  it("todo objeto do bucket está sob um dono no formato auth.uid() — zero path no formato antigo (item 6)", async () => {
    const { totalObjetos, foraDoPadrao } = await contarObjetosOrfaosOuForaDoPadrao(url)
    assert.equal(
      foraDoPadrao,
      0,
      `${foraDoPadrao} de ${totalObjetos} objetos em avatars têm primeiro segmento fora do formato de auth.uid() — possível regressão para path por Prisma id`
    )
  })
})
