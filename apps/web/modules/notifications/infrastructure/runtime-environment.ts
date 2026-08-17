import "server-only"

/**
 * Módulo: notifications
 * Camada: infrastructure — ÚNICA fonte de "em que ambiente este runtime está".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO `NODE_ENV`
 *
 * `NODE_ENV === "production"` responde "este build é otimizado?", não "isto é
 * o ambiente de produção". `next build` seguido de `next start` na máquina de
 * um desenvolvedor roda com `NODE_ENV=production` — e trataríamos essa máquina
 * como produção, reabrindo exatamente o buraco que o hardening fecha: ela
 * passaria a tentar enviar push para as subscriptions legadas de usuários
 * reais.
 *
 * `VERCEL_ENV` responde a pergunta certa. É injetada pela plataforma com
 * `production` | `preview` | `development` e não existe fora dela — por isso a
 * ausência significa "estou rodando fora do Vercel", que para efeito de push é
 * desenvolvimento.
 *
 * FALLBACK CONSERVADOR, e é assim de propósito: qualquer coisa que não seja
 * comprovadamente `production` vira `development`. O erro seguro é dev não
 * enviar push demais; o erro caro é dev enviar push para o telefone de um
 * usuário real.
 *
 * Este arquivo é `server-only`: ambiente de push nunca deve ser decidido no
 * browser, onde a variável não existe e a resposta seria sempre errada.
 */

import {
  vapidFingerprintFromPublicKey,
  type PushIdentity,
  type PushRuntimeEnvironment,
} from "../domain/vapid-fingerprint"

export function getPushRuntimeEnvironment(): PushRuntimeEnvironment {
  switch (process.env.VERCEL_ENV) {
    case "production":
      return "production"
    case "preview":
      return "preview"
    default:
      // Inclui VERCEL_ENV="development" e a ausência total da variável
      // (localhost, CI, container próprio). Ver o comentário do fallback.
      return "development"
  }
}

/**
 * Identidade DESTE ambiente — os dois eixos montados no mesmo lugar.
 *
 * ÚNICO produtor de `PushIdentity` em toda a aplicação, e é por isso que
 * existe: enquanto fingerprint e ambiente eram derivados separadamente em cada
 * chamador, bastava um esquecer um dos dois para gravar identidade parcial sem
 * ninguém notar. Quem persiste (`push-actions`) e quem filtra (`dispatch-push`)
 * consomem exatamente a mesma função — não há como divergirem.
 *
 * A chave PÚBLICA entra por parâmetro em vez de ser lida de `process.env` aqui:
 * quem chama já obteve a config completa via `getVapidConfig()`, que é o ponto
 * onde "push está habilitado?" é decidido. Ler de novo abriria a porta para
 * derivar identidade de uma configuração ausente.
 */
export function getCurrentPushIdentity(vapidPublicKey: string): PushIdentity {
  return {
    vapidKeyFingerprint: vapidFingerprintFromPublicKey(vapidPublicKey),
    runtimeEnvironment: getPushRuntimeEnvironment(),
  }
}
