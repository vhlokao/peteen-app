import { NextResponse } from "next/server"

import { getPeteenEnvironment } from "@/lib/env/peteen-environment"

/**
 * GET /api/environment — qual Peteen está respondendo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE
 *
 * O Gate 16 nasceu de um problema de identidade: o deploy de produção do
 * projeto DEMO também recebe `VERCEL_ENV=production`, então nada distinguia os
 * dois ambientes. `PETEEN_ENV` resolveu isso — mas resolveu no servidor, onde
 * ninguém de fora consegue olhar.
 *
 * Isso deixava um buraco de verificação: dava para provar que a variável estava
 * CONFIGURADA (a API da Vercel diz), não que estava RESOLVIDA. E "configurada"
 * é exatamente o que um typo também parece. Um ambiente que não consegue dizer
 * qual ambiente ele é não é verificável — e a impossibilidade de distinguir os
 * dois é o defeito que este gate inteiro existe para fechar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE É SEGURO SER PÚBLICO
 *
 * A resposta é um rótulo de um vocabulário fechado de quatro valores. Não
 * revela host, chave, ref de projeto nem versão — nada que ajude um atacante a
 * alcançar coisa alguma. Em compensação, torna o isolamento auditável por
 * qualquer um, a qualquer momento, sem credencial: é o mesmo espírito de
 * `NEXT_PUBLIC_SUPABASE_URL` estar no bundle.
 *
 * O ganho prático é o smoke poder afirmar "este deploy é o DEMO" em vez de
 * supor pela URL. URL não é identidade: um domínio pode ser reapontado, e foi
 * confundir superfície com identidade que produziu, nos Gates 14 e 15,
 * relatórios que chamaram o banco de DEMO de produção.
 *
 * `dynamic = "force-dynamic"`: sem isso o Next pode avaliar a rota no BUILD e
 * congelar a resposta. O ambiente é propriedade do runtime, não do artefato —
 * um valor gravado em build seria exatamente a mentira que a rota deveria
 * denunciar.
 */
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { environment: getPeteenEnvironment() },
    { headers: { "cache-control": "no-store" } }
  )
}
