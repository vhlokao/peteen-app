/**
 * Módulo: professional
 * Camada: domain — funções puras
 *
 * Service Uniqueness Concurrency Safety.
 *
 * `DuplicateActiveServiceError` e o classificador de P2002 vivem aqui, não na
 * infraestrutura, porque não dependem do client Prisma conectado — só do
 * pacote de tipos `@prisma/client` (import estático, sem I/O). Isso permite
 * testar a classificação sem banco, sem env, sem o singleton de
 * `@/lib/prisma/client` — mesmo padrão das demais suítes puras do repo.
 *
 * A infraestrutura (`modules/professional/infrastructure/repository.ts`)
 * importa e usa ambos; não duplica a lógica.
 */

import { Prisma } from "@prisma/client"

/**
 * Lançado quando o índice único PARCIAL do banco
 * (services_professionalId_serviceType_active_key, ver
 * prisma/migrations/20260801120000_service_uniqueness_concurrency_safety)
 * rejeita a escrita porque já existe outro Service ATIVO do mesmo tipo para
 * o profissional. É a última linha de defesa: o guard de aplicação
 * (hasActiveServiceOfType) cobre o caso comum antes da tentativa de escrita,
 * mas só o índice garante integridade sob concorrência real (duas escritas
 * simultâneas). A camada application converte esta exceção na mesma
 * mensagem neutra do guard — nunca expõe nome de índice, SQL ou stack.
 */
export class DuplicateActiveServiceError extends Error {
  constructor(context: string) {
    super(`Violação do índice único de Service ativo (${context}).`)
    this.name = "DuplicateActiveServiceError"
  }
}

/**
 * `code === "P2002"` é o único unique constraint hoje existente na tabela
 * `services` (o índice parcial acima) — não há ambiguidade em tratar
 * qualquer P2002 vindo destas escritas como duplicidade de Service ativo.
 * Não confundir com outros erros: só o P2002 é convertido; qualquer outro
 * código/erro continua propagando normalmente.
 */
export function isDuplicateActiveServiceViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
}
