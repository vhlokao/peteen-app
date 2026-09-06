/**
 * Identidade de ambiente do Peteen — GATE-16-DEMO-ENV-FOUNDATION-003.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE `VERCEL_ENV` NÃO BASTA MAIS
 *
 * Até aqui, "em que ambiente estou?" era respondido só por `VERCEL_ENV`
 * (`production` | `preview` | `development`), e isso bastava porque existia um
 * único projeto Vercel.
 *
 * Com um projeto Vercel dedicado ao DEMO, essa resposta passa a mentir: **o
 * deploy de produção do projeto DEMO também recebe `VERCEL_ENV=production`.**
 * Os dois ambientes ficam indistinguíveis pelo eixo da plataforma, e a
 * consequência mais cara é no push — um sender que se acha "produção" fica
 * elegível a tentar entregar em subscriptions legadas de usuários reais.
 *
 * `VERCEL_ENV` continua respondendo o que sempre respondeu: em que ESTÁGIO da
 * plataforma este deploy está. `PETEEN_ENV` responde outra pergunta, que é a de
 * negócio: de qual Peteen este deploy é.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPATIBILIDADE: A AUSÊNCIA É SIGNIFICATIVA
 *
 * Produção hoje NÃO tem `PETEEN_ENV` definida, e não pode quebrar por isso. Por
 * isso a ausência preserva exatamente o comportamento anterior: cai no mapa de
 * `VERCEL_ENV`. Só a PRESENÇA da variável muda alguma coisa — e ela só vai
 * existir onde alguém a definir de propósito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VALOR DESCONHECIDO FALHA PARA BAIXO, NUNCA PARA PRODUCTION
 *
 * `PETEEN_ENV="Demo"`, `"prod"`, `"staging"` ou qualquer typo resolve como
 * `development` — o estágio mais restritivo — e registra erro.
 *
 * A troca é assimétrica e foi escolhida de olhos abertos: um typo em produção
 * faz o push de produção parar, o que é visível, reclamável e reversível em um
 * deploy. Um typo que resolvesse para `production` faria o DEMO acordar o
 * telefone de usuários reais — silencioso, e impossível de desfazer depois de
 * entregue. Entre um erro barulhento e um erro invisível, este módulo escolhe
 * o barulhento.
 */

/** Ambientes de NEGÓCIO do Peteen. */
export const PETEEN_ENVIRONMENTS = ["production", "demo", "preview", "development"] as const

export type PeteenEnvironment = (typeof PETEEN_ENVIRONMENTS)[number]

export function isPeteenEnvironment(valor: unknown): valor is PeteenEnvironment {
  return (
    typeof valor === "string" && (PETEEN_ENVIRONMENTS as readonly string[]).includes(valor)
  )
}

/**
 * O que o processo tem para decidir. Recebido por parâmetro, não lido de
 * `process.env` aqui — é isso que torna a matriz inteira testável sem mexer em
 * variáveis globais do runner.
 */
export type EnvironmentSignals = {
  /** `PETEEN_ENV` — identidade de negócio, definida por nós. */
  peteenEnv?: string | undefined
  /** `VERCEL_ENV` — estágio da plataforma, injetado pela Vercel. */
  vercelEnv?: string | undefined
}

/**
 * Resolve a identidade do ambiente.
 *
 * Ordem, e cada passo existe por um motivo:
 *
 *   1. `PETEEN_ENV` válida vence — é a declaração explícita, e é o único jeito
 *      de distinguir o DEMO, cujo `VERCEL_ENV` também é `production`;
 *   2. `PETEEN_ENV` presente mas inválida → `development` + erro. Nunca cai
 *      para o passo 3: um typo não pode ser silenciosamente ignorado e virar
 *      production pelo caminho de trás;
 *   3. sem `PETEEN_ENV` → mapa de `VERCEL_ENV`, exatamente como antes;
 *   4. nada disso → `development` (localhost, CI, container próprio).
 */
export function resolvePeteenEnvironment(
  signals: EnvironmentSignals,
  aoAvisar: (mensagem: string, detalhe: Record<string, unknown>) => void = (m, d) =>
    console.error(m, d)
): PeteenEnvironment {
  const declarado = signals.peteenEnv?.trim()

  if (declarado !== undefined && declarado !== "") {
    if (isPeteenEnvironment(declarado)) return declarado

    aoAvisar("[env] PETEEN_ENV com valor desconhecido — tratando como development", {
      recebido: declarado.slice(0, 40),
      aceitos: PETEEN_ENVIRONMENTS.join(" | "),
    })
    return "development"
  }

  switch (signals.vercelEnv) {
    case "production":
      return "production"
    case "preview":
      return "preview"
    default:
      return "development"
  }
}

/**
 * Lê os sinais do processo. Só a borda toca `process.env`.
 *
 * `PETEEN_ENV` NÃO entra no schema de `lib/env.ts` de propósito, por dois
 * motivos que se reforçam: aquele arquivo faz `parse` no carregamento do
 * módulo, então um `z.enum` transformaria um typo numa queda global — o oposto
 * exato do fallback conservador desenhado aqui; e um segundo lugar
 * interpretando a mesma variável é como as duas leituras divergem depois.
 * Este módulo é o único intérprete.
 */
export function getPeteenEnvironment(): PeteenEnvironment {
  return resolvePeteenEnvironment({
    peteenEnv: process.env.PETEEN_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })
}

/**
 * Este ambiente é a produção real do Peteen?
 *
 * Existe para que nenhum chamador escreva `=== "production"` por conta própria:
 * a pergunta "posso causar efeito no mundo real?" tem UMA resposta, e ela
 * precisa mudar em um lugar só se um ambiente novo aparecer.
 */
export function isProducaoReal(ambiente: PeteenEnvironment): boolean {
  return ambiente === "production"
}
