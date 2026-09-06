/**
 * Clientes protegidos para dry-run — GATE-16-DEMO-STABILITY-FIX-002.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE DEU ERRADO
 *
 * O guard de destino (`target-db-guard.mjs`) libera `--dry-run` e imprime
 * "DRY RUN, nada será escrito". Nos seis `demo-cleanup-*` isso era verdade,
 * porque eles já tinham `DRY_RUN` e desviavam de cada escrita.
 *
 * Em `create-seed-users.mjs` e `create-isolated-admin.mjs` não havia desvio
 * nenhum. A ferramenta afirmava segurança e, três linhas depois, chamava
 * `auth.admin.createUser` e `prisma.upsert`. Uma mentira ativa numa ferramenta
 * de escrita é pior que a ausência de proteção: quem lê a mensagem para de
 * verificar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE UM PROXY, E NÃO SÓ UM `if (dryRun)`
 *
 * Branch é acordo de boa vontade: quem escrever a próxima mutação precisa
 * lembrar de checar a flag, e o custo do esquecimento é escrita em banco real.
 * Foi exatamente assim que o defeito nasceu.
 *
 * Aqui o dry-run deixa de depender de disciplina. Em modo dry-run o script NÃO
 * RECEBE um cliente capaz de escrever: recebe um proxy que deixa leitura passar
 * e **lança** em qualquer método de mutação. Uma escrita esquecida vira erro
 * ruidoso — nunca um registro criado em silêncio.
 *
 * Os dois mecanismos convivem de propósito: os scripts têm desvios explícitos
 * (para imprimir o PLANO, que é o que o operador quer ver) e o proxy é a rede
 * embaixo. O teste exercita os dois.
 */

/** Tentativa de escrita durante dry-run. Sempre erro, nunca silêncio. */
export class EscritaEmDryRunError extends Error {
  constructor(operacao) {
    super(
      `Escrita bloqueada: "${operacao}" foi chamada em modo --dry-run. ` +
        `Dry-run não pode alterar nada. Se a intenção era escrever, rode sem --dry-run e com --target=<ref>.`
    )
    this.name = "EscritaEmDryRunError"
    this.operacao = operacao
  }
}

/**
 * Métodos do Prisma que gravam.
 *
 * Lista explícita e não heurística: adivinhar por nome ("tudo que não começa
 * com find") deixaria passar qualquer método novo do Prisma que grave sem se
 * chamar create/update.
 */
const PRISMA_ESCRITA = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "$executeRaw",
  "$executeRawUnsafe",
  "queryRawUnsafe",
  "$queryRawUnsafe",
])

/** Métodos de escrita da Admin API do Supabase Auth. */
const SUPABASE_ESCRITA = new Set([
  "createUser",
  "deleteUser",
  "updateUserById",
  "inviteUserByEmail",
  "generateLink",
])

/**
 * Prisma que recusa gravar.
 *
 * Fora de dry-run devolve o cliente original, sem custo nem indireção.
 *
 * `$transaction` é interceptada porque é a porta pela qual as duas maiores
 * escritas destes scripts passam: dentro dela o callback recebe um `tx`, e esse
 * `tx` também precisa ser protegido — senão o proxy pararia na porta e deixaria
 * tudo passar por dentro.
 */
export function protegerPrisma(prisma, { dryRun }) {
  if (!dryRun) return prisma

  const protegerDelegate = (delegate, nomeModelo) =>
    new Proxy(delegate, {
      get(alvo, prop) {
        if (typeof prop === "string" && PRISMA_ESCRITA.has(prop)) {
          return () => {
            throw new EscritaEmDryRunError(`prisma.${nomeModelo}.${prop}`)
          }
        }
        return Reflect.get(alvo, prop)
      },
    })

  return new Proxy(prisma, {
    get(alvo, prop) {
      if (prop === "$transaction") {
        return async (arg) => {
          if (typeof arg !== "function") {
            throw new EscritaEmDryRunError("prisma.$transaction([...])")
          }
          // Executa o callback com um `tx` igualmente protegido: leituras
          // funcionam, escritas lançam.
          return arg(protegerPrisma(alvo, { dryRun: true }))
        }
      }
      if (typeof prop === "string" && PRISMA_ESCRITA.has(prop)) {
        return () => {
          throw new EscritaEmDryRunError(`prisma.${prop}`)
        }
      }

      const valor = Reflect.get(alvo, prop)
      // Delegates de modelo (`prisma.user`, `prisma.pet`, …) são objetos com os
      // métodos de escrita dentro — precisam ser protegidos um nível abaixo.
      if (
        valor &&
        typeof valor === "object" &&
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        !prop.startsWith("_")
      ) {
        return protegerDelegate(valor, prop)
      }
      return valor
    },
  })
}

/** Cliente admin do Supabase que recusa criar, apagar ou alterar usuário. */
export function protegerSupabaseAdmin(client, { dryRun }) {
  if (!dryRun) return client

  const adminProtegido = new Proxy(client.auth.admin, {
    get(alvo, prop) {
      if (typeof prop === "string" && SUPABASE_ESCRITA.has(prop)) {
        return () => {
          throw new EscritaEmDryRunError(`supabase.auth.admin.${prop}`)
        }
      }
      return Reflect.get(alvo, prop)
    },
  })

  const authProtegido = new Proxy(client.auth, {
    get(alvo, prop) {
      if (prop === "admin") return adminProtegido
      return Reflect.get(alvo, prop)
    },
  })

  return new Proxy(client, {
    get(alvo, prop) {
      if (prop === "auth") return authProtegido
      return Reflect.get(alvo, prop)
    },
  })
}
