import "server-only"

import { cookies } from "next/headers"

import {
  VISITOR_KEY_COOKIE,
  VISITOR_KEY_MAX_AGE_SECONDS,
  generateVisitorKey,
  isValidVisitorKey,
} from "../domain/invite-visit"

/**
 * Chave anônima do visitante — leitura e emissão.
 *
 * COOKIE FIRST-PARTY, PSEUDÔNIMO, SEM PII. Não é fingerprint: não deriva de
 * IP, user-agent ou qualquer característica do dispositivo. Serve só para
 * não contar o mesmo F5 como dez visitas e para ligar uma abertura anônima
 * ao cadastro que ela originou. Ver domain/invite-visit.ts.
 *
 * `httpOnly` porque nenhum código de cliente precisa lê-la — só o servidor,
 * ao registrar a visita e ao converter. `sameSite: lax` mantém a chave viva
 * na volta do OAuth (navegação top-level de outro domínio), que é
 * exatamente o caminho crítico do convite.
 */
export async function readVisitorKey(): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(VISITOR_KEY_COOKIE)?.value
  // Cookie é entrada não confiável: uma chave editada à mão (ou com PII
  // colada dentro) é descartada como se não existisse.
  return isValidVisitorKey(raw) ? raw : null
}

/**
 * Devolve a chave existente ou emite uma nova, gravando o cookie.
 *
 * Só pode ser chamada de um contexto onde escrever cookie é permitido
 * (Server Action ou Route Handler) — em Server Component de página, o Next
 * proíbe a escrita. A landing usa `readVisitorKey` + um Route Handler para
 * emitir; ver app/p/[professionalId].
 */
export async function ensureVisitorKey(): Promise<string> {
  const store = await cookies()
  const existing = store.get(VISITOR_KEY_COOKIE)?.value
  if (isValidVisitorKey(existing)) return existing

  const fresh = generateVisitorKey()
  store.set(VISITOR_KEY_COOKIE, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_KEY_MAX_AGE_SECONDS,
  })
  return fresh
}
