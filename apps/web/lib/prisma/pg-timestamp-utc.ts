/**
 * Leitura de `timestamp without time zone` como UTC — correção do incidente de
 * consistência temporal em produção.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE QUEBROU
 *
 * Todas as 84 colunas temporais deste schema são `timestamp(3) without time
 * zone`. O Postgres devolve esse tipo como texto SEM offset:
 *
 *     "2026-08-17 21:48:09.773"
 *
 * O parser padrão do driver (`postgres-date`, registrado por `pg-types` para o
 * OID 1114) decide assim, no fonte instalado:
 *
 *     var offset = timeZoneOffset(isoDate)
 *     if (offset != null) date = new Date(Date.UTC(...))   // string TEM offset
 *     else                date = new Date(y, m, d, h, ...) // string NÃO tem
 *
 * Sem offset na string, cai no construtor multi-argumento de `Date` — que a
 * especificação define como interpretado no FUSO LOCAL DO PROCESSO. Num runtime
 * em UTC-3, o literal acima virava `2026-08-17T00:48:09.773Z`: três horas à
 * frente do instante real.
 *
 * Consequência observada em produção: `startedAt` lido no futuro fazia
 * `resolveEffectiveOccurredAt` recusar QUALQUER publicação do Diário com
 * BEFORE_START, depois de a foto já ter subido ao bucket — mídia órfã e
 * atendimento sem registro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE FORÇAR, E NÃO CONFIGURAR O FUSO DO PROCESSO
 *
 * Ajustar `TZ` do runtime "conserta" por coincidência: passa a depender de uma
 * variável de ambiente que não vive neste repositório, que difere entre Vercel,
 * máquina de dev e CI, e cuja ausência volta a produzir o bug em silêncio.
 * Forçar a interpretação no parser é independente de `process.env.TZ`, do fuso
 * da máquina, do runtime da Vercel e do navegador — as quatro fontes que o
 * incidente provou não serem confiáveis.
 *
 * A semântica é a correta para ESTE banco: a auditoria confirmou, por
 * correlação com timestamps externos do Storage (genuinamente UTC), que os
 * literais gravados já são UTC. Não há dado a corrigir — só leitura.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESCOPO DELIBERADO: SOMENTE O OID 1114
 *
 *   1114 `timestamp without time zone` → tratado aqui.
 *   1184 `timestamptz`                 → NÃO tocado: o literal já vem com
 *        offset, o parser padrão acerta, e o schema `public` não usa este tipo.
 *   1082 `date`                        → NÃO tocado: auditoria não encontrou
 *        NENHUMA coluna `date` no schema `public`.
 *   1115 `timestamp[]`                 → NÃO tocado: não existe campo
 *        `DateTime[]` no schema Prisma.
 *
 * Ampliar o escopo sem uma coluna real que o justifique só aumentaria a
 * superfície de uma correção que precisa ser mínima e auditável.
 */

import { types } from "pg"

/** OID do `timestamp without time zone` no PostgreSQL. */
export const PG_OID_TIMESTAMP_SEM_FUSO = 1114

/**
 * `YYYY-MM-DD HH:MM:SS[.frac]` — a forma que o Postgres emite para
 * `timestamp(3)`. A fração é opcional porque `.000` é impresso como ausente, e
 * `.070` como `.07`: o texto vem com zeros à direita cortados.
 */
const LITERAL_TIMESTAMP = /^(\d{4,})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/

/** Parser original do driver. Guardado para delegar o que esta função não cobre. */
const parserOriginal = types.getTypeParser(PG_OID_TIMESTAMP_SEM_FUSO)

/**
 * Converte a fração decimal do literal em milissegundos, TRUNCANDO.
 *
 * Truncar, não arredondar: as colunas são `timestamp(3)` e não deveriam trazer
 * mais de três casas, mas se trouxerem, arredondar inventaria até 1 ms de tempo
 * que não existe no banco — e um instante inventado é justamente o que este
 * arquivo existe para impedir.
 */
function fracaoParaMilissegundos(fracao: string | undefined): number {
  if (!fracao) return 0
  return Math.floor(Number(`0.${fracao}`) * 1000)
}

/**
 * Interpreta o literal do Postgres como instante UTC.
 *
 * `"2026-08-17 21:48:09.773"` → `2026-08-17T21:48:09.773Z`, em qualquer fuso de
 * processo.
 *
 * O que NÃO casa com o formato (`infinity`, `-infinity`, datas com sufixo ` BC`)
 * é delegado ao parser original: são valores que este schema não produz, e
 * reimplementá-los aqui seria assumir responsabilidade por casos sem cobertura
 * de teste. A delegação preserva exatamente o comportamento anterior para eles.
 */
export function parsePgTimestampComoUtc(literal: string | null): Date | null {
  if (literal === null) return null

  const partes = LITERAL_TIMESTAMP.exec(literal)
  if (!partes) return parserOriginal(literal) as Date | null

  const [, ano, mes, dia, hora, minuto, segundo, fracao] = partes

  const instante = new Date(
    Date.UTC(
      Number(ano),
      Number(mes) - 1,
      Number(dia),
      Number(hora),
      Number(minuto),
      Number(segundo),
      fracaoParaMilissegundos(fracao)
    )
  )

  // `Date.UTC` interpreta anos de 0 a 99 como 1900–1999. O banco não tem datas
  // assim, mas a correção é de uma linha e evita que um dado inesperado vire um
  // instante silenciosamente errado — o modo de falha que originou tudo isto.
  const anoNumerico = Number(ano)
  if (anoNumerico >= 0 && anoNumerico <= 99) {
    instante.setUTCFullYear(anoNumerico)
  }

  return instante
}

/**
 * Registra o parser no driver. Idempotente.
 *
 * `types.setTypeParser` é GLOBAL ao módulo `pg` do processo — por isso é
 * chamado em UM único lugar (`lib/prisma/client.ts`, no topo do módulo, antes
 * de qualquer `Pool` existir) e não espalhado por quem consulta. Todo `Pool`
 * criado depois, inclusive o do `@prisma/adapter-pg`, herda o parser.
 *
 * RESSALVA REGISTRADA: um script avulso que crie um `Pool` sem nunca importar
 * `lib/prisma/client.ts` não passa por aqui e volta a ler no fuso do processo.
 * Vale para os utilitários de `scripts/`, não para a aplicação — todo caminho
 * de runtime chega ao banco pelo singleton do Prisma.
 */
export function registrarParserDeTimestampUtc(): void {
  types.setTypeParser(PG_OID_TIMESTAMP_SEM_FUSO, parsePgTimestampComoUtc)
}
