/* Peteen — Service Worker mínimo (Push Foundation V0.1)
 *
 * ESCOPO ESTRITO. Este SW faz TRÊS coisas e nada mais:
 *   1. receber push
 *   2. showNotification
 *   3. notificationclick
 *
 * O QUE ELE DELIBERADAMENTE NÃO FAZ, e por quê:
 *   - NÃO intercepta fetch  → um handler de fetch aqui passaria a mediar TODAS
 *                             as requisições da aplicação, incluindo as
 *                             autenticadas. É superfície de ataque e fonte de
 *                             bugs de cache sutis, sem nenhum ganho para push.
 *   - NÃO faz cache         → offline não é objetivo desta missão.
 *   - NÃO usa eval          → nenhuma execução dinâmica.
 *   - NÃO faz fetch externo → o SW nunca fala com terceiro.
 *   - NÃO faz background sync.
 *
 * PAYLOAD: chega criptografado do nosso próprio servidor, mas ainda assim é
 * tratado como NÃO CONFIÁVEL. Toda a validação abaixo existe porque um SW que
 * confia cegamente no payload vira vetor de redirect aberto.
 */

const FALLBACK_URL = "/";
const FALLBACK_TITLE = "Peteen";
const FALLBACK_BODY = "Você tem uma nova atualização.";

/**
 * Só aceita destino interno, decidido pelo PARSER — nunca por prefixo.
 *
 * A versão anterior checava `startsWith("/")` e `startsWith("//")`. Isso é
 * insuficiente e foi comprovado como open redirect: "/\evil.example" passa
 * pelos dois testes, mas o parser WHATWG — o mesmo que clients.openWindow() e
 * client.navigate() usam — resolve para https://evil.example/. Pela
 * especificação de URL, backslash é equivalente a barra na porção de
 * autoridade, então qualquer filtro textual perde essa classe inteira de
 * bypass (e suas variações: "/\/", "/\\", encoded, etc).
 *
 * A única fonte de verdade confiável é resolver contra a origem real e exigir
 * que o resultado permaneça nela. Depois devolvemos apenas o caminho, nunca a
 * string original.
 *
 * Espelho de `sanitizeInternalRoute` em modules/notifications/domain/
 * push-events.ts — o SW não pode importar TypeScript, então as duas
 * implementações são exercitadas pela MESMA matriz de URLs nos testes.
 */
function sanitizeUrl(raw) {
  if (typeof raw !== "string") return FALLBACK_URL;
  const bruto = raw.trim();
  if (bruto.length === 0) return FALLBACK_URL;

  let parsed;
  try {
    parsed = new URL(bruto, self.location.origin);
  } catch {
    return FALLBACK_URL;
  }

  if (parsed.origin !== self.location.origin) return FALLBACK_URL;

  const destino = parsed.pathname + parsed.search + parsed.hash;
  return destino.startsWith("/") ? destino : FALLBACK_URL;
}

function sanitizeText(raw, fallback, maxLength) {
  if (typeof raw !== "string") return fallback;
  const limpo = raw.trim();
  if (limpo.length === 0) return fallback;
  return limpo.slice(0, maxLength);
}

self.addEventListener("install", () => {
  // Ativa imediatamente — não há cache antigo para migrar.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    // Payload malformado: ainda assim notificamos de forma genérica.
    // `userVisibleOnly: true` na subscription obriga a mostrar algo — engolir
    // em silêncio faria o browser punir a origem e, no limite, revogar a
    // permissão.
    dados = {};
  }

  const title = sanitizeText(dados.title, FALLBACK_TITLE, 80);
  const body = sanitizeText(dados.body, FALLBACK_BODY, 160);
  const url = sanitizeUrl(dados.url);
  const tag = sanitizeText(dados.tag, "peteen", 60);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      // A URL viaja em `data`, nunca no corpo visível.
      data: { url },
      badge: undefined,
      icon: undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = sanitizeUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Preferir focar uma janela já aberta da aplicação e navegar nela —
      // abrir uma aba nova a cada clique acumula abas do mesmo app.
      for (const janela of janelas) {
        if ("focus" in janela) {
          await janela.focus();
          if ("navigate" in janela) {
            try {
              await janela.navigate(destino);
            } catch {
              // navigate() pode falhar (cross-origin, janela em descarte).
              // O foco já aconteceu, que é o essencial.
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(destino);
      }
    })()
  );
});
