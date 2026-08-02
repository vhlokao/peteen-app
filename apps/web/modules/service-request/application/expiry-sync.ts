/**
 * Módulo: service-request
 * Camada: application
 *
 * Sincronização lazy de expiração — chamada nos pontos de leitura onde
 * PENDING é carregada para exibição (listagens e detalhe, tutor e
 * profissional). Garante que uma PENDING vencida nunca é mostrada como
 * "aguardando resposta" só porque o cron ainda não rodou.
 *
 * Por que mutação aqui é segura:
 *   Estas funções são chamadas de dentro de Server Actions ("use server"),
 *   invocadas diretamente por Server Components durante o data-fetching
 *   (nunca por um Client Component, nunca via cache/fetch do Next). Uma
 *   escrita via Prisma nesse ponto não é diferente de qualquer outra
 *   escrita de Server Action — não é a mesma coisa que chamar
 *   revalidatePath/revalidateTag ou cookies().set durante a renderização
 *   (isso sim é proibido pelo Next.js). Por isso, deliberadamente, esta
 *   função NUNCA chama revalidatePath — o próprio valor de retorno já é
 *   fresco (mesma chamada, sem cache), e revalidar a mesma rota que está
 *   sendo renderizada arriscaria o erro "used revalidatePath ... during
 *   render". Nenhuma outra página precisa ser revalidada por uma
 *   expiração observada de passagem.
 *
 * Por que NÃO grava AuditLog:
 *   Quem abriu a página não causou a expiração — o sistema e a passagem
 *   do tempo causaram. Atribuir "request.expired" ao usuário que só estava
 *   olhando a tela seria uma autoria falsa no AuditLog. AuditLog formal
 *   para ator sistema permanece pendente até existir modelagem correta
 *   (ver mesma nota em app/api/cron/expire-requests/route.ts). Por isso,
 *   assim como o cron, esta sincronização só registra log operacional
 *   estruturado — nenhum dado pessoal, nenhum usuário como autor.
 */

import {
  transitionStatus,
  findServiceRequestById,
  ConcurrentStatusChangeError,
} from "../infrastructure/repository"
import { getRequestExpiryInfo } from "../domain/request-expiry"
import type { RequestStatus } from "../domain/types"

type SyncableRequest = {
  id: string
  status: RequestStatus
  createdAt: Date
  scheduledAt: Date | null
}

/**
 * Para cada request PENDING e vencida na lista, tenta transicioná-la para
 * EXPIRED (mesmo guard atômico de `transitionStatus`) e retorna a lista já
 * com o status corrigido — nunca esconde visualmente sem escrever o
 * estado real no banco.
 *
 * Requests que outro processo já mudou de status (corrida com aceite ou
 * com o cron) não são sobrescritas: o valor real e atual é buscado de
 * volta e usado no retorno.
 */
export async function syncExpiredPendingRequests<T extends SyncableRequest>(
  requests: T[]
): Promise<T[]> {
  const now = new Date()

  return Promise.all(
    requests.map(async (request) => {
      if (request.status !== "PENDING") return request

      const { isExpired } = getRequestExpiryInfo(request.createdAt, request.scheduledAt, now)
      if (!isExpired) return request

      try {
        await transitionStatus(request.id, "PENDING", "EXPIRED")
        console.info("[syncExpiredPendingRequests] expired", { requestId: request.id })
        return { ...request, status: "EXPIRED" as RequestStatus }
      } catch (err) {
        if (err instanceof ConcurrentStatusChangeError) {
          // Outro processo já decidiu o destino desta request (aceite ou
          // cron) entre a leitura e esta tentativa — busca o valor real
          // em vez de assumir EXPIRED.
          const fresh = await findServiceRequestById(request.id)
          return fresh ? { ...request, status: fresh.status } : request
        }
        console.error("[syncExpiredPendingRequests]", err)
        return request
      }
    })
  )
}

/** Variante para uma única request (tela de detalhe). */
export async function syncExpiredPendingRequest<T extends SyncableRequest>(
  request: T
): Promise<T> {
  const synced = await syncExpiredPendingRequests([request])
  return synced[0] ?? request
}
