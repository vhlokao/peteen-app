import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma/client"

/**
 * GET /api/cron/expire-requests
 *
 * Vercel Cron — roda a cada hora (ver vercel.json).
 * Expira automaticamente ServiceRequests PENDING sem resposta há mais de
 * PENDING_EXPIRY_HOURS horas. Sem essa rotina, PENDING nunca sai desse
 * estado sozinho (só existia um dev action manual antes desta fase).
 *
 * Segurança: exige "Authorization: Bearer $CRON_SECRET" — a Vercel injeta
 * esse header automaticamente em execuções de cron quando a env var
 * CRON_SECRET está configurada no projeto.
 *
 * Guard atômico: mesmo padrão da Fase 3.1 (updateMany com where por status
 * esperado) — se outro processo já mudou o status do request entre a
 * leitura e o update, count é 0 e o request é contado como "skipped", não
 * como erro.
 */
export const runtime = "nodejs"

const PENDING_EXPIRY_HOURS = 48

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cron/expire-requests] Configuração de ambiente ausente.")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - PENDING_EXPIRY_HOURS * 60 * 60 * 1000)

    const candidates = await prisma.serviceRequest.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    })

    let expired = 0
    let skipped = 0

    for (const { id } of candidates) {
      // Guard atômico: só expira se ainda estiver PENDING no momento do update.
      const { count } = await prisma.serviceRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "EXPIRED" },
      })

      if (count === 0) {
        skipped++
        console.info(`[cron/expire-requests] skipped requestId=${id} (status já havia mudado)`)
        continue
      }

      expired++
      console.info(`[cron/expire-requests] expired requestId=${id}`)
    }

    const processedAt = new Date().toISOString()
    console.info(
      `[cron/expire-requests] expired=${expired} skipped=${skipped} processedAt=${processedAt}`
    )

    return NextResponse.json({ expired, skipped, processedAt })
  } catch (err) {
    console.error("[cron/expire-requests] Falha ao processar expiração.", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
