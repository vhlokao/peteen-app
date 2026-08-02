import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma/client"
import { transitionStatus, ConcurrentStatusChangeError } from "@/modules/service-request/infrastructure/repository"
import { getRequestExpiryInfo } from "@/modules/service-request/domain/request-expiry"

/**
 * GET /api/cron/expire-requests
 *
 * Vercel Cron — roda 1x/dia (ver vercel.json: "0 9 * * *"). O plano Hobby
 * não permite frequência maior; a defesa real contra aceitar uma request
 * vencida NÃO depende desta rotina (ver acceptServiceRequestAction) — este
 * cron e a sincronização lazy nas listagens/detalhe (ver
 * application/expiry-sync.ts) são complementares, não a única linha de
 * defesa.
 *
 * Diferente da versão anterior: não existe mais um cutoff global fixo em
 * horas. O prazo é calculado por request via getRequestExpiryInfo (mesma
 * função usada pelo aceite e pela sincronização lazy — única fonte de
 * verdade, nunca duplicada).
 *
 * Segurança: exige "Authorization: Bearer $CRON_SECRET" — a Vercel injeta
 * esse header automaticamente em execuções de cron quando a env var
 * CRON_SECRET está configurada no projeto. Sem a env var, falha com 500
 * (fail-closed) — nunca expira requests sem essa verificação.
 *
 * Guard atômico: usa transitionStatus() (mesma função central usada por
 * todas as transições de status), que só escreve se o registro ainda
 * estiver em PENDING no momento do update. Se outro processo (aceite,
 * rejeição, cancelamento) já mudou o status entre a leitura e esta
 * tentativa, a exceção ConcurrentStatusChangeError é capturada e a request
 * é contada como "skippedConcurrent", não como erro.
 *
 * AuditLog: NÃO é gravado aqui. AuditLog.userId é NOT NULL (FK para User)
 * — não existe hoje um conceito de "ator sistema" no schema, e criar um
 * usuário de sistema improvisado ou tornar a coluna nullable exigiria
 * migration, fora do escopo desta fase. Em vez disso, cada expiração é
 * logada de forma estruturada e neutra (sem PII) via console.info — essa
 * lacuna de AuditLog formal para ações de sistema é uma decisão consciente
 * e documentada, não um esquecimento.
 */
export const runtime = "nodejs"

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
    // Lote de candidatas: toda PENDING atual. O filtro por vencimento é
    // feito em memória (por request, via getRequestExpiryInfo) porque a
    // regra depende de scheduledAt e não é expressável como um único
    // cutoff de coluna. Cap defensivo para limitar o tempo de execução de
    // uma única chamada de cron mesmo sob um volume anormal de PENDING.
    const candidates = await prisma.serviceRequest.findMany({
      where: { status: "PENDING" },
      select: { id: true, createdAt: true, scheduledAt: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    })

    let scanned = 0
    let expired = 0
    let skippedConcurrent = 0
    let failed = 0

    const now = new Date()

    for (const candidate of candidates) {
      scanned++

      const { isExpired } = getRequestExpiryInfo(candidate.createdAt, candidate.scheduledAt, now)
      if (!isExpired) continue

      try {
        await transitionStatus(candidate.id, "PENDING", "EXPIRED")
        expired++
        // Log estruturado e neutro — sem PII (nenhum dado de tutor/profissional/pet).
        console.info("[cron/expire-requests] expired", { requestId: candidate.id })
      } catch (err) {
        if (err instanceof ConcurrentStatusChangeError) {
          skippedConcurrent++
          console.info("[cron/expire-requests] skippedConcurrent", { requestId: candidate.id })
          continue
        }
        failed++
        console.error("[cron/expire-requests] failed", { requestId: candidate.id, error: String(err) })
      }
    }

    const processedAt = now.toISOString()
    console.info("[cron/expire-requests] summary", {
      scanned,
      expired,
      skippedConcurrent,
      failed,
      processedAt,
    })

    return NextResponse.json({ scanned, expired, skippedConcurrent, failed, processedAt })
  } catch (err) {
    console.error("[cron/expire-requests] Falha ao processar expiração.", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
