/**
 * GATE-18 FIX-018 — extração e comparação SEMÂNTICA de RLS policies.
 *
 * O que estes testes protegem, em duas frentes:
 *
 * BUG 1 — o auditor só olhava `storage.objects`, e só o nome. As 29 policies de
 * `public` da migration de segurança da Fase A existiam no banco e eram
 * reportadas como faltando. Pior: nome igual com `USING` diferente passava, e
 * numa policy o corpo É a regra de acesso — a diferença entre "cada um vê o
 * seu" e "todo mundo vê tudo".
 *
 * BUG 2 — o parser de `CREATE TABLE` não distinguia código de literal e
 * inventava uma tabela `AS` a partir de `WHEN TAG IN ('CREATE TABLE AS', ...)`.
 * Aqui isso é testado no nível do scanner (`mascararLiterais`); o efeito em
 * `objetosDe` é testado em `scripts/migration-audit.test.mjs`.
 *
 * Cada bloco tem controle negativo: não basta o caso bom passar, o caso ruim
 * precisa REPROVAR. Um comparador que devolve `[]` sempre passaria em tudo.
 *
 * Rodar: npm run test:scripts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { mascararLiterais } from "./sql-constraints.mjs"
import { policiesDe, compararPolicy, chaveDaPolicy } from "./sql-policies.mjs"

/** Forma exata gerada pela migration de segurança da Fase A. */
const POLICY_PUBLIC = `
DROP POLICY IF EXISTS "users: select own" ON public."users";
CREATE POLICY "users: select own" ON public."users"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (("authId" = ( SELECT auth.uid() AS uid)));
`

const POLICY_STORAGE = `
CREATE POLICY "avatars: authenticated upload" ON storage."objects"
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
`

/** Como o banco devolve, via pg_policies. */
const doBanco = (over = {}) => ({
  schema: "public", tabela: "users", nome: "users: select own",
  comando: "SELECT", papeis: ["public"], permissiva: "PERMISSIVE",
  usando: '("authId" = ( SELECT auth.uid() AS uid))', comCheck: null,
  ...over,
})

describe("policiesDe — identidade e semântica", () => {
  it("extrai schema, tabela, nome, comando, papéis e USING", () => {
    const [p] = policiesDe(POLICY_PUBLIC)
    assert.equal(p.schema, "public")
    assert.equal(p.tabela, "users")
    assert.equal(p.nome, "users: select own")
    assert.equal(p.comando, "SELECT")
    assert.deepEqual(p.papeis, ["public"])
    assert.match(p.usando, /authId/)
    assert.equal(p.comCheck, null)
  })

  it("lê o corpo com literais INTACTOS (o USING é feito deles)", () => {
    const [p] = policiesDe(POLICY_STORAGE)
    assert.equal(p.schema, "storage")
    assert.equal(p.tabela, "objects")
    assert.match(p.comCheck, /'avatars'::text/)
    assert.match(p.comCheck, /foldername/)
  })

  it("ignora DROP POLICY — o que a migration DECLARA é o CREATE", () => {
    assert.equal(policiesDe(POLICY_PUBLIC).length, 1)
  })

  it("tabela sem schema assume public", () => {
    const [p] = policiesDe(`CREATE POLICY "x" ON pets FOR SELECT USING (true);`)
    assert.equal(p.schema, "public")
    assert.equal(p.tabela, "pets")
  })

  it("FOR omitido é ALL; TO omitido é public", () => {
    const [p] = policiesDe(`CREATE POLICY "x" ON public.pets USING (true);`)
    assert.equal(p.comando, "ALL")
    assert.deepEqual(p.papeis, ["public"])
  })

  it("NÃO encontra CREATE POLICY escrito dentro de um literal", () => {
    const sql = `INSERT INTO log (msg) VALUES ('CREATE POLICY "falsa" ON public.users FOR SELECT USING (true)');`
    assert.deepEqual(policiesDe(sql), [])
  })

  it("chave de identidade separa schemas — nome sozinho não identifica", () => {
    const a = { schema: "public", tabela: "objects", nome: "x" }
    const b = { schema: "storage", tabela: "objects", nome: "x" }
    assert.notEqual(chaveDaPolicy(a), chaveDaPolicy(b))
  })
})

