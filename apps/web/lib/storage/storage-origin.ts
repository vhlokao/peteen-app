/**
 * Origem HTTP do Supabase Storage — para antecipar a conexão, não para montar URL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISTO RESOLVE
 *
 * Medição do primeiro playback de vídeo na Care Timeline, com arquivos reais de
 * produção:
 *
 *   TTFB com conexão fria ................ 569 ms
 *   TTFB com conexão quente, bytes frescos .. 87 ms
 *
 * A diferença é handshake DNS + TCP + TLS, não cache de CDN — o teste que
 * separa os dois foi repetir a requisição com cache-busting forçando ida à
 * origem: continuou rápido. Ou seja, ~480 ms do tempo até o vídeo tocar são
 * gastos abrindo a conexão, e são gastos DEPOIS de a pessoa já ter tocado em
 * "Reproduzir".
 *
 * Um `preconnect` move esse custo para antes do gesto. Não é requisição do
 * arquivo: abre a conexão e para. Zero bytes de vídeo, zero requisição ao
 * objeto — o contrato de "nada acontece antes do clique" continua intacto,
 * porque o que ele protege é tráfego de mídia, não a existência de um socket.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE DERIVAR, E NÃO ESCREVER O HOST
 *
 * As URLs assinadas de leitura são servidas pela MESMA origem de
 * `NEXT_PUBLIC_SUPABASE_URL` (o caminho é /storage/v1/object/sign/...).
 * Derivar dali garante que dev, preview e produção antecipem cada um a sua
 * origem sem nenhuma lista para manter — e que trocar de projeto Supabase não
 * deixe para trás um preconnect apontando para o host errado, que seria pior
 * que não ter nenhum: custaria um handshake inútil.
 *
 * Só a ORIGEM é exposta. Nenhum path, nenhum token, nenhuma URL assinada.
 */

/**
 * `https://<projeto>.supabase.co` — sem path, sem barra final.
 *
 * `null` quando a variável não existe ou não é uma URL absoluta válida. O
 * chamador simplesmente não antecipa a conexão: perder o preconnect custa
 * latência, enquanto passar lixo para o browser custaria um erro visível no
 * console de todo usuário.
 */
export function supabaseStorageOrigin(): string | null {
  const bruto = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!bruto) return null

  try {
    const url = new URL(bruto)
    // Só http(s): um `data:` ou `file:` vindo de configuração errada não pode
    // virar hint de rede.
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.origin
  } catch {
    return null
  }
}
