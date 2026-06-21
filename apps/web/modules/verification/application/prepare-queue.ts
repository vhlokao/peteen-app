/**
 * módulo: verification
 * Prepara fila uma vez por request (dedupe + backfill) — evita race em Promise.all.
 */

import { cache } from "react"

import {
  dedupePendingVerificationRequests,
  backfillPendingPartnerVerificationRequests,
  reconcileVerifiedEntityPendingRequests,
} from "../infrastructure/repository"

export const prepareVerificationQueue = cache(async (): Promise<void> => {
  await dedupePendingVerificationRequests()
  await reconcileVerifiedEntityPendingRequests()
  await backfillPendingPartnerVerificationRequests()
})