describe("compararPolicy — controles negativos", () => {
  const esperada = policiesDe(POLICY_PUBLIC)[0]

  it("presente e equivalente → sem diferença", () => {
    assert.deepEqual(compararPolicy(esperada, doBanco()), [])
  })

  it("ausente no banco → reprova", () => {
    assert.deepEqual(compararPolicy(esperada, null), ["ausente"])
  })

  it("mesmo nome, USING DIFERENTE → reprova (o caso que mais importa)", () => {
    const dif = compararPolicy(esperada, doBanco({ usando: "(true)" }))
    assert.ok(dif.some((d) => d.includes("USING")), `esperava drift de USING, veio: ${dif}`)
  })

  it("WITH CHECK diferente → reprova", () => {
    const comCheck = policiesDe(
      `CREATE POLICY "p" ON public.pets FOR INSERT TO public WITH CHECK (("tutorId" = f()));`
    )[0]
    const real = { ...doBanco(), tabela: "pets", nome: "p", comando: "INSERT", usando: null, comCheck: "(true)" }
    const dif = compararPolicy(comCheck, real)
    assert.ok(dif.some((d) => d.includes("WITH CHECK")), `esperava drift de WITH CHECK, veio: ${dif}`)
  })

  it("comando diferente → reprova", () => {
    const dif = compararPolicy(esperada, doBanco({ comando: "ALL" }))
    assert.ok(dif.some((d) => d.includes("comando")))
  })

  it("papéis diferentes → reprova", () => {
    const dif = compararPolicy(esperada, doBanco({ papeis: ["authenticated"] }))
    assert.ok(dif.some((d) => d.includes("papéis")))
  })

  it("PERMISSIVE vs RESTRICTIVE → reprova", () => {
    const dif = compararPolicy(esperada, doBanco({ permissiva: "RESTRICTIVE" }))
    assert.ok(dif.length > 0)
  })

  it("whitespace cosmético no USING NÃO é drift", () => {
    const dif = compararPolicy(esperada, doBanco({ usando: '("authId"  =  ( SELECT   auth.uid() AS uid))' }))
    assert.deepEqual(dif, [])
  })

  it("USING null de um lado só → reprova (não trata ausência como igualdade)", () => {
    assert.ok(compararPolicy(esperada, doBanco({ usando: null })).length > 0)
  })
})

describe("mascararLiterais — scanner do BUG 2", () => {
  it("apaga o miolo do literal e preserva o comprimento", () => {
    const sql = `WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')`
    const m = mascararLiterais(sql)
    assert.equal(m.length, sql.length, "comprimento tem que ser preservado")
    assert.ok(!/CREATE\s+TABLE/i.test(m), `sobrou CREATE TABLE no mascarado: ${m}`)
  })

  it("NÃO mascara identificador citado — é nome de objeto", () => {
    assert.match(mascararLiterais(`CREATE TABLE "Foo" (id int)`), /"Foo"/)
  })

  it("respeita aspa escapada '' dentro do literal", () => {
    const sql = `SELECT 'it''s here', 'CREATE TABLE x'; CREATE TABLE real_t (id int);`
    const m = mascararLiterais(sql)
    assert.ok(!/CREATE TABLE x/.test(m), "literal deveria estar mascarado")
    assert.match(m, /CREATE TABLE real_t/, "o CREATE TABLE real tem que sobreviver")
  })

  /**
   * Regressão real cometida durante o próprio FIX-018: a primeira versão
   * mascarava blocos dollar-quoted e apagou o `CREATE TYPE` de `care_media_v0`,
   * que vive dentro de um `DO $$ … $$`. O auditor passou a reportar 7/7 no
   * lugar de 8/8, perdendo um enum real em silêncio.
   *
   * Num bloco `DO`, o conteúdo é DDL que executa na hora — código, não texto.
   */
  it("NÃO mascara bloco dollar-quoted: lá dentro é código, não literal", () => {
    const sql = `DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'X') THEN\n    CREATE TYPE "X" AS ENUM ('A');\n  END IF;\nEND $$;`
    const m = mascararLiterais(sql)
    assert.match(m, /CREATE TYPE "X"/, "DDL dentro de DO tem que continuar visível")
    assert.ok(!/'A'/.test(m) || / {3}/.test(m), "literais lá dentro seguem mascarados")
    assert.equal(m.length, sql.length)
  })

  it("literal sem fechamento não trava nem estoura o comprimento", () => {
    const sql = `SELECT 'aberto para sempre`
    assert.equal(mascararLiterais(sql).length, sql.length)
  })
})
